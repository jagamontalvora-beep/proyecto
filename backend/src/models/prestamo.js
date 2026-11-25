const { mongoose, text, options, ref } = require('./common');
const movimiento = new mongoose.Schema({
  tipo: { type: String, enum: ['Creación', 'Actualización', 'Devolución', 'Cancelación'], required: true },
  fecha: { type: Date, default: Date.now },
  detalle: text(true, 2500)
}, { _id: false });
const schema = new mongoose.Schema({
  usuarioId: ref('Usuario'), ejemplarId: ref('Ejemplar'),
  fechaPrestamo: { type: Date, default: Date.now, required: true },
  fechaVencimiento: { type: Date, required: true, index: true },
  fechaDevolucion: { type: Date, default: null },
  estado: { type: String, enum: ['Activo', 'Devuelto', 'Vencido', 'Cancelado'], default: 'Activo', required: true },
  abierto: { type: Boolean, default: true, required: true },
  observaciones: text(false, 2000),
  movimientos: { type: [movimiento], default: [] }
}, options);
schema.index({ ejemplarId: 1 }, { unique: true, partialFilterExpression: { abierto: true }, name: 'un_prestamo_abierto_por_ejemplar' });
schema.index({ usuarioId: 1, abierto: 1 });
schema.index({ abierto: 1, fechaVencimiento: 1 });
schema.pre('validate', function () {
  if (this.fechaVencimiento <= this.fechaPrestamo) this.invalidate('fechaVencimiento', 'Debe ser posterior al préstamo');
  if (this.fechaDevolucion && this.fechaDevolucion < this.fechaPrestamo) this.invalidate('fechaDevolucion', 'No puede ser anterior al préstamo');
  if (this.abierto !== ['Activo', 'Vencido'].includes(this.estado)) this.invalidate('estado', 'Estado incompatible con la apertura del préstamo');
  if ((this.estado === 'Devuelto') !== Boolean(this.fechaDevolucion)) this.invalidate('fechaDevolucion', 'Solo un préstamo devuelto debe tener fecha de devolución');
});
module.exports = mongoose.model('Prestamo', schema, 'prestamos');
