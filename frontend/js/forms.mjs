import { request, queries, mutations } from './api.mjs';
import { escape as e, icon, badge, date, localInputDate, fullName, field, selectField, textarea, openModal, changed, loading, empty, table, pagination, actionButton, toast } from './ui.mjs';

export function lookupMarkup(label, name, placeholder = 'Escribe para buscar…') {
  return `<div class="field lookup field-wide" data-lookup="${name}"><label for="lookup-${name}"><span>${e(label)}</span></label><div class="lookup-search"><input id="lookup-${name}" type="search" placeholder="${e(placeholder)}" maxlength="150" autocomplete="off" aria-describedby="hint-${name}"><button type="button" class="button button-secondary lookup-search-button" aria-label="Buscar ${e(label.toLowerCase())}">${icon('search')}</button></div><input type="hidden" name="${name}"><small id="hint-${name}">Busca y selecciona un registro de la lista.</small><div class="lookup-selected" hidden></div><div class="lookup-results" hidden></div></div>`;
}
export function attachLookup(root, name, type, { filters = () => ({}), onChange = () => {} } = {}) {
  const element = root.querySelector(`[data-lookup="${name}"]`);
  const input = element.querySelector('input[type=search]');
  const hidden = element.querySelector('input[type=hidden]');
  const results = element.querySelector('.lookup-results');
  const selection = element.querySelector('.lookup-selected');
  let version = 0, timer, rows = new Map(), page = 1, selected = null;
  const label = item => type === 'user' ? `${fullName(item)} · ${item.matricula}` : type === 'book' ? item.titulo : `${item.codigoEjemplar} · ${item.libro.titulo}`;
  async function load(nextPage = 1) {
    const current = ++version; page = nextPage;
    results.hidden = false; results.innerHTML = '<div class="lookup-message">Buscando…</div>';
    try {
      const query = type === 'user' ? queries.users : type === 'book' ? queries.books : queries.copies;
      const key = type === 'user' ? 'usuarios' : type === 'book' ? 'libros' : 'ejemplares';
      const response = await request(query, { texto: input.value.trim() || undefined, pagina: page, limite: 8, ...filters() });
      if (current !== version || !element.isConnected) return;
      const data = response[key]; rows = new Map(data.items.map(item => [item.id, item]));
      results.innerHTML = data.items.length ? data.items.map(item => `<button type="button" class="lookup-result" data-select-id="${item.id}">${e(label(item))}<small>${e(type === 'user' ? `${item.tipoUsuario} · ${item.correo}` : type === 'book' ? `${item.autores.join(', ')} · ${item.isbn}` : `${item.ubicacion} · ${item.estado}`)}</small></button>`).join('') : '<div class="lookup-message">Sin coincidencias. Prueba otro nombre o código.</div>';
      if (page > 1) results.innerHTML += `<button type="button" class="lookup-page" data-lookup-page="${page - 1}">Resultados anteriores</button>`;
      if (page < data.paginas) results.innerHTML += `<button type="button" class="lookup-page" data-lookup-page="${page + 1}">Más resultados (${page} de ${data.paginas})</button>`;
    } catch (error) { if (current === version) results.innerHTML = `<div class="lookup-message" role="alert">${e(error.message)}</div>`; }
  }
  const reset = () => { ++version; clearTimeout(timer); selected = null; hidden.value = ''; selection.hidden = true; results.hidden = true; input.value = ''; onChange(null); };
  results.onclick = event => {
    const target = event.target.closest('[data-select-id]');
    const next = event.target.closest('[data-lookup-page]');
    if (next) { load(Number(next.dataset.lookupPage)); return; }
    if (!target) return;
    selected = rows.get(target.dataset.selectId); hidden.value = selected.id;
    selection.innerHTML = `${icon('check')}<span>${e(label(selected))}</span><button type="button" class="icon-button" aria-label="Quitar selección de ${e(name)}">${icon('close')}</button>`;
    selection.hidden = false; results.hidden = true; input.value = '';
    selection.querySelector('button').onclick = reset; onChange(selected);
  };
  element.querySelector('.lookup-search-button').onclick = () => load();
  input.oninput = () => { clearTimeout(timer); timer = setTimeout(() => load(), 300); };
  input.onfocus = () => { if (!selected && results.hidden) load(); };
  input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); load(); } if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); results.hidden = true; } };
  return { reset, load, get selected() { return selected; } };
}
const string = (data, name) => String(data.get(name) || '').trim();
const note = text => `<div class="form-note">${icon('info')}<span>${e(text)}</span></div>`;

