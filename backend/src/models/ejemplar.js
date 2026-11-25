const { mongoose, text, options, ref } = require('./common');
const schema = new mongoose.Schema({
  codigoEjemplar: { ...text(true, 80), unique: true },
  libroId: ref('Libro'),
  estado: { type: String, enum: ['Disponible', 'Prestado', 'En reparación', 'Dado de baja'], default: 'Disponible', required: true },
  ubicacion: text(true, 150),
  fechaAdquisicion: { type: Date, default: Date.now, required: true },
  observaciones: text(false, 2000)
}, options);
schema.index({ libroId: 1, estado: 1 });
module.exports = mongoose.model('Ejemplar', schema, 'ejemplares');
