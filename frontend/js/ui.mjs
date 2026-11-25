export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const paths = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="18" width="7" height="3" rx="1"/>',
  book: '<path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v16h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3zM12 6v16M6 8h3m-3 4h3m6-4h3m-3 4h3"/>',
  library: '<path d="M4 4h4v17H4zM11 4h4v17h-4zM18 4l3 16M2 21h20"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
  exchange: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  chart: '<path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  alert: '<path d="m12 3 10 18H2zM12 9v5m0 3v.1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m4 0h2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  spark: '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  history: '<path d="M3 4v5h5M3 9a9 9 0 1 1 0 6M12 7v5l4 2"/>',
  box: '<path d="m12 3 9 5-9 5-9-5zM3 8v10l9 4 9-4V8M12 13v9"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
export const number = value => new Intl.NumberFormat('es-MX').format(value ?? 0);
export function date(value, withTime = false) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? escape(value) : new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(parsed);
}
export function localInputDate(value = new Date()) {
  const d = new Date(value); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
export const fullName = user => `${user.nombre} ${user.apellidos}`;
export const initials = user => `${user.nombre?.[0] || ''}${user.apellidos?.[0] || ''}`;
export function badge(value) {
  const variant = ({ Disponible: 'teal', Activo: 'teal', Devuelto: 'blue', Prestado: 'gold', Vencido: 'coral', 'En reparación': 'gold', Inactivo: 'gray', 'Dado de baja': 'gray', Cancelado: 'gray', Estudiante: 'blue', Docente: 'teal', Administrativo: 'gold', Externo: 'gray' })[value] || 'gray';
  return `<span class="badge badge-${variant}">${escape(value)}</span>`;
}
export const loading = (label = 'Cargando información…') => `<div class="loading-state" role="status"><span class="spinner"></span><p>${escape(label)}</p></div>`;
export function empty(title, description, action = '') {
  return `<div class="empty-state"><span class="empty-icon">${icon('book')}</span><h3>${escape(title)}</h3><p>${escape(description)}</p>${action}</div>`;
}
export function errorPanel(error) {
  return `<div class="error-state" role="alert">${icon('alert')}<h3>No pudimos cargar la información</h3><p>${escape(error.message)}</p><button type="button" class="button button-secondary" data-action="retry">${icon('refresh')}Reintentar</button></div>`;
}
export function pagination(page, context = 'main') {
  const pages = page.paginas ?? Math.ceil(page.total / page.limite);
  const start = page.total ? (page.pagina - 1) * page.limite + 1 : 0;
  return `<div class="pagination"><span>${number(start)}–${number(Math.min(page.pagina * page.limite, page.total))} de <strong>${number(page.total)}</strong> registros</span><div><button type="button" class="button page-button" data-page="${page.pagina - 1}" data-context="${context}" ${page.pagina <= 1 ? 'disabled' : ''}>Anterior</button><span class="page-indicator">${page.pagina} / ${Math.max(1, pages)}</span><button type="button" class="button page-button" data-page="${page.pagina + 1}" data-context="${context}" ${page.pagina >= pages ? 'disabled' : ''}>Siguiente</button></div></div>`;
}
export const actionButton = (action, id, label, symbol, cls = '') => `<button type="button" class="icon-button ${cls}" data-action="${action}" data-id="${escape(id)}" aria-label="${escape(label)}" title="${escape(label)}">${icon(symbol)}</button>`;
export function table(headers, rows, caption) {
  return `<div class="table-wrap"><table><caption class="sr-only">${escape(caption)}</caption><thead><tr>${headers.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
export function toast(message, error = false) {
  const el = document.createElement('div'); el.className = `toast ${error ? 'toast-error' : ''}`;
  el.innerHTML = `${icon(error ? 'alert' : 'check')}<span>${escape(message)}</span><button class="icon-button" aria-label="Cerrar notificación">${icon('close')}</button>`;
  el.querySelector('button').onclick = () => el.remove();
  document.querySelector('#toast-region').append(el);
  setTimeout(() => el.remove(), error ? 10000 : 5000);
}
export function changed(message) {
  toast(message); window.dispatchEvent(new Event('bibliotrack:changed'));
}

export function openModal({ title, description = '', body, submit = '', onSubmit, large = false, danger = false }) {
  const dialog = document.querySelector('#modal');
  if (dialog.open) dialog.close();
  dialog.className = large ? 'modal modal-large' : 'modal';
  dialog.innerHTML = `<div class="modal-header"><div><h2 id="modal-title">${escape(title)}</h2>${description ? `<p>${escape(description)}</p>` : ''}</div><button class="icon-button" type="button" data-close aria-label="Cerrar ventana">${icon('close')}</button></div><form id="modal-form"><div class="modal-body">${body}<div class="form-error" role="alert" tabindex="-1" hidden></div></div><div class="modal-footer"><button type="button" class="button button-secondary" data-close>${submit ? 'Cancelar' : 'Cerrar'}</button>${submit ? `<button type="submit" class="button ${danger ? 'button-danger' : 'button-primary'}" id="modal-submit">${escape(submit)}</button>` : ''}</div></form>`;
  dialog.querySelectorAll('[data-close]').forEach(button => button.onclick = () => dialog.close());
  dialog.showModal();
  const form = dialog.querySelector('form');
  if (onSubmit) form.onsubmit = async event => {
    event.preventDefault();
    const button = form.querySelector('[type=submit]');
    if (button.disabled) return;
    const original = button.innerHTML;
    button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Guardando…`;
    const error = form.querySelector('.form-error'); error.hidden = true;
    // No cerrar ni reemplazar el modal mientras se confirma una escritura.
    dialog.querySelectorAll('[data-close]').forEach(b => b.disabled = true);
    dialog.oncancel = event => event.preventDefault();
    try {
      await onSubmit(new FormData(form), form);
      dialog.close();
    } catch (failure) {
      error.textContent = failure.message; error.hidden = false; error.focus();
    } finally {
      button.disabled = false; button.innerHTML = original;
      dialog.querySelectorAll('[data-close]').forEach(b => b.disabled = false);
      dialog.oncancel = null;
    }
  };
  else form.onsubmit = event => event.preventDefault();
  return dialog;
}

export function field(label, name, value = '', { type = 'text', required = false, max = 250, wide = false, hint = '', attrs = '' } = {}) {
  return `<label class="field ${wide ? 'field-wide' : ''}"><span>${escape(label)}${required ? '<span class="required"> *</span>' : ''}</span><input name="${name}" type="${type}" value="${escape(value)}" ${required ? 'required' : ''} ${['text', 'email', 'tel', 'search'].includes(type) ? `maxlength="${max}"` : ''} ${attrs}>${hint ? `<small>${escape(hint)}</small>` : ''}</label>`;
}
export function selectField(label, name, options, value = '', wide = false) {
  return `<label class="field ${wide ? 'field-wide' : ''}"><span>${escape(label)}</span><select name="${name}">${options.map(option => { const [v, text] = Array.isArray(option) ? option : [option, option]; return `<option value="${escape(v)}" ${v === value ? 'selected' : ''}>${escape(text)}</option>`; }).join('')}</select></label>`;
}
export const textarea = (label, name, value = '', max = 2000) => `<label class="field field-wide"><span>${escape(label)}</span><textarea name="${name}" rows="3" maxlength="${max}">${escape(value)}</textarea></label>`;
