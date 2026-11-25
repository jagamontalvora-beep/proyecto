// Ejecutar en mongosh conectado a tu cluster, NO con node.
// Inserta datos sintéticos sin borrar ni modificar registros existentes.
(async function () {
  const NOMBRE_BD = 'bibliotrack';
  const CANTIDAD = 1000;
  const AHORA = new Date();
  const DIA = 86400000;
  const bd = db.getSiblingDB(NOMBRE_BD);
  const fecha = dias => new Date(AHORA.getTime() + dias * DIA);
  const rellenar = n => String(n + 1).padStart(6, '0');
  // No cambies estos prefijos: identifican esta carga en ejecuciones posteriores.
  const prefijos = { libros: 'b17b1001', usuarios: 'b17b1002', ejemplares: 'b17b1003', prestamos: 'b17b1004' };
  const id = (coleccion, i) => new ObjectId(prefijos[coleccion] + i.toString(16).padStart(16, '0'));
  let semilla = 20261124;
  function azar(max) {
    semilla = (Math.imul(1664525, semilla) + 1013904223) >>> 0;
    return Math.floor((semilla / 4294967296) * max);
  }
  const elegir = lista => lista[azar(lista.length)];
  function isbn(i) {
    const cuerpo = '97884' + String(1234567 + i).padStart(7, '0');
    const suma = [...cuerpo].reduce((s, n, k) => s + Number(n) * (k % 2 ? 3 : 1), 0);
    return cuerpo + ((10 - suma % 10) % 10);
  }

  const temas = [
    ['Literatura', 'la narrativa latinoamericana'],
    ['Ciencias', 'la biología celular'],
    ['Tecnología', 'la programación'],
    ['Historia', 'la historia de México'],
    ['Matemáticas', 'el cálculo diferencial'],
    ['Arte', 'la fotografía'],
    ['Medicina', 'la anatomía humana'],
    ['Derecho', 'el derecho civil'],
    ['Economía', 'las finanzas'],
    ['Filosofía', 'la ética']
  ];
  const nombres = ['Ana', 'Carlos', 'Sofía', 'Diego', 'Elena', 'Luis', 'María', 'Javier', 'Lucía', 'Miguel', 'Valeria', 'Andrés'];
  const apellidos = ['García', 'Ramírez', 'Torres', 'Hernández', 'Mendoza', 'Chávez', 'Cabrera', 'Montalvo', 'López', 'Aguilar', 'Rivera', 'Castillo'];
  const editoriales = ['Horizonte', 'Aula Abierta', 'Ediciones del Norte', 'Letras del Sur', 'Editorial Universitaria'];
  const tipos = ['Estudiante', 'Docente', 'Administrativo', 'Externo'];
  const datos = { libros: [], usuarios: [], ejemplares: [], prestamos: [] };

  // LIBROS Y USUARIOS
  for (let i = 0; i < CANTIDAD; i++) {
    const [categoria, tema] = elegir(temas);
    const registroLibro = fecha(-1200 - azar(300));
    const registroUsuario = fecha(-900 - azar(100));
    datos.libros.push({
      _id: id('libros', i),
      titulo: `${elegir(['Introducción a', 'Estudios sobre', 'Lecturas sobre'])} ${tema} — volumen ${i + 1}`,
      isbn: isbn(i),
      autores: [`${elegir(nombres)} ${elegir(apellidos)}`],
      categoria, editorial: elegir(editoriales),
      anioPublicacion: NumberInt(AHORA.getUTCFullYear() - 5 - azar(35)),
      idioma: i % 10 === 0 ? 'Inglés' : 'Español',
      descripcion: 'Ficha sintética para pruebas; no corresponde a un catálogo bibliográfico verificado.',
      fechaRegistro: registroLibro,
      estado: i % 25 === 0 ? 'Inactivo' : 'Activo',
      createdAt: registroLibro, updatedAt: registroLibro, __v: NumberInt(0)
    });
    datos.usuarios.push({
      _id: id('usuarios', i),
      nombre: elegir(nombres),
      apellidos: `${elegir(apellidos)} ${elegir(apellidos)}`,
      matricula: `BT-MSH-U${rellenar(i)}`,
      correo: `lector${i + 1}@bibliotrack.example`,
      telefono: '614' + String(1000000 + i),
      tipoUsuario: tipos[i % tipos.length],
      fechaRegistro: registroUsuario,
      estado: i % 20 === 0 ? 'Inactivo' : 'Activo',
      createdAt: registroUsuario, updatedAt: registroUsuario, __v: NumberInt(0)
    });
  }
  const librosActivos = datos.libros.filter(l => l.estado === 'Activo');
  const usuariosActivos = datos.usuarios.filter(u => u.estado === 'Activo');

  // EJEMPLARES Y PRÉSTAMOS: cada préstamo usa un ejemplar distinto.
  // 70 vencidos + 130 activos + 650 devueltos + 150 cancelados.
  for (let i = 0; i < CANTIDAD; i++) {
    const estado = i < 70 ? 'Vencido' : i < 200 ? 'Activo' : i < 850 ? 'Devuelto' : 'Cancelado';
    const abierto = estado === 'Activo' || estado === 'Vencido';
    const inicio = estado === 'Activo' ? fecha(-1 - azar(6)) : estado === 'Vencido' ? fecha(-40 - azar(30)) : fecha(-100 - azar(400));
    const vencimiento = new Date(inicio.getTime() + 14 * DIA);
    const devolucion = estado === 'Devuelto' ? new Date(inicio.getTime() + (i % 3 === 0 ? 20 : 10) * DIA) : null;
    const movimientos = [{ tipo: 'Creación', fecha: inicio, detalle: 'Préstamo de demostración registrado' }];
    if (estado === 'Devuelto') movimientos.push({ tipo: 'Devolución', fecha: devolucion, detalle: 'Ejemplar de demostración devuelto' });
    if (estado === 'Cancelado') movimientos.push({ tipo: 'Cancelación', fecha: new Date(inicio.getTime() + DIA), detalle: 'Solicitud de demostración cancelada por captura duplicada' });
    const adquisicion = fecha(-800 - azar(50));
    datos.ejemplares.push({
      _id: id('ejemplares', i),
      codigoEjemplar: `BT-MSH-E${rellenar(i)}`,
      libroId: librosActivos[i % librosActivos.length]._id,
      estado: abierto ? 'Prestado' : i % 17 === 0 ? 'En reparación' : i % 23 === 0 ? 'Dado de baja' : 'Disponible',
      ubicacion: `Sala ${1 + i % 5}, Estante ${1 + i % 30}, Nivel ${1 + i % 4}`,
      fechaAdquisicion: adquisicion,
      observaciones: 'Ejemplar de demostración. Su estado actual corresponde al momento de esta carga.',
      createdAt: adquisicion, updatedAt: AHORA, __v: NumberInt(0)
    });
    datos.prestamos.push({
      _id: id('prestamos', i),
      usuarioId: usuariosActivos[abierto ? i % 120 : i % usuariosActivos.length]._id,
      ejemplarId: id('ejemplares', i),
      fechaPrestamo: inicio, fechaVencimiento: vencimiento,
      fechaDevolucion: devolucion,
      estado, abierto,
      observaciones: 'Datos sintéticos de demostración', movimientos,
      createdAt: inicio, updatedAt: movimientos[movimientos.length - 1].fecha, __v: NumberInt(0)
    });
  }

  // Se requiere Atlas o replica set; nunca realizar una carga parcial.
  const servidor = await bd.adminCommand({ hello: 1 });
  if (!servidor.setName && servidor.msg !== 'isdbgrid') throw new Error('Se requiere MongoDB Atlas o un replica set.');

  const colecciones = Object.keys(datos);
  const existentes = await bd.getCollectionNames();
  for (const nombre of colecciones) {
    if (!existentes.includes(nombre)) await bd.createCollection(nombre);
  }
  // Estos nombres y opciones son compatibles con los índices del backend.
  await bd.libros.createIndex({ isbn: 1 }, { unique: true });
  await bd.usuarios.createIndex({ matricula: 1 }, { unique: true });
  await bd.usuarios.createIndex({ correo: 1 }, { unique: true });
  await bd.ejemplares.createIndex({ codigoEjemplar: 1 }, { unique: true });
  await bd.prestamos.createIndex({ ejemplarId: 1 }, {
    unique: true,
    partialFilterExpression: { abierto: true },
    name: 'un_prestamo_abierto_por_ejemplar'
  });

  const sesion = db.getMongo().startSession();
  let insertados = 0;
  try {
    await sesion.withTransaction(async () => {
      const transaccion = sesion.getDatabase(NOMBRE_BD);
      const encontrados = [];
      for (const nombre of colecciones) {
        encontrados.push(await transaccion.getCollection(nombre).countDocuments({
          _id: { $in: datos[nombre].map(doc => doc._id) }
        }));
      }
      if (encontrados.every(n => n === CANTIDAD)) {
        insertados = 0;
        return; // Conservar también las modificaciones posteriores del usuario.
      }
      if (encontrados.some(n => n > 0)) {
        throw new Error('Se detectó una carga previa incompleta. No se modificó ningún documento; revisa los registros antes de continuar.');
      }
      for (const nombre of colecciones) {
        await transaccion.getCollection(nombre).insertMany(datos[nombre], { ordered: true });
      }
      insertados = CANTIDAD * colecciones.length;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    await sesion.endSession();
  }

  print(`Base: ${NOMBRE_BD}`);
  print(insertados ? `Documentos nuevos: ${insertados}` : 'La carga ya existe. No se insertaron duplicados ni se sobrescribieron cambios.');
  for (const nombre of colecciones) print(`${nombre}: ${await bd.getCollection(nombre).countDocuments()}`);
  print(`Préstamos abiertos: ${await bd.prestamos.countDocuments({ abierto: true })}`);
  print(`Ejemplares prestados: ${await bd.ejemplares.countDocuments({ estado: 'Prestado' })}`);
})();
