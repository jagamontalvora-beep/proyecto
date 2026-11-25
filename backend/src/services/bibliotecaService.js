const { mongoose } = require('../config/database');
const { Libro, Ejemplar, Usuario, Prestamo } = require('../models');
const { fail } = require('../utils/errors');
const { objectId, pagination, search, date, period } = require('../utils/validation');

const transaction = work => mongoose.connection.transaction(work, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
async function get(Model, id, session) {
  const doc = await Model.findById(objectId(id)).session(session || null);
  if (!doc) fail(`${Model.modelName} no encontrado`, 'NOT_FOUND');
  return doc;
}
// Escribir la versión del padre serializa crear dependencias contra eliminar/desactivar.
async function lock(Model, id, session) {
  const doc = await Model.findOneAndUpdate({ _id: objectId(id) }, { $inc: { __v: 1 } }, { returnDocument: 'after', session });
  if (!doc) fail(`${Model.modelName} no encontrado`, 'NOT_FOUND');
  return doc;
}
function estadoPrestamo(doc, now = new Date()) {
  return doc.abierto ? (doc.fechaVencimiento < now ? 'Vencido' : 'Activo') : doc.estado;
}
function estadoFilter(estado, now = new Date()) {
  if (!estado) return {};
  if (estado === 'Activo') return { abierto: true, fechaVencimiento: { $gte: now } };
  if (estado === 'Vencido') return { abierto: true, fechaVencimiento: { $lt: now } };
  if (['Devuelto', 'Cancelado'].includes(estado)) return { estado, abierto: false };
  fail('Estado de préstamo inválido');
}
async function page(Model, filter, args = {}) {
  const { pagina, limite, skip } = pagination(args.pagina, args.limite);
  const [items, total] = await Promise.all([
    Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limite),
    Model.countDocuments(filter)
  ]);
  return { items, total, pagina, limite, paginas: Math.ceil(total / limite) };
}
function textFilter(texto, fields) { return texto ? { $or: fields.map(f => ({ [f]: search(texto) })) } : {}; }

async function libros(args = {}) {
  const { texto, categoria, estado } = args;
  return page(Libro, { ...textFilter(texto, ['titulo', 'autores', 'isbn']), ...(categoria ? { categoria } : {}), ...(estado ? { estado } : {}) }, args);
}
async function usuarios(args = {}) {
  const { texto, tipoUsuario, estado } = args;
  return page(Usuario, { ...textFilter(texto, ['nombre', 'apellidos', 'matricula', 'correo']), ...(tipoUsuario ? { tipoUsuario } : {}), ...(estado ? { estado } : {}) }, args);
}
async function ejemplares(args = {}) {
  return page(Ejemplar, { ...textFilter(args.texto, ['codigoEjemplar', 'ubicacion']), ...(args.libroId ? { libroId: objectId(args.libroId) } : {}), ...(args.estado ? { estado: args.estado } : {}) }, args);
}
async function prestamos(args = {}) {
  const clauses = [estadoFilter(args.estado)];
  if (args.soloAbiertos) clauses.push({ abierto: true });
  if (args.usuarioId) clauses.push({ usuarioId: objectId(args.usuarioId) });
  if (args.ejemplarId) clauses.push({ ejemplarId: objectId(args.ejemplarId) });
  if (args.desde || args.hasta) clauses.push({ fechaPrestamo: period(args.desde, args.hasta) });
  if (args.texto) {
    const ids = await Usuario.find(textFilter(args.texto, ['nombre', 'apellidos', 'matricula'])).distinct('_id');
    clauses.push({ usuarioId: { $in: ids } });
  }
  return page(Prestamo, { $and: clauses }, args);
}

