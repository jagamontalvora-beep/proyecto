const { createHash } = require('node:crypto');
const { connectDatabase, mongoose } = require('../src/config/database');
const { Libro, Usuario, Ejemplar, Prestamo } = require('../src/models');
const { transaction } = require('../src/services/bibliotecaService');

const id = (collection, i) => new mongoose.Types.ObjectId(createHash('sha256').update(`bibliotrack-seed-v1:${collection}:${i}`).digest('hex').slice(0, 24));
const day = 86400000;
const titles = ['La memoria del desierto', 'Fundamentos de programación', 'Historias de la ciudad', 'Introducción al cálculo', 'El jardín de los recuerdos', 'Bases de datos modernas', 'Ecología y territorio', 'El lenguaje de las imágenes', 'Economía cotidiana', 'Cartas desde la montaña', 'Física del movimiento', 'Ética y sociedad', 'Arquitectura de software', 'Viaje a las estrellas', 'Historia de México', 'Álgebra aplicada', 'La biblioteca de los sueños', 'Diseño de interfaces', 'Química de la vida', 'Aprender a investigar'];
const authors = ['Lucía Hernández', 'Miguel Torres', 'Ana Rivera', 'Jorge Salinas', 'Elena Mendoza', 'Roberto Vargas', 'Carmen Aguilar', 'Diego Ramírez', 'Sofía Navarro', 'Andrés Castillo'];
const categories = ['Literatura', 'Tecnología', 'Historia', 'Matemáticas', 'Ciencias', 'Arte', 'Economía', 'Filosofía'];
const names = ['María', 'Carlos', 'Sofía', 'Luis', 'Ana', 'Diego', 'Valeria', 'José', 'Daniela', 'Mateo', 'Camila', 'Javier', 'Elena', 'Andrés', 'Paula', 'Gael'];
const surnames = ['García', 'Ramírez', 'Torres', 'Hernández', 'Mendoza', 'Chávez', 'Cabrera', 'Montalvo', 'López', 'Aguilar', 'Pérez', 'Castillo'];
function isbn(i) {
  const base = `978${String(100000000 + i)}`;
  const sum = [...base].reduce((total, value, index) => total + Number(value) * (index % 2 ? 3 : 1), 0);
  return `${base}${(10 - sum % 10) % 10}`;
}
function buildSeed(now = new Date()) {
  const libros = [], ejemplares = [], usuarios = [], prestamos = [];
  for (let i = 0; i < 1000; i++) {
    libros.push({ _id: id('libro', i), titulo: `${titles[i % titles.length]} — edición ${1 + Math.floor(i / titles.length)}`, isbn: isbn(i), autores: [authors[i % authors.length], ...(i % 4 === 0 ? [authors[(i + 3) % authors.length]] : [])], categoria: categories[i % categories.length], editorial: ['Horizonte', 'Ediciones del Norte', 'Aula Abierta', 'Letras del Sur', 'Universitaria'][i % 5], anioPublicacion: 1980 + i % 41, idioma: i % 10 === 0 ? 'Inglés' : 'Español', descripcion: 'Registro sintético de demostración; no representa una ficha bibliográfica verificada.', estado: 'Activo', fechaRegistro: new Date(now - 800 * day) });
    usuarios.push({ _id: id('usuario', i), nombre: names[i % names.length], apellidos: `${surnames[Math.floor(i / names.length) % surnames.length]} ${surnames[(i + 5) % surnames.length]}`, matricula: `BT-DEMO-${String(i + 1).padStart(5, '0')}`, correo: `lector${i + 1}@bibliotrack.example`, telefono: `614${String(1000000 + i)}`, tipoUsuario: ['Estudiante', 'Docente', 'Administrativo', 'Externo'][i % 4], estado: i >= 900 ? 'Inactivo' : 'Activo', fechaRegistro: new Date(now - 800 * day) });
    // 550 devueltos, 50 cancelados, 250 activos y 150 vencidos.
    const estado = i < 550 ? 'Devuelto' : i < 600 ? 'Cancelado' : i < 850 ? 'Activo' : 'Vencido';
    const abierto = ['Activo', 'Vencido'].includes(estado);
    const inicio = new Date(now - (abierto ? (estado === 'Activo' ? 5 : 35) : 60 + i % 650) * day);
    const vencimiento = new Date(inicio.getTime() + (estado === 'Activo' ? 6 + i % 14 : 14) * day);
    const devolucion = estado === 'Devuelto' ? new Date(inicio.getTime() + (i % 3 === 0 ? 20 : 10) * day) : null;
    ejemplares.push({ _id: id('ejemplar', i), codigoEjemplar: `BT-DEMO-E${String(i + 1).padStart(5, '0')}`, libroId: id('libro', i % 900), estado: abierto ? 'Prestado' : i % 20 === 0 ? 'En reparación' : i % 31 === 0 ? 'Dado de baja' : 'Disponible', ubicacion: `Sala ${1 + i % 4} · Estante ${1 + i % 25}`, fechaAdquisicion: new Date(now - 800 * day), observaciones: 'Ejemplar de demostración' });
    const movimientos = [{ tipo: 'Creación', fecha: inicio, detalle: 'Préstamo sintético de demostración' }];
    if (estado === 'Devuelto') movimientos.push({ tipo: 'Devolución', fecha: devolucion, detalle: 'Devolución de demostración' });
    if (estado === 'Cancelado') movimientos.push({ tipo: 'Cancelación', fecha: new Date(inicio.getTime() + day), detalle: 'Solicitud duplicada de demostración' });
    // Varios préstamos para ciertos lectores; otros lectores no tienen historial.
    prestamos.push({ _id: id('prestamo', i), usuarioId: id('usuario', abierto ? i % 250 : i % 700), ejemplarId: id('ejemplar', i), fechaPrestamo: inicio, fechaVencimiento: vencimiento, fechaDevolucion: devolucion, estado, abierto, observaciones: 'Datos sintéticos para pruebas', movimientos, createdAt: inicio, updatedAt: movimientos.at(-1).fecha });
  }
  return { libros, ejemplares, usuarios, prestamos };
}
async function seed({ log = console.log } = {}) {
  const docs = buildSeed();
  const pairs = [[Libro, docs.libros], [Usuario, docs.usuarios], [Ejemplar, docs.ejemplares], [Prestamo, docs.prestamos]];
  let inserted = 0;
  await transaction(async session => {
    const counts = [];
    for (const [Model, rows] of pairs) counts.push(await Model.countDocuments({ _id: { $in: rows.map(row => row._id) } }).session(session));
    if (counts.every(n => n === 1000)) { inserted = 0; return; }
    if (counts.some(n => n > 0)) throw new Error('La carga de demostración está incompleta. No se sobrescribieron datos; revisa la integridad de los registros BT-DEMO.');
    for (const [Model, rows] of pairs) await Model.insertMany(rows, { session, ordered: true });
    inserted = 4000;
  });
  const totals = {};
  for (const [Model] of pairs) totals[Model.collection.collectionName] = await Model.countDocuments();
  log(JSON.stringify({ insertados: inserted, porColeccion: inserted ? 1000 : 0, cantidadesFinales: totals }, null, 2));
  return { inserted, totals };
}
if (require.main === module) (async () => {
  try { await connectDatabase(); await seed(); }
  catch (error) { console.error(error.message.startsWith('Configura') || error.message.startsWith('La carga') ? error.message : 'No se completó la carga. Revisa conexión, permisos y posibles valores únicos en conflicto. No se aplicaron escrituras parciales.'); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
module.exports = { seed, buildSeed, id };
