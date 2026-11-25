const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.(js|mjs)$/.test(entry.name) ? [path.join(dir, entry.name)] : []); }
const scripts = [...files(path.resolve(__dirname, '..')), ...files(path.resolve(__dirname, '../../frontend'))];
for (const file of scripts) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stderr || result.error); process.exit(1); }
}
const { buildSchema, validateSchema, parse, validate } = require('graphql');
const schema = buildSchema(require('../src/graphql/typeDefs'));
const errors = [...validateSchema(schema), ...validate(schema, parse(readFileSync(path.resolve(__dirname, '../examples/operaciones.graphql'), 'utf8')))];
if (errors.length) { console.error(errors); process.exit(1); }
(async () => {
  const { pathToFileURL } = require('node:url');
  const { queries, mutations } = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/js/api.mjs')).href);
  for (const [name, document] of Object.entries({ ...queries, ...mutations })) {
    const errors = validate(schema, parse(document));
    if (errors.length) throw new Error(`${name}: ${errors.map(e => e.message).join('; ')}`);
  }
  console.log(`Sintaxis correcta: ${scripts.length} archivos JavaScript. Esquema, ejemplos y ${Object.keys(queries).length + Object.keys(mutations).length} operaciones del frontend válidos.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