async function create(Model, input) {
  return transaction(async session => {
    if (Model === Ejemplar) {
      await lock(Libro, input.libroId, session);
      if (input.estado === 'Prestado') fail('El estado Prestado solo se asigna al crear un préstamo');
    }
    const [doc] = await Model.create([input], { session });
    return doc;
  });
}
async function update(Model, id, input) {
  if (!input || !Object.keys(input).length) fail('Indica al menos un campo para actualizar');
  return transaction(async session => {
    const doc = await lock(Model, id, session);
    if (Model === Ejemplar) {
      if (input.libroId && String(input.libroId) !== String(doc.libroId)) fail('El libro de un ejemplar no se puede reasignar; registra otro ejemplar');
      await lock(Libro, doc.libroId, session);
      const abierto = await Prestamo.exists({ ejemplarId: doc._id, abierto: true }).session(session);
      if (input.estado === 'Prestado' && !abierto) fail('Registra un préstamo para asignar el estado Prestado');
      if (abierto && input.estado && input.estado !== 'Prestado') fail('Primero registra la devolución o cancelación');
    }
    if (Model === Usuario && input.estado === 'Inactivo' && await Prestamo.exists({ usuarioId: doc._id, abierto: true }).session(session)) {
      fail('No se puede desactivar un usuario con préstamos abiertos', 'CONFLICT');
    }
    doc.set(input);
    await doc.save({ session });
    return doc;
  });
}
async function remove(Model, id) {
  return transaction(async session => {
    const doc = await lock(Model, id, session);
    let dependency;
    if (Model === Libro) dependency = await Ejemplar.exists({ libroId: doc._id }).session(session);
    if (Model === Usuario) dependency = await Prestamo.exists({ usuarioId: doc._id }).session(session);
    if (Model === Ejemplar) {
      await lock(Libro, doc.libroId, session);
      dependency = await Prestamo.exists({ ejemplarId: doc._id }).session(session);
    }
    if (dependency) fail('No se puede eliminar: tiene registros asociados. Conserva el historial usando su estado.', 'CONFLICT');
    await doc.deleteOne({ session });
    return true;
  });
}

async function crearPrestamo(input) {
  const fechaPrestamo = input.fechaPrestamo ? date(input.fechaPrestamo) : new Date();
  const fechaVencimiento = date(input.fechaVencimiento);
  if (fechaPrestamo > new Date()) fail('El préstamo no puede comenzar en el futuro');
  if (fechaVencimiento <= fechaPrestamo) fail('El vencimiento debe ser posterior al préstamo');
  return transaction(async session => {
    const usuario = await lock(Usuario, input.usuarioId, session);
    if (usuario.estado !== 'Activo') fail('El usuario está inactivo', 'CONFLICT');
    const ejemplar = await lock(Ejemplar, input.ejemplarId, session);
    const libro = await lock(Libro, ejemplar.libroId, session);
    if (libro.estado !== 'Activo') fail('El libro está inactivo', 'CONFLICT');
    if (ejemplar.estado !== 'Disponible') fail('El ejemplar no está disponible', 'CONFLICT');
    // No se permiten intervalos históricos que se solapen con movimientos previos.
    const ultimo = await Prestamo.findOne({ ejemplarId: ejemplar._id }).sort({ fechaPrestamo: -1 }).session(session);
    if (ultimo) {
      const fin = ultimo.fechaDevolucion || ultimo.movimientos.at(-1)?.fecha;
      if (ultimo.abierto || !fin || fechaPrestamo < fin) fail('La fecha se solapa con un préstamo anterior', 'CONFLICT');
    }
    ejemplar.estado = 'Prestado';
    await ejemplar.save({ session });
    const [prestamo] = await Prestamo.create([{
      ...input, fechaPrestamo, fechaVencimiento, abierto: true,
      estado: fechaVencimiento < new Date() ? 'Vencido' : 'Activo',
      movimientos: [{ tipo: 'Creación', detalle: 'Préstamo registrado' }]
    }], { session });
    return prestamo;
  });
}
async function actualizarPrestamo(id, input) {
  if (!Object.keys(input).length) fail('Indica al menos un campo para actualizar');
  return transaction(async session => {
    const doc = await lock(Prestamo, id, session);
    if (!doc.abierto) fail('El préstamo está cerrado; su historial no se puede modificar', 'CONFLICT');
    const anterior = doc.fechaVencimiento.toISOString();
    doc.set(input);
    await doc.validate();
    doc.estado = estadoPrestamo(doc);
    doc.movimientos.push({ tipo: 'Actualización', detalle: `Vencimiento: ${anterior} → ${doc.fechaVencimiento.toISOString()}. Observaciones: ${doc.observaciones || 'Sin observaciones'}` });
    await doc.save({ session });
    return doc;
  });
}
async function cerrarPrestamo(id, { cancelar = false, motivo, fechaDevolucion } = {}) {
  const fecha = fechaDevolucion ? date(fechaDevolucion) : new Date();
  if (fecha > new Date()) fail('La devolución no puede estar en el futuro');
  if (cancelar && (!motivo?.trim() || motivo.length > 2000)) fail('Indica el motivo de cancelación (máximo 2000 caracteres)');
  return transaction(async session => {
    const doc = await lock(Prestamo, id, session);
    if (!doc.abierto) fail('El préstamo ya está cerrado', 'CONFLICT');
    if (fecha < doc.fechaPrestamo) fail('La devolución no puede ser anterior al préstamo');
    const ejemplar = await lock(Ejemplar, doc.ejemplarId, session);
    if (ejemplar.estado !== 'Prestado') fail('El ejemplar tiene un estado inconsistente', 'CONFLICT');
    ejemplar.estado = 'Disponible';
    await ejemplar.save({ session });
    doc.abierto = false;
    doc.estado = cancelar ? 'Cancelado' : 'Devuelto';
    doc.fechaDevolucion = cancelar ? null : fecha;
    doc.movimientos.push({ tipo: cancelar ? 'Cancelación' : 'Devolución', detalle: cancelar ? motivo.trim() : `Devuelto el ${fecha.toISOString()}` });
    await doc.save({ session });
    return doc;
  });
}

