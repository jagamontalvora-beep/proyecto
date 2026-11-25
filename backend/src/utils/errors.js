const { GraphQLError } = require('graphql');
const fail = (message, code = 'BAD_USER_INPUT') => { throw new GraphQLError(message, { extensions: { code } }); };
function safeError(error) {
  if (error instanceof GraphQLError) return error;
  if (error.code === 11000) return new GraphQLError('Ya existe un registro con ese ISBN, matrícula, correo, código o préstamo abierto.', { extensions: { code: 'CONFLICT' } });
  if (['ValidationError', 'CastError', 'StrictModeError'].includes(error.name)) {
    const message = error.name === 'ValidationError' ? Object.values(error.errors).map(e => e.message).join('; ') : 'Campo o identificador inválido';
    return new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
  }
  if (error.name === 'VersionError') return new GraphQLError('El registro cambió; vuelve a consultar e intenta de nuevo.', { extensions: { code: 'CONFLICT' } });
  // No devolver errores del driver, URI, stack ni credenciales al cliente.
  return new GraphQLError('No fue posible completar la operación.', { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
}
const guarded = fn => async (...args) => { try { return await fn(...args); } catch (error) { throw safeError(error); } };
module.exports = { fail, safeError, guarded };
