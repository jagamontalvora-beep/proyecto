const { GraphQLScalarType, Kind, valueFromASTUntyped } = require('graphql');
const { date } = require('../utils/validation');
const { fail } = require('../utils/errors');
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value)) fail('Usa fecha ISO 8601 con hora y zona, por ejemplo 2026-11-23T12:00:00Z');
  const ymd = value.slice(0, 10);
  if (date(`${ymd}T00:00:00Z`).toISOString().slice(0, 10) !== ymd) fail('Fecha de calendario inválida');
  return date(value);
}
const DateTime = new GraphQLScalarType({
  name: 'DateTime', description: 'Fecha ISO 8601 con zona horaria; se devuelve en UTC.',
  serialize: value => date(value).toISOString(), parseValue: parseDate,
  parseLiteral: ast => { if (ast.kind !== Kind.STRING) fail('La fecha debe ser una cadena ISO'); return parseDate(ast.value); }
});
const JSONScalar = new GraphQLScalarType({
  name: 'JSON', description: 'Fila de una agregación, con ObjectId y fechas serializados como cadenas.',
  serialize: value => JSON.parse(JSON.stringify(value)), parseValue: value => value,
  parseLiteral: ast => valueFromASTUntyped(ast)
});
module.exports = { DateTime, JSON: JSONScalar };
