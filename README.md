# BiblioTrack — sistema de gestión bibliotecaria

Aplicación administrativa de préstamos bibliotecarios con frontend HTML5, CSS3 y JavaScript, conectado mediante Fetch a GraphQL. Express sirve la interfaz y la API en un solo proceso. El backend conserva `src/index.js`, `src/models/` y `src/routes/`, como el proyecto de referencia, añadiendo servicios y GraphQL.

## Interfaz

- **Resumen:** seis indicadores reales, disponibilidad por estado, préstamos próximos a vencer, últimos movimientos y accesos rápidos.
- **Catálogo:** búsqueda por título, autor o ISBN, categorías obtenidas de MongoDB, edición y eliminación de libros, registro y administración de ejemplares, disponibilidad completa por título.
- **Usuarios:** registro, edición, eliminación, búsqueda, filtros por tipo y estado e historial individual de préstamos.
- **Préstamos:** selección de lector, búsqueda de libro y ejemplar disponible, creación, edición de vencimiento, devolución, cancelación con motivo e historial de movimientos.
- **Consultas avanzadas:** las 30 agregaciones agrupadas por Gael, Carlos y Jaime, con selección de usuario o periodo cuando corresponde y resultados paginados.

La navegación se adapta a pantallas pequeñas. Hay formularios en modales, indicadores de carga, estados vacíos, confirmación de eliminación, mensajes de error, notificaciones y actualización de datos después de las operaciones. La interfaz utiliza azul marino, turquesa, dorado, coral y tonos claros. No requiere compilación, frameworks de frontend ni otro servidor.

## Requisitos y ejecución

- Node.js 22.12 o posterior; también compatible con Node.js 24 y 26.
- npm.
- MongoDB Atlas, o MongoDB 7+ configurado como replica set. Un servidor standalone se rechaza porque no permite garantizar las transacciones necesarias.

Desde PowerShell:

```powershell
cd C:\PROYE\BiblioTrack
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edita `.env` y configura `MONGODB_URI` con tu conexión de Atlas. No se incluyeron ni reutilizaron credenciales del ZIP. La aplicación selecciona la base `bibliotrack` explícitamente.

```dotenv
MONGODB_URI=mongodb+srv://USUARIO:CONTRASENA_CODIFICADA@TU_CLUSTER/bibliotrack
PORT=4000
HOST=127.0.0.1
CORS_ORIGINS=http://localhost:4000,http://127.0.0.1:4000,https://studio.apollographql.com
NODE_ENV=development
```

Sustituye los marcadores por los datos reales. En Atlas configura un usuario de base de datos con permisos de lectura/escritura sobre `bibliotrack` y autoriza la IP de tu equipo. Copia la cadena de conexión del controlador Node.js y codifica los caracteres especiales de la contraseña. Consulta la [documentación de conexión de Atlas](https://www.mongodb.com/docs/atlas/connect-your-application/).

```powershell
npm run seed   # Opcional: inserta 1,000 documentos por colección
npm start
```

Si quieres ejecutar el archivo `backend/scripts/generar-datos.mongosh.js` y la consola de Compass indica que `load()` no está implementado, usa `npm run seed:mongosh` desde la terminal de VS Code, en la carpeta del proyecto. Este comando abre el mongosh instalado en el equipo y toma la conexión de `.env` sin imprimirla. Usa este generador o `npm run seed` como alternativas, no ambos. El ejecutor se comprobó en una base temporal: la primera ejecución insertó 4,000 documentos y la segunda no duplicó registros.

- `http://localhost:4000/`: interfaz de BiblioTrack.
- `http://localhost:4000/api`: información del backend en JSON.
- `http://localhost:4000/graphql`: Apollo Sandbox en desarrollo.
- `POST http://localhost:4000/graphql`: operaciones GraphQL.
- `http://localhost:4000/health`: estado de conexión; responde 503 si MongoDB no está conectado.
- `npm run dev`: reinicio automático cuando cambian archivos.

Si ya tenías el backend ejecutándose antes de agregar el frontend, detenlo con Ctrl+C y vuelve a ejecutar `npm start`. Abre la dirección anterior, no el archivo `index.html` directamente. El frontend envía todas las operaciones a `/graphql`, por lo que los formularios usan la misma base que el backend.

La base de datos de uso normal es **`bibliotrack`**, definida explícitamente en `backend/src/config/database.js`. El nombre tiene prioridad sobre cualquier base indicada en la URI. No se utiliza una base llamada `Bib`. `.env` se mantiene exclusivamente en el servidor y no se sirve al navegador.

Para revisar la interfaz con datos de demostración sin escribir en Atlas, usa `npm run preview:test` y abre `http://localhost:4001`. Este modo usa un proceso MongoDB temporal con base `bibliotrack_ui_test`; sus registros no se guardan en Atlas. Finaliza con Ctrl+C. El puerto 4000 corresponde al uso normal y el 4001 a esta vista de prueba.

