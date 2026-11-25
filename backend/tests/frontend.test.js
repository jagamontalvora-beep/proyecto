const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { JSDOM } = require('jsdom');
const { temporaryDatabase } = require('./database');
const { connectDatabase, mongoose } = require('../src/config/database');
const { createApp } = require('../src/index');
const { seed } = require('../scripts/seed');
const { Libro, Ejemplar, Usuario, Prestamo } = require('../src/models');

// Pruebas de componentes y eventos en un DOM de Node. No reemplazan la revisión visual en navegador.
let database, app, dom, base;
const nativeFetch = globalThis.fetch;
const originalGlobals = {};
async function waitFor(predicate, description, timeout = 10000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeout) throw new Error(`No se cumplió: ${description}. ${document.querySelector('.form-error:not([hidden])')?.textContent || ''}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
const ready = () => !document.querySelector('#content').hasAttribute('aria-busy');
const modal = () => document.querySelector('#modal');
const fill = (name, value) => { const el = modal().querySelector(`[name="${name}"]`); assert.ok(el, `Campo ${name}`); el.value = value; };
function submit(form = modal().querySelector('form')) {
  assert.equal(form.checkValidity(), true, 'Los campos deben cumplir la validación HTML');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}
async function save() { submit(); await waitFor(() => !modal().open && ready(), 'guardar y actualizar la pantalla'); }
async function navigate(hash, heading) {
  window.location.hash = hash;
  await waitFor(() => ready() && document.querySelector('h1')?.textContent.includes(heading), `navegar a ${hash}`);
}
async function choose(name, search, match) {
  const root = modal().querySelector(`[data-lookup="${name}"]`);
  root.querySelector('input[type=search]').value = search;
  root.querySelector('.lookup-search-button').click();
  await waitFor(() => [...root.querySelectorAll('.lookup-result')].some(el => el.textContent.includes(match)), `encontrar ${match}`);
  [...root.querySelectorAll('.lookup-result')].find(el => el.textContent.includes(match)).click();
  assert.ok(root.querySelector('input[type=hidden]').value);
}
before(async () => {
  database = await temporaryDatabase();
  await connectDatabase(database.getUri(), 'bibliotrack_frontend_test');
  await seed({ log: () => {} });
  app = await createApp();
  await new Promise(resolve => app.httpServer.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.httpServer.address().port}`;
  dom = new JSDOM(fs.readFileSync(path.resolve(__dirname, '../../frontend/index.html'), 'utf8'), { url: `${base}/#resumen`, pretendToBeVisual: true });
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, location: dom.window.location, FormData: dom.window.FormData, Event: dom.window.Event, CustomEvent: dom.window.CustomEvent })) {
    originalGlobals[name] = globalThis[name]; globalThis[name] = value;
  }
  // jsdom no tiene presentación de diálogos nativos; solo modelamos su estado abierto/cerrado.
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  globalThis.fetch = (url, options) => nativeFetch(new URL(url, base), options);
  await import(pathToFileURL(path.resolve(__dirname, '../../frontend/js/app.mjs')).href);
  await waitFor(() => ready() && document.querySelector('.stats-grid'), 'cargar dashboard');
}, { timeout: 120000 });
after(async () => {
  if (app) await app.apollo.stop();
  await mongoose.disconnect();
  if (database) await database.stop();
  dom?.window.close();
  globalThis.fetch = nativeFetch;
  for (const [name, value] of Object.entries(originalGlobals)) { if (value === undefined) delete globalThis[name]; else globalThis[name] = value; }
});

test('Frontend: dashboard y navegación muestran registros reales', async () => {
  assert.equal(document.querySelectorAll('.stat-card').length, 6);
  assert.match(document.querySelector('.stats-grid').textContent, /1,000/);
  assert.match(document.querySelector('#connection-status').textContent, /Conectado/);
  await navigate('catalogo', 'Catálogo');
  assert.equal(document.querySelectorAll('tbody tr').length, 10);
  document.querySelector('[data-page="2"]').click();
  await waitFor(() => ready() && document.querySelector('.page-indicator')?.textContent.startsWith('2'), 'segunda página');
  const search = document.querySelector('[data-filter-form] [name=texto]');
  search.value = 'TITULO_QUE_NO_EXISTE'; submit(document.querySelector('[data-filter-form]'));
  await waitFor(() => ready() && document.querySelector('.empty-state'), 'estado vacío de búsqueda');
  assert.match(document.querySelector('.empty-state').textContent, /No encontramos/);
  document.querySelector('[data-action=clear-filters]').click();
  await waitFor(() => ready() && document.querySelectorAll('tbody tr').length === 10, 'limpiar filtros');
});

