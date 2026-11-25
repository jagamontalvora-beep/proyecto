const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { MongoMemoryReplSet } = require('mongodb-memory-server-core');
async function temporaryDatabase() {
  let systemBinary = process.env.MONGOMS_SYSTEM_BINARY;
  if (!systemBinary && process.platform === 'win32') {
    const root = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MongoDB', 'Server');
    if (fs.existsSync(root)) {
      systemBinary = fs.readdirSync(root).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map(version => path.join(root, version, 'bin', 'mongod.exe')).find(file => fs.existsSync(file));
    }
  }
  const binary = { downloadDir: path.resolve(__dirname, '../../.cache/mongodb') };
  if (systemBinary) {
    binary.systemBinary = systemBinary;
    binary.version = execFileSync(systemBinary, ['--version'], { encoding: 'utf8', windowsHide: true }).match(/db version v([\d.]+)/)[1];
  }
  // Es un proceso mongod real con WiredTiger y replica set; nunca sustituye MongoDB por arreglos.
  return MongoMemoryReplSet.create({ binary, replSet: { count: 1, storageEngine: 'wiredTiger' }, spawn: { windowsHide: true } });
}
module.exports = { temporaryDatabase };
