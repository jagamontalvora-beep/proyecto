const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const { ApolloServerPluginLandingPageLocalDefault, ApolloServerPluginLandingPageDisabled } = require('@apollo/server/plugin/landingPage/default');
const { connectDatabase, mongoose } = require('./config/database');
const typeDefs = require('./graphql/typeDefs');
const resolvers = require('./graphql/resolvers');
const { queryLimits } = require('./graphql/limits');
const graphqlRoutes = require('./routes/graphqlRoutes');

async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  const httpServer = http.createServer(app);
  const apollo = new ApolloServer({
    typeDefs, resolvers, validationRules: [queryLimits],
    introspection: process.env.NODE_ENV !== 'production',
    includeStacktraceInErrorResponses: false,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer }), process.env.NODE_ENV === 'production' ? ApolloServerPluginLandingPageDisabled() : ApolloServerPluginLandingPageLocalDefault({ embed: true, footer: false })],
    formatError: error => error.extensions?.code === 'INTERNAL_SERVER_ERROR' ? { message: 'No fue posible completar la operación.', extensions: { code: 'INTERNAL_SERVER_ERROR' } } : error
  });
  await apollo.start();
  app.get('/api', (_, res) => res.json({ nombre: 'BiblioTrack', version: '1.0.0', graphql: '/graphql', salud: '/health', documentacion: 'README.md' }));
  app.get('/health', (_, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ estado: connected ? 'ok' : 'sin_conexion', baseDeDatos: connected });
  });
  app.use('/graphql', graphqlRoutes(apollo));
  app.use(express.static(path.resolve(__dirname, '../../frontend'), { dotfiles: 'deny' }));
  app.use((_, res) => res.status(404).json({ message: 'Ruta no encontrada' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
    res.status(status).json({ message: status === 400 ? 'JSON inválido' : status === 413 ? 'Solicitud demasiado grande' : 'Error interno del servidor' });
  });
  return { app, httpServer, apollo };
}
async function start() {
  const port = Number(process.env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535');
  await connectDatabase();
  let instance;
  try {
    instance = await createApp();
    await new Promise((resolve, reject) => {
      instance.httpServer.once('error', reject);
      instance.httpServer.listen(port, process.env.HOST || '127.0.0.1', resolve);
    });
    console.log(`BiblioTrack: http://localhost:${port} | Apollo Sandbox: http://localhost:${port}/graphql`);
    let stopping = false;
    const stop = async () => { if (stopping) return; stopping = true; await instance.apollo.stop(); await mongoose.disconnect(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    return instance;
  } catch (error) {
    if (instance) await instance.apollo.stop();
    await mongoose.disconnect();
    throw error;
  }
}
if (require.main === module) start().catch(async error => {
  const config = /^(Configura MONGODB_URI|PORT debe|Se requiere MongoDB Atlas)/.test(error.message);
  console.error(config ? error.message : 'No se pudo iniciar BiblioTrack. Revisa MONGODB_URI, permisos de Atlas y disponibilidad del puerto.');
  await mongoose.disconnect(); process.exitCode = 1;
});
module.exports = { createApp, start };
