const { mongoose, text, options } = require('./common');
const schema = new mongoose.Schema({
  titulo: text(true),
  isbn: { ...text(true, 32), unique: true, match: [/^[0-9Xx-]{10,20}$/, 'ISBN debe tener entre 10 y 20 caracteres numéricos, guiones o X'] },
  autores: { type: [text(true, 150)], required: true, validate: { validator: v => v.length > 0 && v.length <= 30, message: 'Indica entre 1 y 30 autores' } },
  categoria: { ...text(true, 100), index: true },
  editorial: text(true, 150),
  anioPublicacion: { type: Number, required: true, min: 1000, validate: { validator: value => Number.isInteger(value) && value <= new Date().getUTCFullYear() + 1, message: 'El año debe ser entero y no superar el próximo año' } },
  idioma: { ...text(true, 60), default: 'Español' },
  descripcion: text(false, 4000),
  fechaRegistro: { type: Date, default: Date.now },
  estado: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo', required: true }
}, options);
schema.index({ titulo: 'text', autores: 'text' }, { default_language: 'spanish' });
module.exports = mongoose.model('Libro', schema, 'libros');