test('Frontend: alta y edición de libro con ejemplar vinculado', async () => {
  document.querySelector('[data-action=new-book]').click();
  fill('titulo', 'Libro de interfaz QA'); fill('isbn', '9781111111111'); fill('categoria', 'Interfaz'); fill('autores', 'Ana Pruebas; Luis Pruebas'); fill('editorial', 'Pruebas'); fill('anioPublicacion', '2024');
  await save();
  assert.ok(await Libro.exists({ titulo: 'Libro de interfaz QA' }));
  const book = await Libro.findOne({ titulo: 'Libro de interfaz QA' });
  document.querySelector(`[data-action=edit-book][data-id="${book.id}"]`).click(); fill('descripcion', 'Descripción guardada desde la interfaz.'); await save();
  assert.equal((await Libro.findById(book.id)).descripcion, 'Descripción guardada desde la interfaz.');
  document.querySelector(`[data-action=book-copies][data-id="${book.id}"]`).click();
  await waitFor(() => modal().querySelector('[data-new-copy]'), 'abrir ejemplares');
  modal().querySelector('[data-new-copy]').click(); fill('codigoEjemplar', 'QA-UI-001'); fill('ubicacion', 'Sala de pruebas');
  await save();
  assert.ok(await Ejemplar.exists({ codigoEjemplar: 'QA-UI-001', libroId: book._id, estado: 'Disponible' }));
  const row = document.querySelector(`[data-action=book-copies][data-id="${book.id}"]`).closest('tr');
  assert.match(row.querySelector('.availability-cell').textContent, /1 de 1 disponibles/);
});

test('Frontend: usuario, préstamo mediante buscadores y devolución', async () => {
  await navigate('usuarios', 'Usuarios'); document.querySelector('[data-action=new-user]').click();
  fill('nombre', 'Lector'); fill('apellidos', 'Interfaz QA'); fill('matricula', 'QA-UI-LECTOR'); fill('correo', 'lector-ui@example.com');
  await save(); assert.ok(await Usuario.exists({ matricula: 'QA-UI-LECTOR' }));
  await navigate('prestamos', 'Préstamos'); document.querySelector('[data-action=new-loan]').click();
  await choose('usuarioId', 'QA-UI-LECTOR', 'QA-UI-LECTOR');
  await choose('filtroLibro', 'Libro de interfaz QA', 'Libro de interfaz QA');
  await choose('ejemplarId', 'QA-UI-001', 'QA-UI-001');
  await save();
  const user = await Usuario.findOne({ matricula: 'QA-UI-LECTOR' });
  const loan = await Prestamo.findOne({ usuarioId: user._id }); assert.equal(loan.abierto, true);
  assert.equal((await Ejemplar.findById(loan.ejemplarId)).estado, 'Prestado');
  document.querySelector(`[data-action=edit-loan][data-id="${loan.id}"]`).click(); fill('observaciones', 'Renovación revisada en interfaz.'); await save();
  assert.equal((await Prestamo.findById(loan.id)).observaciones, 'Renovación revisada en interfaz.');
  document.querySelector(`[data-action=return-loan][data-id="${loan.id}"]`).click(); await save();
  assert.equal((await Prestamo.findById(loan.id)).estado, 'Devuelto');
  assert.equal((await Ejemplar.findById(loan.ejemplarId)).estado, 'Disponible');
  await navigate('usuarios', 'Usuarios'); document.querySelector(`[data-action=user-history][data-id="${user.id}"]`).click();
  await waitFor(() => modal().textContent.includes('Devuelto'), 'historial de devolución');
  modal().querySelector('[data-detail]').click();
  await waitFor(() => modal().textContent.includes('Renovación revisada en interfaz.'), 'historial de movimientos');
  modal().close();
});

test('Frontend: eliminación rechazada conserva datos y muestra el motivo', async () => {
  await navigate('catalogo', 'Catálogo');
  const book = await Libro.findOne({ titulo: 'Libro de interfaz QA' });
  document.querySelector(`[data-action=delete-book][data-id="${book.id}"]`).click(); submit();
  await waitFor(() => modal().querySelector('.form-error:not([hidden])'), 'error de integridad');
  assert.match(modal().querySelector('.form-error').textContent, /registros asociados/);
  assert.ok(await Libro.exists({ _id: book._id })); modal().close();
});

test('Frontend: consultas de los tres integrantes, paginación y validación de periodo', async () => {
  await navigate('consultas', 'Consultas avanzadas');
  assert.equal(document.querySelectorAll('[data-report-code]').length, 10);
  submit(document.querySelector('#report-form'));
  await waitFor(() => document.querySelector('#report-result tbody tr'), 'ejecutar G01');
  assert.equal(document.querySelectorAll('#report-result tbody tr').length, 10);
  document.querySelector('#report-result [data-page="2"]').click();
  await waitFor(() => document.querySelector('#report-result .page-indicator')?.textContent.startsWith('2'), 'paginar informe');
  document.querySelector('[data-report-code=G10]').click();
  document.querySelector('[name=desde]').value = '2026-12-01'; document.querySelector('[name=hasta]').value = '2026-01-01'; submit(document.querySelector('#report-form'));
  assert.match(document.querySelector('#report-result').textContent, /fecha final/);
  document.querySelector('[data-report-group=CARLOS]').click(); document.querySelector('[data-report-code=C05]').click(); submit(document.querySelector('#report-form'));
  await waitFor(() => document.querySelector('#report-result tbody tr'), 'ejecutar C05');
  assert.match(document.querySelector('#report-result').textContent, /Estudiante/);
  document.querySelector('[data-report-group=JAIME]').click(); document.querySelector('[data-report-code=J05]').click(); submit(document.querySelector('#report-form'));
  await waitFor(() => document.querySelector('#report-result tbody tr'), 'ejecutar J05');
  assert.match(document.querySelector('#report-result').textContent, /A tiempo/);
});
