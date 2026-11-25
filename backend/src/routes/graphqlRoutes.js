const express = require('express');
const cors = require('cors');
const { expressMiddleware } = require('@as-integrations/express5');
const { createContext } = require('../graphql/context');
function graphqlRoutes(apollo) {
  const router = express.Router();
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:4000,http://127.0.0.1:4000,https://studio.apollographql.com').split(',').map(v => v.trim());
  router.use(cors({ origin: (origin, done) => done(null, !origin || origins.includes(origin)) }));
  router.use(express.json({ limit: '100kb' }));
  router.use(expressMiddleware(apollo, { context: async () => createContext() }));
  return router;
}
module.exports = graphqlRoutes;
