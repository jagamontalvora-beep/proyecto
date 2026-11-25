import { request, queries } from './api.mjs';
import { escape as e, icon, number, badge, date, initials, fullName, loading, empty, errorPanel, pagination, table, actionButton, toast } from './ui.mjs';
import { heading, newButton, refreshButton, dashboardMarkup } from './dashboard.mjs';
import { editBook, editUser, editCopy, newLoan, editLoan, returnLoan, cancelLoan, deleteEntity, bookCopies, userHistory, loanDetail } from './forms.mjs';
import { mountReports } from './reports.mjs';

const content = document.querySelector('#content');
const states = {
  catalogo: { tab: 'libros', texto: '', categoria: '', estado: '', pagina: 1, limite: 10 },
  usuarios: { texto: '', tipoUsuario: '', estado: '', pagina: 1, limite: 10 },
  prestamos: { texto: '', estado: '', pagina: 1, limite: 10 }
};
const titles = { resumen: 'Resumen', catalogo: 'Catálogo', usuarios: 'Usuarios', prestamos: 'Préstamos', consultas: 'Consultas avanzadas' };
let route = 'resumen', revision = 0, records = new Map();
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
function navigate(hash) {
  if (location.hash === `#${hash}`) routeChanged(); else location.hash = hash;
}
function routeChanged() {
  const [name, search = ''] = location.hash.slice(1).split('?');
  route = Object.hasOwn(titles, name) ? name : 'resumen';
  const params = new URLSearchParams(search), state = states[route];
  if (state) {
    for (const key of ['texto', 'categoria', 'estado', 'tipoUsuario']) if (params.has(key)) state[key] = params.get(key);
    if (route === 'catalogo' && params.has('tab')) state.tab = params.get('tab') === 'ejemplares' ? 'ejemplares' : 'libros';
    state.pagina = 1;
  }
  document.querySelectorAll('[data-route]').forEach(link => {
    const active = link.dataset.route === route; link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  document.querySelector('#breadcrumb-current').textContent = titles[route];
  document.title = `${titles[route]} · BiblioTrack`;
  setMenu(false); render();
}
function setMenu(open) {
  document.querySelector('#sidebar').classList.toggle('open', open);
  document.querySelector('#sidebar-overlay').hidden = !open;
  document.querySelector('#menu-toggle').setAttribute('aria-expanded', String(open));
  document.querySelector('#menu-toggle').setAttribute('aria-label', open ? 'Cerrar navegación' : 'Abrir navegación');
}
document.querySelector('#menu-toggle').onclick = () => setMenu(!document.querySelector('#sidebar').classList.contains('open'));
document.querySelector('#sidebar-overlay').onclick = () => setMenu(false);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('#modal').open) setMenu(false); });
document.querySelector('#global-search').onsubmit = event => { event.preventDefault(); const texto = new FormData(event.target).get('texto').trim(); states.catalogo = { ...states.catalogo, categoria: '', estado: '', tab: 'libros' }; navigate(`catalogo?texto=${encodeURIComponent(texto)}`); };
window.addEventListener('hashchange', routeChanged);
window.addEventListener('bibliotrack:connection', event => {
  const status = document.querySelector('#connection-status');
  status.className = `connection-status ${event.detail ? 'online' : 'offline'}`;
  status.innerHTML = `<span></span>${event.detail ? 'Conectado' : 'Sin conexión'}`;
  status.title = event.detail ? 'Conectado a la biblioteca' : 'No hay conexión con el servidor';
});
window.addEventListener('bibliotrack:changed', () => { render(); if (route !== 'resumen') updateNavCount(); });
async function updateNavCount() {
  try { const { estadisticasGenerales } = await request('query { estadisticasGenerales { prestamosVencidos } }'); setNavCount(estadisticasGenerales.prestamosVencidos); } catch { /* El panel principal muestra los errores de conexión. */ }
}
function setNavCount(count) { const el = document.querySelector('#nav-overdue'); el.hidden = !count; el.textContent = number(count); el.title = `${number(count)} préstamos vencidos`; }
const options = (values, selected, placeholder) => `<option value="">${e(placeholder)}</option>${values.map(v => `<option value="${e(v)}" ${selected === v ? 'selected' : ''}>${e(v)}</option>`).join('')}`;
function searchInput(value, placeholder) {
  return `<label class="search-field">${icon('search')}<span class="sr-only">${e(placeholder)}</span><input type="search" name="texto" value="${e(value)}" placeholder="${e(placeholder)}" maxlength="150"></label>`;
}
function dropdown(name, label, values, selected, placeholder) { return `<label><span class="sr-only">${label}</span><select name="${name}" aria-label="${label}">${options(values, selected, placeholder)}</select></label>`; }
const toolbarEnd = '<button type="submit" class="button button-secondary">Buscar</button><button type="button" class="filter-reset" data-action="clear-filters">Limpiar filtros</button>';
const moduleFooter = owner => `<div class="module-footer">${icon('users')}Responsable del módulo: ${e(owner)}</div>`;
const standardEmpty = (title, description, action = '') => empty(title, description, action);
function storeRows(rows) { records = new Map(rows.map(row => [row.id, row])); }

