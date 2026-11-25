const mongoose = require('mongoose');
const { fail } = require('./errors');
function objectId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) fail('Identificador inválido');
  return new mongoose.Types.ObjectId(value);
}
function pagination(pagina = 1, limite = 20) {
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000) fail('Página debe estar entre 1 y 100000');
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) fail('Límite debe estar entre 1 y 100');
  return { pagina, limite, skip: (pagina - 1) * limite };
}
function date(value, name = 'Fecha') {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!value || !Number.isFinite(parsed.getTime())) fail(`${name} inválida`);
  return parsed;
}
function search(text) {
  if (typeof text !== 'string' || text.length > 150) fail('La búsqueda admite hasta 150 caracteres');
  return { $regex: text.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
}
function period(desde, hasta, required = false) {
  if (required && (!desde || !hasta)) fail('Indica desde y hasta para esta consulta');
  const range = {};
  if (desde) range.$gte = date(desde, 'Desde');
  if (hasta) range.$lt = date(hasta, 'Hasta');
  if (desde && hasta && range.$gte >= range.$lt) fail('Hasta debe ser posterior a desde');
  return range;
}
module.exports = { objectId, pagination, date, search, period };