async function estadisticasGenerales() {
  const now = new Date();
  const hasta = new Date(now.getTime() + 7 * 86400000);
  const [totalLibros, totalEjemplares, totalUsuarios, disponibles, abiertos, vencidos, proximos, ultimos, disponibilidad] = await Promise.all([
    Libro.countDocuments(), Ejemplar.countDocuments(), Usuario.countDocuments(),
    Ejemplar.countDocuments({ estado: 'Disponible' }), Prestamo.countDocuments({ abierto: true }),
    Prestamo.countDocuments({ abierto: true, fechaVencimiento: { $lt: now } }),
    Prestamo.find({ abierto: true, fechaVencimiento: { $gte: now, $lte: hasta } }).sort({ fechaVencimiento: 1, _id: 1 }).limit(10),
    Prestamo.aggregate([{ $unwind: '$movimientos' }, { $sort: { 'movimientos.fecha': -1, _id: -1 } }, { $limit: 10 }, { $project: { _id: 0, prestamoId: '$_id', usuarioId: 1, ejemplarId: 1, tipo: '$movimientos.tipo', fecha: '$movimientos.fecha', detalle: '$movimientos.detalle' } }]),
    Ejemplar.aggregate([{ $group: { _id: '$estado', cantidad: { $sum: 1 } } }, { $sort: { _id: 1 } }])
  ]);
  return { totalLibros, totalEjemplares, totalUsuarios, ejemplaresDisponibles: disponibles,
    prestamosActivos: abiertos, prestamosVencidos: vencidos, proximosAVencer: proximos,
    ultimosMovimientos: ultimos, disponibilidad: disponibilidad.map(v => ({ estado: v._id, cantidad: v.cantidad })) };
}

module.exports = { get, lock, transaction, estadoPrestamo, libros, usuarios, ejemplares, prestamos, create, update, remove,
  crearPrestamo, actualizarPrestamo, cerrarPrestamo, estadisticasGenerales };
