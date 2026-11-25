const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

function findShell() {
  if (process.env.MONGOSH_BIN) return process.env.MONGOSH_BIN;
  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const root = path.join(programFiles, 'MongoDB', 'Server');
    if (fs.existsSync(root)) {
      const installed = fs.readdirSync(root).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map(version => path.join(root, version, 'bin', 'mongosh.exe')).find(file => fs.existsSync(file));
      if (installed) return installed;
    }
    const separate = path.join(programFiles, 'mongosh', 'mongosh.exe');
    if (fs.existsSync(separate)) return separate;
  }
  return 'mongosh';
}

async function runGenerator() {
  if (!process.env.MONGODB_URI) throw new Error('Configura MONGODB_URI en BiblioTrack/.env.');
  // La URI se transmite por el entorno, nunca como argumento ni en los registros.
  try {
    const { stdout } = await promisify(execFile)(findShell(), [
      '--nodb', '--quiet', '--eval',
      '(async function () { db = await connect(process.env.MONGODB_URI); await load(process.env.BIBLIOTRACK_SEED_SCRIPT); })();'
    ], {
      env: { ...process.env, BIBLIOTRACK_SEED_SCRIPT: path.join(__dirname, 'generar-datos.mongosh.js') },
      windowsHide: true, timeout: 120000, maxBuffer: 2000000
    });
    // Solo mostrar el resumen conocido del generador, sin metadatos de conexión.
    const summary = stdout.split(/\r?\n/).filter(line => /^(Base:|Documentos nuevos:|La carga ya existe\.|libros:|usuarios:|ejemplares:|prestamos:|Préstamos abiertos:|Ejemplares prestados:)/.test(line));
    if (!summary.length) throw new Error('SIN_RESUMEN');
    console.log(summary.join('\n'));
  } catch (error) {
    const diagnostic = `${error.stdout || ''}\n${error.stderr || ''}`;
    let message = 'No se pudo completar la carga. Comprueba la conexión de Atlas y los permisos del usuario.';
    if (error.code === 'ENOENT') message = 'No se encontró mongosh. Instálalo o configura MONGOSH_BIN con la ruta del ejecutable.';
    else if (/E11000/.test(diagnostic)) message = 'Hay un ISBN, correo, matrícula o código duplicado. La transacción revirtió las inserciones de este intento; no se borró ningún registro previo.';
    else if (/carga previa incompleta/.test(diagnostic)) message = 'Esta carga ya tiene algunos documentos, pero no todos. No se modificaron registros; revisa la carga incompleta.';
    else if (/AuthenticationFailed|authentication failed|bad auth/i.test(diagnostic)) message = 'Atlas rechazó la autenticación. Revisa usuario y contraseña en .env.';
    else if (/Se requiere MongoDB Atlas/.test(diagnostic)) message = 'La URI de .env debe apuntar a Atlas o a un replica set.';
    else if (error.killed) message = 'La ejecución excedió el tiempo de espera. Vuelve a ejecutar el comando para comprobar si la carga ya se completó.';
    else if (error.message === 'SIN_RESUMEN') message = 'La consola terminó sin el resumen esperado. Comprueba las cantidades antes de continuar.';
    throw new Error(message);
  }
}
if (require.main === module) runGenerator().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { runGenerator };
