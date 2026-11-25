const models = require('../models');
const service = require('../services/bibliotecaService');
const reports = require('../services/consultasService');
const { guarded } = require('../utils/errors');
const scalars = require('./scalars');
const Query = {
  categoriasLibros: async () => (await models.Libro.distinct('categoria')).sort((a, b) => a.localeCompare(b, 'es')),
  libros: (_, args) => service.libros(args), buscarLibros: (_, args) => service.libros(args),
  libro: (_, { id }) => service.get(models.Libro, id),
  ejemplares: (_, args) => service.ejemplares(args),
  ejemplaresDisponibles: (_, args) => service.ejemplares({ ...args, estado: 'Disponible' }),
  ejemplar: (_, { id }) => service.get(models.Ejemplar, id),
  usuarios: (_, args) => service.usuarios(args), buscarUsuarios: (_, args) => service.usuarios(args),
  usuario: (_, { id }) => service.get(models.Usuario, id),
  prestamos: (_, args) => service.prestamos(args),
  prestamo: (_, { id }) => service.get(models.Prestamo, id),
  prestamosActivos: (_, args) => service.prestamos({ ...args, soloAbiertos: true }),
  prestamosVencidos: (_, args) => service.prestamos({ ...args, estado: 'Vencido' }),
  historialUsuario: async (_, args) => { await service.get(models.Usuario, args.usuarioId); return service.prestamos(args); },
  estadisticasGenerales: () => service.estadisticasGenerales(),
  consultasAvanzadas: (_, { grupo }) => reports.catalogo.filter(c => !grupo || c.grupo === grupo),
  consultaAvanzada: (_, args) => reports.consultaAvanzada(args)
};
const Mutation = {
  crearPrestamo: (_, { input }) => service.crearPrestamo(input),
  actualizarPrestamo: (_, { id, input }) => service.actualizarPrestamo(id, input),
  registrarDevolucion: (_, { id, fechaDevolucion }) => service.cerrarPrestamo(id, { fechaDevolucion }),
  cancelarPrestamo: (_, { id, motivo }) => service.cerrarPrestamo(id, { cancelar: true, motivo })
};
for (const name of ['Libro', 'Ejemplar', 'Usuario']) {
  Mutation[`crear${name}`] = (_, { input }) => service.create(models[name], input);
  Mutation[`actualizar${name}`] = (_, { id, input }) => service.update(models[name], id, input);
  Mutation[`eliminar${name}`] = (_, { id }) => service.remove(models[name], id);
}
const protect = object => Object.fromEntries(Object.entries(object).map(([key, fn]) => [key, guarded(fn)]));
module.exports = {
  ...scalars, Query: protect(Query),
  Mutation: protect(Object.fromEntries(Object.entries(Mutation).map(([name, fn]) => [name, async (parent, args, context) => {
    const result = await fn(parent, args, context);
    // Varias mutations de una misma solicitud se ejecutan en serie: invalidar lecturas previas.
    Object.values(context.loaders).forEach(loader => loader.clearAll());
    return result;
  }]))),
  Libro: protect({ ejemplares: (doc, args) => service.ejemplares({ ...args, libroId: doc.id }), disponibilidad: (doc, _, ctx) => ctx.loaders.Disponibilidad.load(doc.id) }),
  Usuario: protect({ historial: (doc, args) => service.prestamos({ ...args, usuarioId: doc.id }) }),
  Ejemplar: protect({ libro: (doc, _, ctx) => ctx.loaders.Libro.load(doc.libroId) }),
  Prestamo: protect({ estado: doc => service.estadoPrestamo(doc), usuario: (doc, _, ctx) => ctx.loaders.Usuario.load(doc.usuarioId), ejemplar: (doc, _, ctx) => ctx.loaders.Ejemplar.load(doc.ejemplarId) })
};