function catalogueMarkup(data, categories) {
  const s = states.catalogo, books = s.tab === 'libros';
  const filtered = Boolean(s.texto || s.estado || (books && s.categoria));
  const rows = books ? data.items.map((b, index) => `<tr><td><div class="book-cell"><span class="book-cover ${['teal', 'gold', 'coral', ''][index % 4]}">${icon('book')}</span><div><strong class="cell-title">${e(b.titulo)}</strong><span class="cell-secondary">ISBN ${e(b.isbn)}</span></div></div></td><td>${e(b.autores.join(', '))}<span class="cell-secondary">${e(b.editorial)} · ${b.anioPublicacion}</span></td><td>${badge(b.categoria)}</td><td><div class="availability-cell"><strong>${b.disponibilidad.disponibles}</strong> de ${b.disponibilidad.total} disponibles<div class="mini-progress"><span style="width:${b.disponibilidad.total ? b.disponibilidad.disponibles / b.disponibilidad.total * 100 : 0}%"></span></div></div></td><td>${badge(b.estado)}</td><td><div class="row-actions"><button class="button button-text" type="button" data-action="book-copies" data-id="${b.id}">Ejemplares</button>${actionButton('edit-book', b.id, `Editar ${b.titulo}`, 'edit')}${actionButton('delete-book', b.id, `Eliminar ${b.titulo}`, 'trash', 'danger')}</div></td></tr>`) : data.items.map(c => `<tr><td><strong>${e(c.codigoEjemplar)}</strong><span class="cell-secondary">${date(c.fechaAdquisicion)}</span></td><td><strong class="cell-title">${e(c.libro.titulo)}</strong><span class="cell-secondary">${e(c.libro.autores.join(', '))}</span></td><td>${e(c.ubicacion)}</td><td>${badge(c.estado)}</td><td><div class="row-actions">${actionButton('edit-copy', c.id, `Editar ${c.codigoEjemplar}`, 'edit')}${actionButton('delete-copy', c.id, `Eliminar ${c.codigoEjemplar}`, 'trash', 'danger')}</div></td></tr>`);
  return `${heading('COLECCIÓN Y DISPONIBILIDAD', 'Catálogo de la biblioteca', 'Organiza tus libros y encuentra el ejemplar que necesitas.', `${refreshButton()}${newButton(books ? 'new-book' : 'new-copy', books ? 'Registrar libro' : 'Registrar ejemplar')}`)}<div class="tabs" aria-label="Secciones del catálogo"><button type="button" class="tab ${books ? 'active' : ''}" aria-pressed="${books}" data-catalog-tab="libros">${icon('book')}Libros</button><button type="button" class="tab ${!books ? 'active' : ''}" aria-pressed="${!books}" data-catalog-tab="ejemplares">${icon('box')}Ejemplares</button></div><section class="card"><form class="toolbar" data-filter-form>${searchInput(s.texto, books ? 'Buscar por título, autor o ISBN…' : 'Buscar por código o ubicación…')}${books ? dropdown('categoria', 'Filtrar por categoría', categories, s.categoria, 'Todas las categorías') : ''}${dropdown('estado', 'Filtrar por estado', books ? ['Activo', 'Inactivo'] : ['Disponible', 'Prestado', 'En reparación', 'Dado de baja'], s.estado, 'Todos los estados')}${toolbarEnd}</form>${rows.length ? table(books ? ['Libro', 'Autores / editorial', 'Categoría', 'Disponibilidad', 'Estado', 'Acciones'] : ['Ejemplar', 'Libro', 'Ubicación', 'Estado', 'Acciones'], rows, books ? 'Catálogo de libros' : 'Catálogo de ejemplares') + pagination(data) : standardEmpty(filtered ? 'No encontramos coincidencias' : books ? 'Tu colección empieza con un libro' : 'Registra tu primer ejemplar', filtered ? 'Prueba otra búsqueda o limpia los filtros.' : books ? 'Agrega un título y después registra sus copias físicas.' : 'Elige un libro del catálogo y registra una copia física.', filtered ? '<button type="button" class="button button-secondary" data-action="clear-filters">Limpiar filtros</button>' : newButton(books ? 'new-book' : 'new-copy', books ? 'Registrar libro' : 'Registrar ejemplar'))}</section><datalist id="category-suggestions">${categories.map(c => `<option value="${e(c)}"></option>`).join('')}</datalist>${moduleFooter('Gael Antonio Chávez Aguilar')}`;
}
function usersMarkup(data) {
  const s = states.usuarios, filtered = s.texto || s.tipoUsuario || s.estado;
  return `${heading('COMUNIDAD DE LECTORES', 'Usuarios de la biblioteca', 'Conoce a tus lectores y acompaña su historial de préstamos.', `${refreshButton()}${newButton('new-user', 'Registrar usuario')}`)}<section class="card"><form class="toolbar" data-filter-form>${searchInput(s.texto, 'Buscar por nombre, matrícula o correo…')}${dropdown('tipoUsuario', 'Filtrar por tipo de usuario', ['Estudiante','Docente','Administrativo','Externo'], s.tipoUsuario, 'Todos los tipos')}${dropdown('estado', 'Filtrar por estado', ['Activo','Inactivo'], s.estado, 'Todos los estados')}${toolbarEnd}</form>${data.items.length ? table(['Usuario', 'Contacto', 'Tipo', 'Estado', 'Acciones'], data.items.map(u => `<tr><td><div class="person-cell"><span class="avatar">${e(initials(u))}</span><div><strong class="cell-title">${e(fullName(u))}</strong><span class="cell-secondary">${e(u.matricula)}</span></div></div></td><td>${e(u.correo)}<span class="cell-secondary">${e(u.telefono || 'Sin teléfono registrado')}</span></td><td>${badge(u.tipoUsuario)}</td><td>${badge(u.estado)}</td><td><div class="row-actions"><button type="button" class="button button-text" data-action="user-history" data-id="${u.id}">Historial</button>${actionButton('edit-user', u.id, `Editar ${fullName(u)}`, 'edit')}${actionButton('delete-user', u.id, `Eliminar ${fullName(u)}`, 'trash', 'danger')}</div></td></tr>`), 'Usuarios registrados') + pagination(data) : standardEmpty(filtered ? 'No encontramos usuarios' : 'Tu comunidad empieza aquí', filtered ? 'Cambia la búsqueda o los filtros para ver otros resultados.' : 'Registra al primer lector para comenzar a prestar libros.', filtered ? '' : newButton('new-user', 'Registrar usuario'))}</section>${moduleFooter('Carlos Guadalupe Cabrera Mendoza')}`;
}
function loansMarkup(data) {
  const s = states.prestamos;
  return `${heading('CIRCULACIÓN Y SEGUIMIENTO', 'Préstamos de la biblioteca', 'Un seguimiento claro, desde la entrega hasta la devolución.', `${refreshButton()}${newButton('new-loan', 'Nuevo préstamo')}`)}<div class="loan-summary" aria-label="Filtrar préstamos por estado">${[['','Todos'],['Activo','Activos'],['Vencido','Vencidos'],['Devuelto','Devueltos'],['Cancelado','Cancelados']].map(([value,label]) => `<button type="button" class="button ${s.estado === value ? 'active' : ''}" data-loan-state="${value}" aria-pressed="${s.estado === value}">${label}</button>`).join('')}</div><section class="card"><form class="toolbar" data-filter-form>${searchInput(s.texto, 'Buscar por nombre o matrícula del lector…')}${toolbarEnd}</form>${data.items.length ? table(['Libro / ejemplar', 'Usuario', 'Fecha del préstamo', 'Vencimiento', 'Estado', 'Acciones'], data.items.map(p => `<tr><td><strong class="cell-title">${e(p.ejemplar.libro.titulo)}</strong><span class="cell-secondary">${e(p.ejemplar.codigoEjemplar)}</span></td><td>${e(fullName(p.usuario))}<span class="cell-secondary">${e(p.usuario.matricula)}</span></td><td class="due-date">${date(p.fechaPrestamo)}</td><td><span class="due-date ${p.estado === 'Vencido' ? 'overdue' : ''}">${date(p.fechaVencimiento)}</span>${p.fechaDevolucion ? `<span class="cell-secondary">Devuelto: ${date(p.fechaDevolucion)}</span>` : p.estado === 'Vencido' ? `<span class="cell-secondary">${Math.floor((Date.now() - new Date(p.fechaVencimiento)) / 86400000)} días completos de retraso</span>` : ''}</td><td>${badge(p.estado)}</td><td><div class="row-actions">${p.abierto ? `<button type="button" class="button button-small button-soft" data-action="return-loan" data-id="${p.id}">Devolver</button>${actionButton('edit-loan', p.id, 'Editar vencimiento y observaciones', 'edit')}${actionButton('cancel-loan', p.id, 'Cancelar préstamo', 'close', 'danger')}` : ''}${actionButton('loan-detail', p.id, 'Ver detalle e historial del préstamo', 'history')}</div></td></tr>`), 'Préstamos y devoluciones') + pagination(data) : standardEmpty(s.texto || s.estado ? 'No hay préstamos con estos filtros' : 'Un libro espera a su próximo lector', s.texto || s.estado ? 'Prueba otro estado o busca un lector diferente.' : 'Registra tu primer préstamo y sigue aquí todos sus movimientos.', s.texto || s.estado ? '' : newButton('new-loan', 'Nuevo préstamo'))}</section>${moduleFooter('Jaime Gael Montalvo Ramírez')}`;
}

