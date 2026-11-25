const { mongoose, text, options } = require('./common');
const schema = new mongoose.Schema({
  nombre: text(true, 120), apellidos: text(true, 180),
  matricula: { ...text(true, 60), unique: true },
  correo: { ...text(true, 254), lowercase: true, unique: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo inválido'] },
  telefono: { ...text(false, 30), match: [/^[+\d ()-]*$/, 'Teléfono inválido'] },
  tipoUsuario: { type: String, required: true, enum: ['Estudiante', 'Docente', 'Administrativo', 'Externo'], index: true },
  fechaRegistro: { type: Date, default: Date.now },
  estado: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo', required: true }
}, options);
schema.index({ nombre: 'text', apellidos: 'text', matricula: 'text' }, { default_language: 'spanish' });
module.exports = mongoose.model('Usuario', schema, 'usuarios');