export function editBook(book = null) {
  const b = book || {};
  openModal({ title: book ? 'Editar libro' : 'Registrar libro', description: 'La ficha del libro reúne la información de todas sus copias físicas.', submit: book ? 'Guardar cambios' : 'Registrar libro', body: `<div class="form-grid">
    ${field('Título', 'titulo', b.titulo, { required: true, wide: true })}
    ${field('ISBN', 'isbn', b.isbn, { required: true, max: 20, hint: 'Entre 10 y 20 caracteres; números, guiones o X.', attrs: 'pattern="[0-9Xx-]{10,20}"' })}
    ${field('Categoría', 'categoria', b.categoria, { required: true, max: 100, attrs: 'list="category-suggestions"' })}
    ${field('Autores', 'autores', b.autores?.join('; '), { required: true, wide: true, max: 4500, hint: 'Separa varios autores con punto y coma (;).' })}
    ${field('Editorial', 'editorial', b.editorial, { required: true, max: 150 })}
    ${field('Año de publicación', 'anioPublicacion', b.anioPublicacion, { type: 'number', required: true, attrs: `min="1000" max="${new Date().getFullYear() + 1}" step="1"` })}
    ${field('Idioma', 'idioma', b.idioma || 'Español', { required: true, max: 60 })}
    ${selectField('Estado del libro', 'estado', ['Activo', 'Inactivo'], b.estado || 'Activo')}
    ${textarea('Descripción', 'descripcion', b.descripcion, 4000)}
    </div>`, onSubmit: async data => {
      const autores = string(data, 'autores').split(';').map(a => a.trim()).filter(Boolean);
      if (!autores.length || autores.length > 30 || autores.some(a => a.length > 150)) throw new Error('Indica entre 1 y 30 autores, de máximo 150 caracteres cada uno.');
      const input = Object.fromEntries(['titulo', 'isbn', 'categoria', 'editorial', 'idioma', 'descripcion', 'estado'].map(k => [k, string(data, k)]));
      input.autores = autores; input.anioPublicacion = Number(data.get('anioPublicacion'));
      await request(book ? mutations.updateBook : mutations.createBook, { id: book?.id, input });
      changed(book ? 'La ficha del libro se actualizó.' : 'Libro registrado. Ahora puedes agregar sus ejemplares.');
    } });
}
export function editUser(user = null) {
  const u = user || {};
  openModal({ title: user ? 'Editar usuario' : 'Registrar usuario', description: 'Registra a la persona que podrá solicitar materiales de la biblioteca.', submit: user ? 'Guardar cambios' : 'Registrar usuario', body: `<div class="form-grid">
    ${field('Nombre(s)', 'nombre', u.nombre, { required: true, max: 120 })}${field('Apellidos', 'apellidos', u.apellidos, { required: true, max: 180 })}
    ${field('Matrícula / identificación', 'matricula', u.matricula, { required: true, max: 60 })}${selectField('Tipo de usuario', 'tipoUsuario', ['Estudiante', 'Docente', 'Administrativo', 'Externo'], u.tipoUsuario || 'Estudiante')}
    ${field('Correo electrónico', 'correo', u.correo, { type: 'email', required: true, max: 254 })}${field('Teléfono', 'telefono', u.telefono, { type: 'tel', max: 30 })}
    ${selectField('Estado', 'estado', ['Activo', 'Inactivo'], u.estado || 'Activo', true)}
    </div>`, onSubmit: async data => {
      const input = Object.fromEntries(['nombre', 'apellidos', 'matricula', 'tipoUsuario', 'correo', 'telefono', 'estado'].map(k => [k, string(data, k)]));
      await request(user ? mutations.updateUser : mutations.createUser, { id: user?.id, input });
      changed(user ? 'Usuario actualizado.' : 'Usuario registrado correctamente.');
    } });
}
export function editCopy(copy = null, book = null) {
  const c = copy || {};
  const owner = book || copy?.libro;
  const dialog = openModal({ title: copy ? 'Editar ejemplar' : 'Registrar ejemplar', description: 'Cada ejemplar representa una copia física y tiene un código único.', submit: copy ? 'Guardar cambios' : 'Registrar ejemplar', body: `${owner ? note(owner.titulo) : ''}<div class="form-grid">
    ${!owner ? lookupMarkup('Libro al que pertenece *', 'libroId', 'Buscar por título, autor o ISBN…') : ''}
    ${field('Código del ejemplar', 'codigoEjemplar', c.codigoEjemplar, { required: true, max: 80 })}${field('Ubicación', 'ubicacion', c.ubicacion, { required: true, max: 150, hint: 'Por ejemplo: Sala 2 · Estante 4.' })}
    ${selectField('Estado', 'estado', c.estado === 'Prestado' ? ['Prestado'] : ['Disponible', 'En reparación', 'Dado de baja'], c.estado || 'Disponible')}
    ${field('Fecha de adquisición', 'fechaAdquisicion', localInputDate(c.fechaAdquisicion || new Date()), { required: true, type: 'datetime-local' })}
    ${textarea('Observaciones', 'observaciones', c.observaciones)}
    </div>${c.estado === 'Prestado' ? `<p class="module-footer">Para cambiar su disponibilidad, primero registra la devolución o cancelación.</p>` : ''}`, onSubmit: async data => {
      const input = { codigoEjemplar: string(data, 'codigoEjemplar'), ubicacion: string(data, 'ubicacion'), estado: string(data, 'estado'), fechaAdquisicion: new Date(string(data, 'fechaAdquisicion')).toISOString(), observaciones: string(data, 'observaciones') };
      if (!copy) { input.libroId = owner?.id || string(data, 'libroId'); if (!input.libroId) throw new Error('Busca y selecciona el libro al que pertenece el ejemplar.'); }
      await request(copy ? mutations.updateCopy : mutations.createCopy, { id: copy?.id, input });
      changed(copy ? 'Ejemplar actualizado.' : 'Ejemplar registrado correctamente.');
    } });
  if (!owner) attachLookup(dialog, 'libroId', 'book');
}
export function newLoan() {
  let selectedBook;
  const due = new Date(); due.setDate(due.getDate() + 14); due.setHours(18, 0, 0, 0);
  const dialog = openModal({ title: 'Registrar préstamo', description: 'Selecciona al lector y una copia disponible. El ejemplar se reservará al guardar.', submit: 'Confirmar préstamo', body: `<div class="form-grid">
    ${lookupMarkup('Usuario activo *', 'usuarioId', 'Buscar por nombre, matrícula o correo…')}
    ${lookupMarkup('Buscar libro', 'filtroLibro', 'Buscar por título, autor o ISBN…')}
    ${lookupMarkup('Ejemplar disponible *', 'ejemplarId', 'Buscar por código o ubicación…')}
    ${field('Fecha de vencimiento', 'fechaVencimiento', localInputDate(due), { type: 'datetime-local', required: true, wide: true, attrs: `min="${localInputDate()}"`, hint: 'El préstamo comienza en el momento de confirmar.' })}
    ${textarea('Observaciones', 'observaciones')}
    </div>`, onSubmit: async data => {
      const usuarioId = string(data, 'usuarioId'), ejemplarId = string(data, 'ejemplarId');
      if (!usuarioId || !ejemplarId) throw new Error('Selecciona un usuario y un ejemplar de los resultados de búsqueda.');
      const due = new Date(string(data, 'fechaVencimiento'));
      if (due <= new Date()) throw new Error('El vencimiento debe ser posterior al momento actual.');
      await request(mutations.createLoan, { input: { usuarioId, ejemplarId, fechaVencimiento: due.toISOString(), observaciones: string(data, 'observaciones') } });
      changed('Préstamo registrado. El ejemplar está ahora prestado.');
    } });
  attachLookup(dialog, 'usuarioId', 'user', { filters: () => ({ estado: 'Activo' }) });
  const copies = attachLookup(dialog, 'ejemplarId', 'copy', { filters: () => ({ estado: 'Disponible', libroId: selectedBook?.id }) });
  attachLookup(dialog, 'filtroLibro', 'book', { filters: () => ({ estado: 'Activo' }), onChange: book => { selectedBook = book; copies.reset(); if (book) copies.load(); } });
}
export function editLoan(loan) {
  openModal({ title: 'Editar préstamo', description: `${loan.ejemplar.libro.titulo} · ${fullName(loan.usuario)}`, submit: 'Guardar cambios', body: `${note('Los cambios de vencimiento y observaciones se conservan en el historial.')}<div class="form-grid">${field('Fecha de vencimiento', 'fechaVencimiento', localInputDate(loan.fechaVencimiento), { type: 'datetime-local', required: true, wide: true, attrs: `min="${localInputDate(loan.fechaPrestamo)}"` })}${textarea('Observaciones', 'observaciones', loan.observaciones)}</div>`, onSubmit: async data => {
    await request(mutations.updateLoan, { id: loan.id, input: { fechaVencimiento: new Date(string(data, 'fechaVencimiento')).toISOString(), observaciones: string(data, 'observaciones') } });
    changed('Préstamo actualizado. El cambio quedó registrado.');
  } });
}
export function returnLoan(loan) {
  openModal({ title: 'Registrar devolución', description: 'Confirma que recibiste el ejemplar físico.', submit: 'Confirmar devolución', body: `<div class="selected-summary"><p><strong>${e(loan.ejemplar.libro.titulo)}</strong><br>${e(loan.ejemplar.codigoEjemplar)}</p><p>Lector: <strong>${e(fullName(loan.usuario))}</strong><br>Vencimiento: ${date(loan.fechaVencimiento, true)}</p>${badge(loan.estado)}</div>${note('Se registrará la fecha actual y el ejemplar quedará disponible para un nuevo préstamo.')}`, onSubmit: async () => { await request(mutations.returnLoan, { id: loan.id }); changed('Devolución registrada. El ejemplar está disponible.'); } });
}
export function cancelLoan(loan) {
  openModal({ title: 'Cancelar préstamo', description: `${loan.ejemplar.libro.titulo} · ${loan.ejemplar.codigoEjemplar}`, submit: 'Confirmar cancelación', danger: true, body: `${note('La cancelación libera el ejemplar y conserva el movimiento. Si el libro fue utilizado y regresó, registra una devolución.')}<label class="field"><span>Motivo de cancelación <span class="required">*</span></span><textarea name="motivo" rows="3" maxlength="2000" required placeholder="Explica por qué se cancela el préstamo…"></textarea></label>`, onSubmit: async data => { const motivo = string(data, 'motivo'); if (!motivo) throw new Error('Escribe el motivo de cancelación.'); await request(mutations.cancelLoan, { id: loan.id, motivo }); changed('Préstamo cancelado. El historial se conservó.'); } });
}
export function deleteEntity(type, record) {
  const label = type === 'Book' ? record.titulo : type === 'User' ? fullName(record) : record.codigoEjemplar;
  const noun = type === 'Book' ? 'libro' : type === 'User' ? 'usuario' : 'ejemplar';
  openModal({ title: `Eliminar ${noun}`, submit: `Eliminar ${noun}`, danger: true, body: `<p class="confirmation-body">Vas a eliminar <strong>${e(label)}</strong>. Esta acción no se puede deshacer.</p><br>${note('Si existen registros asociados, el sistema impedirá la eliminación para conservar el historial. En ese caso puedes cambiar su estado.')}`, onSubmit: async () => { await request(mutations[`delete${type}`], { id: record.id }); changed(`${noun[0].toUpperCase() + noun.slice(1)} eliminado.`); } });
}
export async function bookCopies(book, page = 1) {
  const dialog = openModal({ title: 'Ejemplares del libro', description: book.titulo, body: loading(), large: true });
  const body = dialog.querySelector('.modal-body');
  try {
    const data = (await request(queries.copies, { libroId: book.id, pagina: page, limite: 8 })).ejemplares;
    if (!body.isConnected) return;
    body.innerHTML = `<div class="inline-summary"><span><strong>${data.total}</strong> ejemplares registrados</span><button type="button" class="button button-primary button-small" data-new-copy>${icon('plus')}Agregar ejemplar</button></div>${data.items.length ? table(['Código', 'Ubicación', 'Estado', 'Adquisición', 'Acciones'], data.items.map(c => `<tr><td><strong>${e(c.codigoEjemplar)}</strong></td><td>${e(c.ubicacion)}</td><td>${badge(c.estado)}</td><td>${date(c.fechaAdquisicion)}</td><td><div class="row-actions">${actionButton('edit-copy', c.id, `Editar ${c.codigoEjemplar}`, 'edit')}${actionButton('delete-copy', c.id, `Eliminar ${c.codigoEjemplar}`, 'trash', 'danger')}</div></td></tr>`), 'Ejemplares del libro') + pagination(data, 'copies-dialog') : empty('Este libro aún no tiene ejemplares', 'Registra la primera copia física para que pueda prestarse.')}`;
    body.onclick = event => {
      if (event.target.closest('[data-new-copy]')) editCopy(null, book);
      const target = event.target.closest('[data-action]');
      if (target) { const record = data.items.find(c => c.id === target.dataset.id); if (target.dataset.action === 'edit-copy') editCopy(record); else deleteEntity('Copy', record); }
      const next = event.target.closest('[data-page]'); if (next) bookCopies(book, Number(next.dataset.page));
    };
  } catch (error) { if (body.isConnected) body.innerHTML = `<div class="form-error" role="alert">${e(error.message)}</div>`; }
}
export async function userHistory(user, page = 1) {
  const dialog = openModal({ title: 'Historial de préstamos', description: `${fullName(user)} · ${user.matricula}`, body: loading(), large: true });
  const body = dialog.querySelector('.modal-body');
  try {
    const data = (await request(queries.history, { usuarioId: user.id, pagina: page, limite: 8 })).historialUsuario;
    if (!body.isConnected) return;
    body.innerHTML = data.items.length ? table(['Libro / ejemplar', 'Préstamo', 'Vencimiento', 'Estado', 'Movimiento'], data.items.map(p => `<tr><td><strong>${e(p.ejemplar.libro.titulo)}</strong><small class="cell-secondary">${e(p.ejemplar.codigoEjemplar)}</small></td><td>${date(p.fechaPrestamo)}</td><td>${date(p.fechaVencimiento)}</td><td>${badge(p.estado)}</td><td><button type="button" class="button button-text" data-detail="${p.id}">Ver detalle</button></td></tr>`), 'Historial del usuario') + pagination(data, 'history-dialog') : empty('Todavía no hay préstamos', 'Los movimientos de este lector aparecerán aquí.');
    body.onclick = event => { const next = event.target.closest('[data-page]'); if (next) userHistory(user, Number(next.dataset.page)); const target = event.target.closest('[data-detail]'); if (target) loanDetail(data.items.find(p => p.id === target.dataset.detail)); };
  } catch (error) { if (body.isConnected) body.innerHTML = `<div class="form-error" role="alert">${e(error.message)}</div>`; }
}
export async function loanDetail(loanOrId) {
  const dialog = openModal({ title: 'Detalle del préstamo', body: loading(), large: true });
  const body = dialog.querySelector('.modal-body');
  try {
    const loan = typeof loanOrId === 'string' ? (await request(queries.loan, { id: loanOrId })).prestamo : loanOrId;
    if (!body.isConnected) return;
    body.innerHTML = `<div class="selected-summary"><h3>${e(loan.ejemplar.libro.titulo)}</h3><p>${e(loan.ejemplar.codigoEjemplar)} · ${e(loan.ejemplar.ubicacion)}</p>${badge(loan.estado)}</div><dl class="details-grid"><div><dt>Usuario</dt><dd>${e(fullName(loan.usuario))}<small class="cell-secondary">${e(loan.usuario.matricula)}</small></dd></div><div><dt>Fecha del préstamo</dt><dd>${date(loan.fechaPrestamo, true)}</dd></div><div><dt>Vencimiento</dt><dd>${date(loan.fechaVencimiento, true)}</dd></div><div><dt>Devolución</dt><dd>${date(loan.fechaDevolucion, true)}</dd></div></dl>${loan.observaciones ? note(loan.observaciones) : ''}<h3>Historial de movimientos</h3><div class="history-timeline">${loan.movimientos.map(m => `<div class="history-event"><strong>${e(m.tipo)}</strong><small>${date(m.fecha, true)}</small><p>${e(m.detalle)}</p></div>`).join('')}</div>`;
  } catch (error) { if (body.isConnected) body.innerHTML = `<div class="form-error" role="alert">${e(error.message)}</div>`; }
}
