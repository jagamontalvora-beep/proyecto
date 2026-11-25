// Vista de prueba aislada para revisar la interfaz sin escribir en Atlas.
const { temporaryDatabase } = require('../tests/database');
const { connectDatabase, mongoose } = require('../src/config/database');
const { seed } = require('./seed');
const { createApp } = require('../src/index');
let database, app;
async function stop() {
  if (app) await app.apollo.stop();
  await mongoose.disconnect();
  if (database) await database.stop();
}
(async () => {
  try {
    database = await temporaryDatabase();
    await connectDatabase(database.getUri(), 'bibliotrack_ui_test');
    await seed();
    app = await createApp();
    await new Promise((resolve, reject) => {
      app.httpServer.once('error', reject);
      app.httpServer.listen(4001, '127.0.0.1', resolve);
    });
    console.log('Vista de prueba con MongoDB temporal: http://localhost:4001');
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  } catch {
    console.error('No se pudo iniciar la vista de prueba. Revisa el puerto 4001 y la instalación de MongoDB.');
    await stop(); process.exitCode = 1;
  }
})();
