const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
mongoose.set('bufferCommands', false);
mongoose.set('autoCreate', false);
mongoose.set('autoIndex', false);

async function connectDatabase(uri = process.env.MONGODB_URI, dbName = 'bibliotrack') {
  if (!uri) throw new Error('Configura MONGODB_URI en BiblioTrack/.env. Consulta .env.example.');
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error('Se requiere MongoDB Atlas o un replica set para garantizar transacciones.');
  }
  await Promise.all(Object.values(require('../models')).map(async Model => {
    await Model.createCollection();
    await Model.createIndexes();
  }));
  return mongoose.connection;
}

module.exports = { connectDatabase, mongoose };
