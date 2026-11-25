const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { temporaryDatabase } = require('./database');
const { connectDatabase, mongoose } = require('../src/config/database');
const { createApp } = require('../src/index');
const { Libro, Ejemplar, Usuario, Prestamo } = require('../src/models');
const { seed, id: seedId } = require('../scripts/seed');
const { catalogo } = require('../src/services/consultasService');
const { createContext } = require('../src/graphql/context');
let db, instance, base;
const future = (days = 14) => new Date(Date.now() + days * 86400000).toISOString();
const past = days => new Date(Date.now() - days * 86400000).toISOString();
before(async () => {
  db = await temporaryDatabase();
  await connectDatabase(db.getUri(), 'bibliotrack_test');
  instance = await createApp();
  await new Promise(resolve => instance.httpServer.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${instance.httpServer.address().port}`;
}, { timeout: 120000 });
after(async () => { if (instance) await instance.apollo.stop(); await mongoose.disconnect(); if (db) await db.stop(); });
async function raw(query, variables = {}) {
  const response = await fetch(`${base}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  return response.json();
}
async function gql(query, variables) {
  const body = await raw(query, variables);
  assert.equal(body.errors, undefined, JSON.stringify(body.errors));
  return body.data;
}
async function rejected(query, variables, code) {
  const body = await raw(query, variables);
  assert.ok(body.errors?.length, 'La operación debe fallar');
  if (code) assert.equal(body.errors[0].extensions.code, code, JSON.stringify(body.errors));
  assert.equal(body.errors[0].extensions.stacktrace, undefined);
  return body;
}
let counter = 0;
async function fixture() {
  const n = ++counter;
  const { crearLibro: libro } = await gql('mutation($i:CrearLibroInput!){crearLibro(input:$i){id titulo}}', { i: { titulo: `Libro de prueba ${n}`, isbn: `97800000${String(n).padStart(5, '0')}`, autores: ['Autora de prueba'], categoria: 'Pruebas', editorial: 'Pruebas', anioPublicacion: 2024 } });
  const { crearUsuario: usuario } = await gql('mutation($i:CrearUsuarioInput!){crearUsuario(input:$i){id nombre}}', { i: { nombre: 'Ana', apellidos: 'Pruebas', matricula: `TEST-${n}`, correo: `test${n}@example.com`, tipoUsuario: 'Estudiante' } });
  const { crearEjemplar: ejemplar } = await gql('mutation($i:CrearEjemplarInput!){crearEjemplar(input:$i){id estado libro{titulo}}}', { i: { libroId: libro.id, codigoEjemplar: `TEST-E${n}`, ubicacion: 'Sala A' } });
  return { libro, usuario, ejemplar };
}
const loanMutation = 'mutation($i:CrearPrestamoInput!){crearPrestamo(input:$i){id estado abierto usuario{id} ejemplar{id estado libro{titulo}}}}';
const returnMutation = 'mutation($id:ID!,$fecha:DateTime){registrarDevolucion(id:$id,fechaDevolucion:$fecha){id estado abierto fechaDevolucion ejemplar{estado} movimientos{tipo}}}';

test('HTTP: salud, portada, Sandbox y errores JSON/404', async () => {
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await (await fetch(`${base}/api`)).json()).nombre, 'BiblioTrack');
  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /BiblioTrack/);
  assert.equal((await fetch(`${base}/js/app.mjs`)).status, 200);
  assert.equal((await fetch(`${base}/css/styles.css`)).status, 200);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  const sandbox = await fetch(`${base}/graphql`, { headers: { accept: 'text/html' } });
  assert.equal(sandbox.status, 200); assert.match(await sandbox.text(), /apollo|sandbox/i);
  const introspection = await gql(require('graphql').getIntrospectionQuery());
  assert.ok(introspection.__schema.types.some(type => type.name === 'Prestamo'));
  assert.equal((await fetch(`${base}/faltante`)).status, 404);
  assert.equal((await fetch(`${base}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{mal' })).status, 400);
});

test('CRUD de libros, ejemplares y usuarios, relaciones y búsquedas', async () => {
  const { libro, usuario, ejemplar } = await fixture();
  await gql('mutation($id:ID!){actualizarLibro(id:$id,input:{titulo:"Título editado"}){titulo}}', { id: libro.id });
  await gql('mutation($id:ID!){actualizarUsuario(id:$id,input:{nombre:"Carolina"}){nombre}}', { id: usuario.id });
  await gql('mutation($id:ID!){actualizarEjemplar(id:$id,input:{ubicacion:"Sala B",estado:"En reparación"}){estado}}', { id: ejemplar.id });
  const found = await gql('query{buscarLibros(texto:"Título editado"){total items{titulo ejemplares{items{ubicacion}}}} buscarUsuarios(texto:"Carolina"){total}}');
  assert.equal(found.buscarLibros.total, 1); assert.equal(found.buscarUsuarios.total, 1);
  assert.equal(found.buscarLibros.items[0].ejemplares.items[0].ubicacion, 'Sala B');
  await rejected('mutation($id:ID!){eliminarLibro(id:$id)}', { id: libro.id }, 'CONFLICT');
  await gql('mutation($id:ID!){eliminarEjemplar(id:$id)}', { id: ejemplar.id });
  await gql('mutation($id:ID!){eliminarLibro(id:$id)}', { id: libro.id });
  await gql('mutation($id:ID!){eliminarUsuario(id:$id)}', { id: usuario.id });
  await rejected('query($id:ID!){libro(id:$id){id}}', { id: libro.id }, 'NOT_FOUND');
});

test('Préstamo, renovación, devolución e historial conservado', async () => {
  const { libro, usuario, ejemplar } = await fixture();
  const { crearPrestamo: loan } = await gql(loanMutation, { i: { usuarioId: usuario.id, ejemplarId: ejemplar.id, fechaVencimiento: future() } });
  assert.equal(loan.ejemplar.estado, 'Prestado');
  await rejected('mutation($id:ID!){eliminarUsuario(id:$id)}', { id: usuario.id }, 'CONFLICT');
  await rejected('mutation($id:ID!){actualizarUsuario(id:$id,input:{estado:"Inactivo"}){id}}', { id: usuario.id }, 'CONFLICT');
  await rejected('mutation($id:ID!){actualizarEjemplar(id:$id,input:{estado:"Disponible"}){id}}', { id: ejemplar.id });
  await gql('mutation($id:ID!,$v:DateTime!){actualizarPrestamo(id:$id,input:{fechaVencimiento:$v,observaciones:"Renovación"}){id}}', { id: loan.id, v: future(21) });
  const { registrarDevolucion: closed } = await gql(returnMutation, { id: loan.id });
  assert.equal(closed.estado, 'Devuelto'); assert.equal(closed.ejemplar.estado, 'Disponible');
  assert.deepEqual(closed.movimientos.map(m => m.tipo), ['Creación', 'Actualización', 'Devolución']);
  await rejected(returnMutation, { id: loan.id }, 'CONFLICT');
  await rejected('mutation($id:ID!){eliminarEjemplar(id:$id)}', { id: ejemplar.id }, 'CONFLICT');
  await rejected('mutation($id:ID!){eliminarUsuario(id:$id)}', { id: usuario.id }, 'CONFLICT');
  const history = await gql('query($id:ID!){historialUsuario(usuarioId:$id){total items{estado}}}', { id: usuario.id });
  assert.equal(history.historialUsuario.total, 1);
  assert.ok(await Libro.exists({ _id: libro.id }));
});

test('Dos solicitudes simultáneas: solo un préstamo obtiene el ejemplar', async () => {
  const { usuario, ejemplar } = await fixture();
  const { usuario: otroUsuario } = await fixture();
  const input = { usuarioId: usuario.id, ejemplarId: ejemplar.id, fechaVencimiento: future() };
  const results = await Promise.all([raw(loanMutation, { i: input }), raw(loanMutation, { i: { ...input, usuarioId: otroUsuario.id } })]);
  assert.equal(results.filter(r => r.data?.crearPrestamo).length, 1);
  assert.equal(results.filter(r => r.errors).length, 1);
  assert.equal(await Prestamo.countDocuments({ ejemplarId: ejemplar.id, abierto: true }), 1);
});

test('Cancelación conserva el movimiento, libera ejemplar y permite otro préstamo', async () => {
  const { usuario, ejemplar } = await fixture();
  const input = { usuarioId: usuario.id, ejemplarId: ejemplar.id, fechaVencimiento: future() };
  const { crearPrestamo: loan } = await gql(loanMutation, { i: input });
  await rejected('mutation($id:ID!){cancelarPrestamo(id:$id,motivo:""){id}}', { id: loan.id }, 'BAD_USER_INPUT');
  const { cancelarPrestamo: canceled } = await gql('mutation($id:ID!){cancelarPrestamo(id:$id,motivo:"Captura duplicada"){estado fechaDevolucion ejemplar{estado} movimientos{tipo}}}', { id: loan.id });
  assert.equal(canceled.estado, 'Cancelado'); assert.equal(canceled.fechaDevolucion, null);
  assert.equal(canceled.ejemplar.estado, 'Disponible'); assert.equal(canceled.movimientos.at(-1).tipo, 'Cancelación');
  await gql(loanMutation, { i: input });
});

test('Validaciones: identificadores, duplicados, referencias, estados, fechas y paginación', async () => {
  const { usuario, ejemplar } = await fixture();
  const input = { usuarioId: usuario.id, ejemplarId: ejemplar.id, fechaVencimiento: future() };
  await rejected('query{libro(id:"mal"){id}}', {}, 'BAD_USER_INPUT');
  await rejected('query{libros(limite:101){total}}', {}, 'BAD_USER_INPUT');
  await rejected('query{usuarios(pagina:0){total}}', {}, 'BAD_USER_INPUT');
  await rejected('mutation($i:CrearEjemplarInput!){crearEjemplar(input:$i){id}}', { i: { libroId: new mongoose.Types.ObjectId().toString(), codigoEjemplar: 'HUERFANO', ubicacion: 'A' } }, 'NOT_FOUND');
  await rejected('mutation($id:ID!){actualizarEjemplar(id:$id,input:{estado:"Prestado"}){id}}', { id: ejemplar.id }, 'BAD_USER_INPUT');
  await rejected(loanMutation, { i: { ...input, usuarioId: new mongoose.Types.ObjectId().toString() } }, 'NOT_FOUND');
  await rejected(loanMutation, { i: { ...input, ejemplarId: new mongoose.Types.ObjectId().toString() } }, 'NOT_FOUND');
  await rejected(loanMutation, { i: { ...input, fechaPrestamo: future(1) } }, 'BAD_USER_INPUT');
  await rejected(loanMutation, { i: { ...input, fechaPrestamo: past(1), fechaVencimiento: past(2) } }, 'BAD_USER_INPUT');
  await rejected(loanMutation, { i: { ...input, fechaVencimiento: '2026-02-30T12:00:00Z' } });
  await rejected('mutation($id:ID!){actualizarEjemplar(id:$id,input:{fechaAdquisicion:null}){id}}', { id: ejemplar.id }, 'BAD_USER_INPUT');
  await gql('mutation($id:ID!){actualizarUsuario(id:$id,input:{estado:"Inactivo"}){id}}', { id: usuario.id });
  await rejected(loanMutation, { i: input }, 'CONFLICT');
  assert.equal((await Ejemplar.findById(ejemplar.id)).estado, 'Disponible');
  const duplicate = await Usuario.findById(usuario.id);
  await rejected('mutation($i:CrearUsuarioInput!){crearUsuario(input:$i){id}}', { i: { nombre: 'Otra', apellidos: 'Persona', matricula: duplicate.matricula, correo: 'otro@example.com', tipoUsuario: 'Docente' } }, 'CONFLICT');
  assert.equal((await gql('query{buscarLibros(texto:".*"){total}}')).buscarLibros.total, 0, 'La búsqueda debe escapar regex');
});

test('Un fallo al guardar préstamo revierte el cambio de estado del ejemplar', async () => {
  const { usuario, ejemplar } = await fixture();
  await rejected(loanMutation, { i: { usuarioId: usuario.id, ejemplarId: ejemplar.id, fechaVencimiento: future(), observaciones: 'x'.repeat(2001) } }, 'BAD_USER_INPUT');
  assert.equal((await Ejemplar.findById(ejemplar.id)).estado, 'Disponible');
  assert.equal(await Prestamo.countDocuments({ ejemplarId: ejemplar.id }), 0);
});

test('Vencimientos se calculan con la fecha actual y admiten devolución', async () => {
  const { usuario, ejemplar } = await fixture();
  const { crearPrestamo: loan } = await gql(loanMutation, { i: { usuarioId: usuario.id, ejemplarId: ejemplar.id, fechaPrestamo: past(20), fechaVencimiento: past(3) } });
  assert.equal(loan.estado, 'Vencido');
  const result = await gql('query($id:ID!){prestamosVencidos(usuarioId:$id){total} prestamosActivos(usuarioId:$id){total} prestamos(estado:"Activo",usuarioId:$id){total}}', { id: usuario.id });
  assert.equal(result.prestamosVencidos.total, 1); assert.equal(result.prestamosActivos.total, 1); assert.equal(result.prestamos.total, 0);
  await rejected(returnMutation, { id: loan.id, fecha: past(21) }, 'BAD_USER_INPUT');
  await rejected(returnMutation, { id: loan.id, fecha: future() }, 'BAD_USER_INPUT');
  await gql(returnMutation, { id: loan.id });
});

test('Carga de 4,000 documentos: idempotente, relacionada y sin duplicar activos', async () => {
  const countsBefore = await Promise.all([Libro, Ejemplar, Usuario, Prestamo].map(Model => Model.countDocuments()));
  const { buildSeed } = require('../scripts/seed');
  const collision = await Libro.create({ ...buildSeed().libros[0], _id: new mongoose.Types.ObjectId() });
  await assert.rejects(seed({ log: () => {} }), error => error.code === 11000);
  assert.equal(await Usuario.countDocuments(), countsBefore[2]);
  assert.equal(await Prestamo.countDocuments(), countsBefore[3]);
  assert.equal(await Libro.countDocuments(), countsBefore[0] + 1);
  await collision.deleteOne();
  const first = await seed({ log: () => {} }); assert.equal(first.inserted, 4000);
  const countsAfter = await Promise.all([Libro, Ejemplar, Usuario, Prestamo].map(Model => Model.countDocuments()));
  countsAfter.forEach((count, i) => assert.equal(count - countsBefore[i], 1000));
  await Libro.updateOne({ _id: seedId('libro', 0) }, { $set: { titulo: 'Cambio que debe conservarse' } });
  const second = await seed({ log: () => {} }); assert.equal(second.inserted, 0);
  assert.deepEqual(second.totals, first.totals);
  assert.equal((await Libro.findById(seedId('libro', 0))).titulo, 'Cambio que debe conservarse');
  const duplicates = await Prestamo.aggregate([{ $match: { abierto: true } }, { $group: { _id: '$ejemplarId', count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }]);
  assert.equal(duplicates.length, 0);
  const orphanLoans = await Prestamo.aggregate([
    { $lookup: { from: 'usuarios', localField: 'usuarioId', foreignField: '_id', as: 'usuario' } },
    { $lookup: { from: 'ejemplares', localField: 'ejemplarId', foreignField: '_id', as: 'ejemplar' } },
    { $match: { $or: [{ usuario: { $size: 0 } }, { ejemplar: { $size: 0 } }] } }
  ]);
  assert.equal(orphanLoans.length, 0);
  const borrowed = await Ejemplar.countDocuments({ estado: 'Prestado' });
  assert.equal(borrowed, await Prestamo.countDocuments({ abierto: true }));
  for (const Model of [Libro, Ejemplar, Usuario, Prestamo]) assert.ok(await Model.countDocuments() >= 1000);
});

test('Las 30 agregaciones se ejecutan mediante HTTP GraphQL', async t => {
  const definitions = (await gql('query{consultasAvanzadas{codigo grupo nombre descripcion}}')).consultasAvanzadas;
  assert.equal(definitions.length, 30);
  for (const grupo of ['GAEL', 'CARLOS', 'JAIME']) assert.equal(definitions.filter(c => c.grupo === grupo).length, 10);
  for (const report of catalogo) await t.test(`${report.codigo}: ${report.nombre}`, async () => {
    const data = await gql('query($codigo:String!,$desde:DateTime,$hasta:DateTime,$uid:ID){consultaAvanzada(codigo:$codigo,desde:$desde,hasta:$hasta,usuarioId:$uid,limite:5){consulta{codigo} filas total pagina}}', {
      codigo: report.codigo, ...(report.requierePeriodo ? { desde: past(1000), hasta: future() } : {}), ...(report.requiereUsuario ? { uid: String(seedId('usuario', 0)) } : {})
    });
    assert.equal(data.consultaAvanzada.consulta.codigo, report.codigo);
    assert.ok(Array.isArray(data.consultaAvanzada.filas)); assert.ok(data.consultaAvanzada.filas.length <= 5);
    assert.ok(data.consultaAvanzada.total >= data.consultaAvanzada.filas.length);
  });
});

test('Reportes y dashboard devuelven cantidades verificables desde MongoDB', async () => {
  const data = await gql('query{estadisticasGenerales{totalLibros totalEjemplares totalUsuarios prestamosActivos prestamosVencidos ejemplaresDisponibles ultimosMovimientos{tipo} proximosAVencer{id} disponibilidad{estado cantidad}} consultaAvanzada(codigo:"J05"){filas}}');
  assert.equal(data.estadisticasGenerales.totalLibros, await Libro.countDocuments());
  assert.equal(data.estadisticasGenerales.prestamosActivos, await Prestamo.countDocuments({ abierto: true }));
  assert.equal(data.estadisticasGenerales.disponibilidad.reduce((sum, row) => sum + row.cantidad, 0), await Ejemplar.countDocuments());
  const percentages = data.consultaAvanzada.filas[0];
  assert.ok(Math.abs(percentages.porcentajeATiempo + percentages.porcentajeTardias - 100) < 0.0001);
  assert.equal(percentages.total, await Prestamo.countDocuments({ estado: 'Devuelto' }));
  await rejected('query{consultaAvanzada(codigo:"G10"){filas}}', {}, 'BAD_USER_INPUT');
  await rejected('query{consultaAvanzada(codigo:"C07"){filas}}', {}, 'BAD_USER_INPUT');
  await rejected('query{consultaAvanzada(codigo:"NO_EXISTE"){filas}}', {}, 'BAD_USER_INPUT');
});

test('El frontend recibe categorías y disponibilidad completa por libro', async () => {
  const book = await Libro.findById(seedId('libro', 0));
  const data = await gql('query($id:ID!){categoriasLibros libro(id:$id){disponibilidad{total disponibles prestados}}}', { id: String(book._id) });
  assert.ok(data.categoriasLibros.includes(book.categoria));
  assert.equal(data.libro.disponibilidad.total, await Ejemplar.countDocuments({ libroId: book._id }));
  assert.equal(data.libro.disponibilidad.disponibles, await Ejemplar.countDocuments({ libroId: book._id, estado: 'Disponible' }));
  assert.equal(data.libro.disponibilidad.prestados, await Ejemplar.countDocuments({ libroId: book._id, estado: 'Prestado' }));
});

test('La API rechaza acceso a campos internos y consultas excesivas', async () => {
  await rejected('mutation{crearUsuario(input:{nombre:"A",apellidos:"B",matricula:"XX",correo:"x@x.com",tipoUsuario:"Estudiante",__v:4}){id}}', {}, 'GRAPHQL_VALIDATION_FAILED');
  const fields = Array.from({ length: 301 }, (_, i) => `a${i}:__typename`).join(' ');
  await rejected(`query{${fields}}`, {}, 'GRAPHQL_VALIDATION_FAILED');
  const response = await instance.apollo.executeOperation({ query: '{ __typename }' }, { contextValue: createContext() });
  assert.equal(response.body.singleResult.data.__typename, 'Query');
});
