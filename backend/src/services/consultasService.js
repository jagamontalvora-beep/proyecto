const { Libro, Ejemplar, Usuario, Prestamo } = require('../models');
const { fail } = require('../utils/errors');
const { objectId, pagination, period } = require('../utils/validation');

const groups = {
  GAEL: 'Gael Antonio Chávez Aguilar', CARLOS: 'Carlos Guadalupe Cabrera Mendoza', JAIME: 'Jaime Gael Montalvo Ramírez'
};
const definitions = [
  ['G01', 'GAEL', 'Libros más solicitados', 'Clasifica los libros por préstamos no cancelados.'],
  ['G02', 'GAEL', 'Categorías con más préstamos', 'Suma la demanda de cada categoría.'],
  ['G03', 'GAEL', 'Autores con mayor demanda', 'Cuenta préstamos por autor; una obra compartida cuenta para cada autor.'],
  ['G04', 'GAEL', 'Disponibilidad por libro', 'Cuenta ejemplares totales, disponibles y prestados por libro.'],
  ['G05', 'GAEL', 'Disponibilidad por categoría', 'Porcentaje de ejemplares disponibles respecto al total de la categoría.'],
  ['G06', 'GAEL', 'Libros sin ejemplares', 'Encuentra títulos que no tienen ejemplares registrados.'],
  ['G07', 'GAEL', 'Libros nunca prestados', 'Encuentra libros sin préstamos efectivos, incluso si no tienen ejemplares.'],
  ['G08', 'GAEL', 'Editoriales con más libros', 'Cuenta títulos y categorías por editorial.'],
  ['G09', 'GAEL', 'Ejemplares por ubicación y estado', 'Distribuye las existencias físicas por ubicación y estado.'],
  ['G10', 'GAEL', 'Demanda de libros en un periodo', 'Clasifica títulos prestados entre desde (incluido) y hasta (excluido).', true],
  ['C01', 'CARLOS', 'Usuarios con más préstamos históricos', 'Cuenta préstamos efectivos por usuario e incluye usuarios sin actividad.'],
  ['C02', 'CARLOS', 'Usuarios con préstamos vencidos', 'Identifica lectores con préstamos abiertos vencidos y su retraso máximo.'],
  ['C03', 'CARLOS', 'Usuarios que siempre devuelven a tiempo', 'Exige al menos una devolución, ninguna devolución tardía y ningún vencido abierto.'],
  ['C04', 'CARLOS', 'Usuarios con devoluciones tardías', 'Clasifica usuarios por devoluciones posteriores al vencimiento.'],
  ['C05', 'CARLOS', 'Promedio de préstamos por tipo', 'Promedia préstamos históricos entre todos los usuarios de cada tipo, incluidos los inactivos sin actividad.'],
  ['C06', 'CARLOS', 'Usuarios sin préstamos', 'Identifica usuarios sin préstamos efectivos.'],
  ['C07', 'CARLOS', 'Historial completo de un usuario', 'Relaciona préstamos, ejemplares y títulos; incluye cancelaciones y movimientos.', false, true],
  ['C08', 'CARLOS', 'Usuarios con más préstamos activos', 'Cuenta préstamos abiertos, incluidos los vencidos.'],
  ['C09', 'CARLOS', 'Actividad de usuarios en un periodo', 'Cuenta préstamos iniciados por usuario dentro del periodo solicitado.', true],
  ['C10', 'CARLOS', 'Comparación de actividad por tipo', 'Compara usuarios, préstamos, abiertos, vencidos y devueltos por tipo.'],
  ['J01', 'JAIME', 'Vencidos por días de retraso', 'Agrupa préstamos por días completos transcurridos después del vencimiento.'],
  ['J02', 'JAIME', 'Ejemplares próximos a vencer', 'Lista préstamos abiertos que vencerán en los próximos siete días.'],
  ['J03', 'JAIME', 'Duración promedio de préstamos', 'Calcula días reales de duración de préstamos devueltos por categoría.'],
  ['J04', 'JAIME', 'Préstamos por mes', 'Cuenta préstamos efectivos por mes UTC de inicio.'],
  ['J05', 'JAIME', 'Porcentaje de devoluciones puntuales', 'Compara devoluciones a tiempo y tardías sobre el total devuelto.'],
  ['J06', 'JAIME', 'Ejemplares con mayor rotación', 'Clasifica ejemplares por préstamos efectivos.'],
  ['J07', 'JAIME', 'Usuarios con varios préstamos activos', 'Encuentra usuarios con más de un préstamo abierto.'],
  ['J08', 'JAIME', 'Préstamos activos por categoría', 'Cuenta préstamos abiertos y vencidos por categoría.'],
  ['J09', 'JAIME', 'Libros más solicitados en el último año', 'Clasifica libros por préstamos de los últimos doce meses.'],
  ['J10', 'JAIME', 'Tendencia de préstamos y devoluciones', 'Compara inicios y devoluciones por su propio mes UTC.']
];
const catalogo = definitions.map(([codigo, grupo, nombre, descripcion, requierePeriodo = false, requiereUsuario = false]) => ({ codigo, grupo, responsable: groups[grupo], nombre, descripcion, requierePeriodo, requiereUsuario }));
const lookup = (from, localField, as, foreignField = '_id') => ({ $lookup: { from, localField, foreignField, as } });
const joinBook = () => [lookup('ejemplares', 'ejemplarId', 'ejemplar'), { $unwind: '$ejemplar' }, lookup('libros', 'ejemplar.libroId', 'libro'), { $unwind: '$libro' }];
const joinUser = () => [lookup('usuarios', 'usuarioId', 'usuario'), { $unwind: '$usuario' }];
const fullName = { $concat: ['$usuario.nombre', ' ', '$usuario.apellidos'] };
const effective = { $match: { estado: { $ne: 'Cancelado' } } };
const rank = field => ({ $sort: { [field]: -1, _id: 1 } });
const loansByUser = () => [{ $lookup: { from: 'prestamos', let: { uid: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$usuarioId', '$$uid'] }, { $ne: ['$estado', 'Cancelado'] }] } } }], as: 'prestamos' } }];
const statusExpression = now => ({ $cond: ['$abierto', { $cond: [{ $lt: ['$fechaVencimiento', now] }, 'Vencido', 'Activo'] }, '$estado'] });
function pipelineFor(codigo, args = {}, now = new Date()) {
  const meta = catalogo.find(c => c.codigo === codigo);
  if (!meta) fail('Consulta avanzada desconocida');
  const rango = period(args.desde, args.hasta, meta.requierePeriodo);
  const filterPeriod = Object.keys(rango).length ? [{ $match: { fechaPrestamo: rango } }] : [];
  const overdue = { $and: ['$abierto', { $lt: ['$fechaVencimiento', now] }] };
  const openMatch = { $match: { abierto: true } };
  const overdueMatch = { $match: { abierto: true, fechaVencimiento: { $lt: now } } };
  const bookRank = [...joinBook(), { $group: { _id: '$libro._id', titulo: { $first: '$libro.titulo' }, prestamos: { $sum: 1 } } }, rank('prestamos')];
  const userRank = [{ $group: { _id: '$usuarioId', prestamos: { $sum: 1 } } }, lookup('usuarios', '_id', 'usuario'), { $unwind: '$usuario' }, { $project: { nombre: fullName, matricula: '$usuario.matricula', prestamos: 1 } }, rank('prestamos')];
  const detail = [...joinBook(), ...joinUser(), { $project: { titulo: '$libro.titulo', codigoEjemplar: '$ejemplar.codigoEjemplar', usuario: fullName, matricula: '$usuario.matricula', fechaPrestamo: 1, fechaVencimiento: 1, fechaDevolucion: 1, estado: statusExpression(now), movimientos: 1 } }];
  let Model = Prestamo;
  let pipeline;
  switch (codigo) {
    case 'G01': pipeline = [effective, ...bookRank]; break;
    case 'G02': pipeline = [effective, ...joinBook(), { $group: { _id: '$libro.categoria', prestamos: { $sum: 1 } } }, rank('prestamos')]; break;
    case 'G03': pipeline = [effective, ...joinBook(), { $unwind: '$libro.autores' }, { $group: { _id: '$libro.autores', prestamos: { $sum: 1 }, libros: { $addToSet: '$libro._id' } } }, { $addFields: { titulos: { $size: '$libros' } } }, { $project: { libros: 0 } }, rank('prestamos')]; break;
    case 'G04':
      Model = Libro;
      pipeline = [lookup('ejemplares', '_id', 'ejemplares', 'libroId'), { $project: { titulo: 1, total: { $size: '$ejemplares' }, disponibles: { $size: { $filter: { input: '$ejemplares', as: 'e', cond: { $eq: ['$$e.estado', 'Disponible'] } } } }, prestados: { $size: { $filter: { input: '$ejemplares', as: 'e', cond: { $eq: ['$$e.estado', 'Prestado'] } } } } } }, rank('total')]; break;
    case 'G05':
      Model = Ejemplar;
      pipeline = [lookup('libros', 'libroId', 'libro'), { $unwind: '$libro' }, { $group: { _id: '$libro.categoria', total: { $sum: 1 }, disponibles: { $sum: { $cond: [{ $eq: ['$estado', 'Disponible'] }, 1, 0] } } } }, { $addFields: { porcentajeDisponible: { $round: [{ $multiply: [{ $divide: ['$disponibles', '$total'] }, 100] }, 2] } } }, rank('porcentajeDisponible')]; break;
    case 'G06':
      Model = Libro;
      pipeline = [lookup('ejemplares', '_id', 'ejemplares', 'libroId'), { $match: { ejemplares: { $size: 0 } } }, { $project: { titulo: 1, isbn: 1, categoria: 1 } }, { $sort: { titulo: 1, _id: 1 } }]; break;
    case 'G07':
      Model = Libro;
      pipeline = [lookup('ejemplares', '_id', 'ejemplares', 'libroId'), { $lookup: { from: 'prestamos', let: { ids: '$ejemplares._id' }, pipeline: [{ $match: { $expr: { $and: [{ $in: ['$ejemplarId', '$$ids'] }, { $ne: ['$estado', 'Cancelado'] }] } } }, { $limit: 1 }], as: 'uso' } }, { $match: { uso: { $size: 0 } } }, { $project: { titulo: 1, isbn: 1 } }, { $sort: { titulo: 1, _id: 1 } }]; break;
    case 'G08':
      Model = Libro;
      pipeline = [{ $group: { _id: '$editorial', libros: { $sum: 1 }, categorias: { $addToSet: '$categoria' } } }, rank('libros')]; break;
    case 'G09':
      Model = Ejemplar;
      pipeline = [{ $group: { _id: { ubicacion: '$ubicacion', estado: '$estado' }, cantidad: { $sum: 1 } } }, { $sort: { '_id.ubicacion': 1, '_id.estado': 1 } }]; break;
    case 'G10': pipeline = [effective, ...filterPeriod, ...bookRank]; break;
    case 'C01':
      Model = Usuario;
      pipeline = [...loansByUser(), { $project: { nombre: 1, apellidos: 1, matricula: 1, prestamos: { $size: '$prestamos' } } }, rank('prestamos')]; break;
    case 'C02':
      pipeline = [overdueMatch, { $group: { _id: '$usuarioId', vencidos: { $sum: 1 }, retrasoMaximoDias: { $max: { $dateDiff: { startDate: '$fechaVencimiento', endDate: now, unit: 'day' } } } } }, lookup('usuarios', '_id', 'usuario'), { $unwind: '$usuario' }, { $project: { nombre: fullName, matricula: '$usuario.matricula', vencidos: 1, retrasoMaximoDias: 1 } }, rank('vencidos')]; break;
    case 'C03':
      Model = Usuario;
      pipeline = [...loansByUser(), { $addFields: {
        devueltos: { $size: { $filter: { input: '$prestamos', as: 'p', cond: { $eq: ['$$p.estado', 'Devuelto'] } } } },
        problemas: { $size: { $filter: { input: '$prestamos', as: 'p', cond: { $or: [{ $and: [{ $eq: ['$$p.estado', 'Devuelto'] }, { $gt: ['$$p.fechaDevolucion', '$$p.fechaVencimiento'] }] }, { $and: ['$$p.abierto', { $lt: ['$$p.fechaVencimiento', now] }] }] } } } }
      } }, { $match: { devueltos: { $gt: 0 }, problemas: 0 } }, { $project: { nombre: 1, apellidos: 1, matricula: 1, devueltos: 1 } }, rank('devueltos')]; break;
    case 'C04': pipeline = [{ $match: { estado: 'Devuelto', $expr: { $gt: ['$fechaDevolucion', '$fechaVencimiento'] } } }, ...userRank]; break;
    case 'C05':
      Model = Usuario;
      pipeline = [...loansByUser(), { $group: { _id: '$tipoUsuario', usuarios: { $sum: 1 }, prestamos: { $sum: { $size: '$prestamos' } }, promedio: { $avg: { $size: '$prestamos' } } } }, rank('promedio')]; break;
    case 'C06':
      Model = Usuario;
      pipeline = [...loansByUser(), { $match: { prestamos: { $size: 0 } } }, { $project: { nombre: 1, apellidos: 1, matricula: 1, tipoUsuario: 1 } }, { $sort: { nombre: 1, _id: 1 } }]; break;
    case 'C07':
      if (!args.usuarioId) fail('Indica usuarioId para consultar el historial');
      pipeline = [{ $match: { usuarioId: objectId(args.usuarioId) } }, ...detail, { $sort: { fechaPrestamo: -1, _id: -1 } }]; break;
    case 'C08': pipeline = [openMatch, ...userRank]; break;
    case 'C09': pipeline = [effective, ...filterPeriod, ...userRank]; break;
    case 'C10':
      Model = Usuario;
      pipeline = [...loansByUser(), { $group: { _id: '$tipoUsuario', usuarios: { $sum: 1 }, prestamos: { $sum: { $size: '$prestamos' } }, abiertos: { $sum: { $size: { $filter: { input: '$prestamos', as: 'p', cond: '$$p.abierto' } } } }, vencidos: { $sum: { $size: { $filter: { input: '$prestamos', as: 'p', cond: { $and: ['$$p.abierto', { $lt: ['$$p.fechaVencimiento', now] }] } } } } }, devueltos: { $sum: { $size: { $filter: { input: '$prestamos', as: 'p', cond: { $eq: ['$$p.estado', 'Devuelto'] } } } } } } }, { $sort: { _id: 1 } }]; break;
    case 'J01': pipeline = [overdueMatch, { $addFields: { dias: { $floor: { $divide: [{ $subtract: [now, '$fechaVencimiento'] }, 86400000] } } } }, { $group: { _id: '$dias', prestamos: { $sum: 1 } } }, { $sort: { _id: 1 } }]; break;
    case 'J02': pipeline = [{ $match: { abierto: true, fechaVencimiento: { $gte: now, $lte: new Date(now.getTime() + 7 * 86400000) } } }, ...detail, { $sort: { fechaVencimiento: 1, _id: 1 } }]; break;
    case 'J03': pipeline = [{ $match: { estado: 'Devuelto' } }, ...joinBook(), { $group: { _id: '$libro.categoria', devueltos: { $sum: 1 }, promedioDias: { $avg: { $divide: [{ $subtract: ['$fechaDevolucion', '$fechaPrestamo'] }, 86400000] } } } }, { $sort: { _id: 1 } }]; break;
    case 'J04': pipeline = [effective, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$fechaPrestamo', timezone: 'UTC' } }, prestamos: { $sum: 1 } } }, { $sort: { _id: 1 } }]; break;
    case 'J05': pipeline = [{ $match: { estado: 'Devuelto' } }, { $group: { _id: null, total: { $sum: 1 }, aTiempo: { $sum: { $cond: [{ $lte: ['$fechaDevolucion', '$fechaVencimiento'] }, 1, 0] } }, tardias: { $sum: { $cond: [{ $gt: ['$fechaDevolucion', '$fechaVencimiento'] }, 1, 0] } } } }, { $project: { _id: 0, total: 1, aTiempo: 1, tardias: 1, porcentajeATiempo: { $multiply: [{ $divide: ['$aTiempo', '$total'] }, 100] }, porcentajeTardias: { $multiply: [{ $divide: ['$tardias', '$total'] }, 100] } } }]; break;
    case 'J06': pipeline = [effective, { $group: { _id: '$ejemplarId', prestamos: { $sum: 1 } } }, lookup('ejemplares', '_id', 'ejemplar'), { $unwind: '$ejemplar' }, lookup('libros', 'ejemplar.libroId', 'libro'), { $unwind: '$libro' }, { $project: { prestamos: 1, codigoEjemplar: '$ejemplar.codigoEjemplar', titulo: '$libro.titulo' } }, rank('prestamos')]; break;
    case 'J07': pipeline = [openMatch, ...userRank, { $match: { prestamos: { $gt: 1 } } }]; break;
    case 'J08': pipeline = [openMatch, ...joinBook(), { $group: { _id: '$libro.categoria', abiertos: { $sum: 1 }, vencidos: { $sum: { $cond: [overdue, 1, 0] } } } }, rank('abiertos')]; break;
    case 'J09': {
      const yearAgo = new Date(now); yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
      pipeline = [effective, { $match: { fechaPrestamo: { $gte: yearAgo, $lte: now } } }, ...bookRank]; break;
    }
    case 'J10': pipeline = [effective, { $facet: {
      inicios: [{ $group: { _id: { $dateToString: { format: '%Y-%m', date: '$fechaPrestamo' } }, prestamos: { $sum: 1 } } }],
      devoluciones: [{ $match: { estado: 'Devuelto' } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$fechaDevolucion' } }, devoluciones: { $sum: 1 } } }]
    } }, { $project: { filas: { $concatArrays: ['$inicios', '$devoluciones'] } } }, { $unwind: '$filas' }, { $group: { _id: '$filas._id', prestamos: { $sum: { $ifNull: ['$filas.prestamos', 0] } }, devoluciones: { $sum: { $ifNull: ['$filas.devoluciones', 0] } } } }, { $sort: { _id: 1 } }]; break;
  }
  return { Model, pipeline, meta };
}

async function consultaAvanzada(args) {
  const { pagina, limite, skip } = pagination(args.pagina, args.limite);
  const { Model, pipeline, meta } = pipelineFor(args.codigo, args);
  const [result] = await Model.aggregate([...pipeline, { $facet: { filas: [{ $skip: skip }, { $limit: limite }], conteo: [{ $count: 'total' }] } }]).option({ maxTimeMS: 15000 });
  return { consulta: meta, filas: result.filas, total: result.conteo[0]?.total || 0, pagina, limite };
}
module.exports = { catalogo, pipelineFor, consultaAvanzada };