async function render() {
  const current = ++revision; records = new Map();
  content.innerHTML = loading(); content.setAttribute('aria-busy', 'true');
  try {
    if (route === 'resumen') {
      const data = (await request(queries.dashboard)).estadisticasGenerales;
      if (current !== revision) return;
      content.innerHTML = dashboardMarkup(data); setNavCount(data.prestamosVencidos);
    } else if (route === 'consultas') {
      const catalog = (await request(queries.reports)).consultasAvanzadas;
      if (current !== revision) return;
      mountReports(content, catalog, () => current === revision && route === 'consultas');
    } else {
      const s = states[route];
      const variables = Object.fromEntries(Object.entries(s).filter(([k, v]) => k !== 'tab' && v !== ''));
      const query = route === 'catalogo' ? s.tab === 'libros' ? queries.books : queries.copies : route === 'usuarios' ? queries.users : queries.loans;
      const result = await request(query, variables);
      if (current !== revision) return;
      const data = result.libros || result.ejemplares || result.usuarios || result.prestamos;
      if (data.total > 0 && !data.items.length && s.pagina > 1) { s.pagina = Math.ceil(data.total / s.limite); return render(); }
      storeRows(data.items);
      content.innerHTML = route === 'catalogo' ? catalogueMarkup(data, result.categoriasLibros || []) : route === 'usuarios' ? usersMarkup(data) : loansMarkup(data);
    }
  } catch (error) { if (current === revision) content.innerHTML = errorPanel(error); }
  finally { if (current === revision) content.removeAttribute('aria-busy'); }
}
content.addEventListener('submit', event => {
  const form = event.target.closest('[data-filter-form]'); if (!form) return;
  event.preventDefault(); const s = states[route];
  for (const [key, value] of new FormData(form)) s[key] = value.trim();
  s.pagina = 1; render();
});
content.addEventListener('change', event => { if (event.target.matches('[data-filter-form] select')) event.target.form.requestSubmit(); });
content.addEventListener('click', event => {
  const tab = event.target.closest('[data-catalog-tab]');
  if (tab) { states.catalogo = { ...states.catalogo, tab: tab.dataset.catalogTab, texto: '', estado: '', categoria: '', pagina: 1 }; render(); return; }
  const loanState = event.target.closest('[data-loan-state]');
  if (loanState) { states.prestamos.estado = loanState.dataset.loanState; states.prestamos.pagina = 1; render(); return; }
  const page = event.target.closest('[data-page][data-context=main]');
  if (page) { states[route].pagina = Number(page.dataset.page); render(); return; }
  const target = event.target.closest('[data-action]'); if (!target) return;
  const { action, id } = target.dataset, record = records.get(id);
  try {
    switch (action) {
      case 'retry': render(); break;
      case 'new-book': editBook(); break;
      case 'new-copy': editCopy(); break;
      case 'new-user': editUser(); break;
      case 'new-loan': newLoan(); break;
      case 'edit-book': editBook(record); break;
      case 'delete-book': deleteEntity('Book', record); break;
      case 'book-copies': bookCopies(record); break;
      case 'edit-copy': editCopy(record); break;
      case 'delete-copy': deleteEntity('Copy', record); break;
      case 'edit-user': editUser(record); break;
      case 'delete-user': deleteEntity('User', record); break;
      case 'user-history': userHistory(record); break;
      case 'edit-loan': editLoan(record); break;
      case 'return-loan': returnLoan(record); break;
      case 'cancel-loan': cancelLoan(record); break;
      case 'loan-detail': loanDetail(id); break;
      case 'clear-filters':
        for (const key of ['texto','categoria','estado','tipoUsuario']) if (Object.hasOwn(states[route], key)) states[route][key] = '';
        states[route].pagina = 1; render(); break;
    }
  } catch (error) { toast(error.message, true); }
});
routeChanged();
if (route !== 'resumen') updateNavCount();
