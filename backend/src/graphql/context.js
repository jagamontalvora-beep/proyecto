const DataLoader = require('dataloader');
const models = require('../models');
function createContext() {
  const loaders = Object.fromEntries(Object.entries(models).map(([name, Model]) => [name, new DataLoader(async ids => {
    const docs = await Model.find({ _id: { $in: ids } });
    const byId = new Map(docs.map(doc => [String(doc._id), doc]));
    return ids.map(id => byId.get(String(id)) || null);
  }, { cacheKeyFn: String })]));
  loaders.Disponibilidad = new DataLoader(async ids => {
    const mongoose = require('mongoose');
    const rows = await models.Ejemplar.aggregate([
      { $match: { libroId: { $in: ids.map(id => new mongoose.Types.ObjectId(String(id))) } } },
      { $group: { _id: '$libroId', total: { $sum: 1 }, disponibles: { $sum: { $cond: [{ $eq: ['$estado', 'Disponible'] }, 1, 0] } }, prestados: { $sum: { $cond: [{ $eq: ['$estado', 'Prestado'] }, 1, 0] } } } }
    ]);
    const byId = new Map(rows.map(row => [String(row._id), row]));
    return ids.map(id => byId.get(String(id)) || { total: 0, disponibles: 0, prestados: 0 });
  }, { cacheKeyFn: String });
  return { loaders };
}
module.exports = { createContext };