El servidor escucha solamente en la interfaz local por defecto. Esta versión no incorpora autenticación ni roles administrativos y está orientada a desarrollo local. `NODE_ENV=production` deshabilita Sandbox e introspección; no agrega autenticación.

## Estructura

```text
BiblioTrack/
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── config/database.js
│   │   ├── models/
│   │   │   ├── libro.js
│   │   │   ├── ejemplar.js
│   │   │   ├── usuario.js
│   │   │   ├── prestamo.js
│   │   │   ├── common.js
│   │   │   └── index.js
│   │   ├── routes/graphqlRoutes.js
│   │   ├── graphql/
│   │   │   ├── typeDefs.js
│   │   │   ├── resolvers.js
│   │   │   ├── scalars.js
│   │   │   ├── context.js
│   │   │   └── limits.js
│   │   ├── services/
│   │   │   ├── bibliotecaService.js
│   │   │   └── consultasService.js
│   │   └── utils/
│   │       ├── errors.js
│   │       └── validation.js
│   ├── scripts/
│   │   ├── seed.js
│   │   ├── check.js
│   │   └── preview-test.js
│   ├── examples/operaciones.graphql
│   └── tests/
│       ├── database.js
│       ├── frontend.test.js
│       └── integration.test.js
├── frontend/
│   ├── index.html
│   ├── assets/brand.svg
│   ├── css/styles.css
│   └── js/
│       ├── api.mjs
│       ├── app.mjs
│       ├── dashboard.mjs
│       ├── forms.mjs
│       ├── reports.mjs
│       └── ui.mjs
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

Se utiliza un solo `package.json` en la raíz. Las colecciones son exactamente `libros`, `ejemplares`, `usuarios` y `prestamos`; las relaciones se guardan como ObjectId. Los movimientos se conservan dentro de cada préstamo, sin una quinta colección. Mongoose añade `createdAt`, `updatedAt` y `__v`; `abierto` es un campo interno del préstamo que respalda la restricción de unicidad.

## Operaciones disponibles

Queries:

- `libros`, `libro`, `buscarLibros`, `categoriasLibros`.
- `ejemplares`, `ejemplar`, `ejemplaresDisponibles`.
- `usuarios`, `usuario`, `buscarUsuarios`.
- `prestamos`, `prestamo`, `prestamosActivos`, `prestamosVencidos`, `historialUsuario`.
- `estadisticasGenerales`, `consultasAvanzadas`, `consultaAvanzada`.

Mutations:

- `crearLibro`, `actualizarLibro`, `eliminarLibro`.
- `crearEjemplar`, `actualizarEjemplar`, `eliminarEjemplar`.
- `crearUsuario`, `actualizarUsuario`, `eliminarUsuario`.
- `crearPrestamo`, `actualizarPrestamo`, `registrarDevolucion`, `cancelarPrestamo`.

Las listas devuelven `items`, `total`, `pagina`, `limite` y `paginas`. Por defecto se consultan 20 registros; el límite máximo es 100. Las consultas unitarias de identificadores inexistentes devuelven `NOT_FOUND`.

`texto` busca coincidencias parciales, sin distinguir mayúsculas. En libros busca título, autores o ISBN; en usuarios, nombre, apellidos, matrícula o correo. En préstamos busca al usuario por nombre, apellidos o matrícula. También hay filtros por categoría, tipo de usuario, estado, libro, usuario y ejemplar según la colección. Los caracteres de expresiones regulares se tratan como texto literal.

Las relaciones anidadas se resuelven desde MongoDB. DataLoader agrupa las lecturas de referencias dentro de cada solicitud. No hay datos de respuesta simulados.

`Libro.disponibilidad` devuelve `total`, `disponibles` y `prestados` mediante una agregación agrupada, sin limitar el conteo a los ejemplares de una página.

## Reglas de negocio

- Solo se presta un ejemplar `Disponible`, de un libro `Activo`, a un usuario `Activo` existente.
- `Prestado` se asigna mediante `crearPrestamo`; no se puede forzar desde el CRUD de ejemplares.
- Préstamo y ejemplar se modifican en una misma transacción. Un índice único parcial impide dos préstamos abiertos para el mismo ejemplar, incluso con solicitudes simultáneas.
- Las escrituras sobre padres también se serializan para evitar referencias huérfanas cuando otra solicitud intenta eliminar un registro.
- La devolución cierra el préstamo y libera el ejemplar. No se puede devolver dos veces ni registrar fechas futuras o anteriores al préstamo.
- La cancelación requiere motivo y usa el estado adicional `Cancelado`. Conserva el historial, libera el ejemplar y no se contabiliza como devolución.
- Se pueden modificar vencimiento y observaciones de un préstamo abierto; se registra el cambio. Usuario, ejemplar y fecha de inicio no se reasignan. Los préstamos cerrados son históricos y no se editan ni eliminan.
- Se bloquea eliminar libros con ejemplares, y usuarios o ejemplares con cualquier historial de préstamos. También se bloquea desactivar usuarios con préstamos abiertos. Usa los estados para conservar registros con relaciones.
- El vencimiento se calcula en cada lectura a partir de `fechaVencimiento`, por lo que no depende de un cron. El estado almacenado `Activo`/`Vencido` puede quedar desactualizado por el paso del tiempo; el resultado de GraphQL, filtros y reportes siempre usa la fecha actual.
- `prestamosActivos` y el contador `prestamosActivos` incluyen todos los abiertos, también vencidos. `prestamos(estado:"Activo")` devuelve exclusivamente abiertos no vencidos. `prestamosVencidos` es el subconjunto abierto con fecha anterior al momento de consulta.
- Se exige formato ISO 8601 con hora y zona (`2026-11-23T12:00:00Z`). Los periodos incluyen `desde` y excluyen `hasta`; los meses de las agregaciones usan UTC.

Los errores GraphQL usan códigos `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT` o `INTERNAL_SERVER_ERROR`. No se devuelven trazas ni cadenas de conexión. Se limita el cuerpo JSON a 100 KB, las consultas de datos a 10 niveles y 300 campos, y las agregaciones avanzadas a 15 segundos. Los campos modificables están definidos explícitamente en los inputs GraphQL.

## Datos de demostración

`npm run seed` inserta 1,000 libros, 1,000 ejemplares, 1,000 usuarios y 1,000 préstamos. Los datos son sintéticos, con títulos, personas y editoriales de demostración; no representan un catálogo bibliográfico verificado.

Los préstamos iniciales son 550 devueltos, 50 cancelados, 250 activos y 150 vencidos. Las fechas se calculan respecto al momento de ejecución y sus estados cambian naturalmente con el tiempo. Se incluyen libros sin ejemplares, usuarios sin actividad, lectores con varios préstamos, devoluciones tardías y diferentes ubicaciones.

La carga utiliza identificadores deterministas y una transacción para los 4,000 documentos:

- Primera ejecución: inserta todo y muestra cantidades finales.
- Ejecuciones posteriores: detecta los 4,000 registros de demostración y no los vuelve a insertar ni modifica cambios posteriores.
- Si faltan algunos registros de una carga previa, se detiene sin sobrescribir ni recrear parcialmente el historial. Hay que revisar los registros de demostración afectados.
- Si algún valor único entra en conflicto, se revierte toda la carga. No borra datos existentes ni vacía colecciones.

## Consultas avanzadas

Cada consulta tiene código, responsable, nombre, descripción y requisitos de parámetros. Las filas son JSON porque cada agregación tiene columnas distintas. ObjectId y fechas se serializan como cadenas. Los resultados incluyen total y paginación.

| Código | Gael Antonio Chávez Aguilar — catálogo |
| --- | --- |
| G01 | Libros más solicitados |
| G02 | Categorías con más préstamos |
| G03 | Autores con mayor demanda |
| G04 | Disponibilidad por libro |
| G05 | Porcentaje de disponibilidad por categoría |
| G06 | Libros sin ejemplares |
| G07 | Libros nunca prestados |
| G08 | Editoriales con más libros |
| G09 | Ejemplares por ubicación y estado |
| G10 | Demanda de libros en un periodo |

| Código | Carlos Guadalupe Cabrera Mendoza — usuarios |
| --- | --- |
| C01 | Usuarios con más préstamos históricos |
| C02 | Usuarios con préstamos vencidos |
| C03 | Usuarios que siempre devuelven a tiempo |
| C04 | Usuarios con devoluciones tardías |
| C05 | Promedio de préstamos por tipo |
| C06 | Usuarios sin préstamos |
| C07 | Historial completo de un usuario |
| C08 | Usuarios con más préstamos activos |
| C09 | Actividad de usuarios en un periodo |
| C10 | Comparación de actividad por tipo |

| Código | Jaime Gael Montalvo Ramírez — seguimiento |
| --- | --- |
| J01 | Vencidos por días completos de retraso |
| J02 | Ejemplares que vencen en los próximos siete días |
| J03 | Duración promedio de préstamos devueltos |
| J04 | Préstamos por mes |
| J05 | Porcentaje de devoluciones puntuales y tardías |
| J06 | Ejemplares con mayor rotación |
| J07 | Usuarios con varios préstamos activos |
| J08 | Préstamos activos por categoría |
| J09 | Libros más solicitados en los últimos doce meses |
| J10 | Tendencia mensual de préstamos y devoluciones |

G10 y C09 requieren `desde` y `hasta`. C07 requiere `usuarioId`. Los demás reportes tienen el alcance descrito en su catálogo; no aplican los parámetros opcionales de periodo. Los cancelados se excluyen de las estadísticas de demanda, pero permanecen en los historiales. C03 exige al menos una devolución y excluye usuarios con devoluciones tardías o vencidos abiertos. C05 incluye usuarios sin préstamos en el denominador.

En el formulario visual de periodos, ambas fechas elegidas incluyen el día completo en la zona horaria del navegador. El frontend transforma la fecha final al inicio del día siguiente para respetar el intervalo exclusivo de la API.

## Probar con Apollo Sandbox

Abre `/graphql` con el servidor iniciado, pega una operación de `backend/examples/operaciones.graphql` y presiona Run. Para operaciones con variables, agrega el objeto JSON en Variables. Usa los identificadores devueltos por el servidor; no escribas IDs inventados.

Ejemplo básico:

```graphql
query Catalogo {
  libros(pagina: 1, limite: 10) {
    total
    items { id titulo autores categoria ejemplares { total items { id codigoEjemplar estado } } }
  }
  consultasAvanzadas(grupo: GAEL) { codigo nombre descripcion }
}
```

Ejemplo desde JavaScript, preparado para el futuro frontend:

```javascript
const response = await fetch('/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'query($texto:String!){buscarLibros(texto:$texto){total items{id titulo}}}',
    variables: { texto: 'programación' }
  })
});
const result = await response.json();
if (result.errors) throw new Error(result.errors.map(e => e.message).join('; '));
console.log(result.data);
```

## Verificación automatizada

```powershell
npm run check
npm test
```

`check` revisa la sintaxis de los archivos JavaScript del backend y frontend y valida el esquema GraphQL, los ejemplos y las 22 operaciones utilizadas por la interfaz. Las pruebas ejecutan un proceso **mongod real** con WiredTiger y replica set temporal, inician Express/Apollo en un puerto local libre y realizan solicitudes HTTP. No utilizan Atlas ni modifican tu base `bibliotrack`.

En Windows se detecta MongoDB instalado en `Program Files/MongoDB/Server`. También puedes configurar `MONGOMS_SYSTEM_BINARY` con la ruta a `mongod`. Si no existe uno local, el ejecutor de pruebas necesita descargar un binario de MongoDB a `.cache/mongodb`. Al terminar, se detienen el servidor y la base temporal.

Las pruebas cubren CRUD, relaciones, validaciones, restricciones de borrado, devolución, cancelación, vencimientos, solicitudes simultáneas de distintos usuarios, reversión transaccional, carga idempotente, errores HTTP, introspección de Sandbox, las 30 agregaciones y estadísticas contrastadas con MongoDB.

`frontend.test.js` usa un DOM aislado de Node con jsdom para comprobar navegación, búsqueda, paginación, alta y edición de libro, registro de ejemplar y usuario, selección mediante buscadores, préstamo, devolución, historial, mensajes de integridad y consultas de los tres integrantes. Los eventos del frontend realizan solicitudes HTTP al mismo backend temporal. El estado de apertura/cierre del diálogo se representa en el entorno de pruebas; no se verifica el dibujo de diálogos nativos ni la distribución visual del navegador.

Verificación de esta entrega: **48 pruebas aprobadas**, 30 archivos JavaScript con sintaxis válida y 22 operaciones del frontend compatibles con el esquema. La revisión visual de escritorio/celular queda pendiente: la herramienta de navegador no estuvo disponible y el control de Chrome se detuvo al no poder confirmar la URL. Esto no se presenta como una prueba visual superada.

La conexión real a Atlas requiere configurar `MONGODB_URI`; las pruebas automatizadas se ejecutan de manera independiente. Los 4,000 documentos usados en las pruebas son temporales; ejecuta `npm run seed` para cargarlos en tu propia base si deseas datos de demostración.

## Dependencias

Express 5, Apollo Server 5 con `@as-integrations/express5`, GraphQL 16, Mongoose 9, dotenv, cors y DataLoader. Para pruebas se usan `mongodb-memory-server-core` y `jsdom`. `package-lock.json` fija las versiones instaladas. El navegador usa módulos nativos de JavaScript sin dependencias externas.

Se fija `@graphql-tools/utils` a `12.0.2` mediante `overrides` para corregir el aviso GHSA-c4qx-w738-7hr3 de la versión transitiva instalada por Apollo. La integración se verifica con la misma suite de pruebas. Referencias: [integración oficial de Apollo](https://www.apollographql.com/docs/apollo-server/integrations/integration-index) y [transacciones de Mongoose](https://mongoosejs.com/docs/transactions.html).
