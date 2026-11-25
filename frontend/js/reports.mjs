import { request, queries } from './api.mjs';
import { escape as e, icon, loading, empty, table, pagination, date, number, field } from './ui.mjs';
import { heading, refreshButton } from './dashboard.mjs';
import { lookupMarkup, attachLookup } from './forms.mjs';

const groupInfo = { GAEL: ['Gael', 'Catálogo'], CARLOS: ['Carlos', 'Usuarios'], JAIME: ['Jaime', 'Préstamos y seguimiento'] };
const labels = { titulo: 'Libro', nombre: 'Nombre', apellidos: 'Apellidos', matricula: 'Matrícula', isbn: 'ISBN', categoria: 'Categoría', tipoUsuario: 'Tipo de usuario', prestamos: 'Préstamos', total: 'Total', disponibles: 'Disponibles', prestados: 'Prestados', porcentajeDisponible: 'Disponible (%)', categorias: 'Categorías', cantidad: 'Cantidad', devueltos: 'Devueltos', promedio: 'Promedio', abiertos: 'En curso', vencidos: 'Vencidos', retrasoMaximoDias: 'Retraso máximo (días)', titulos: 'Títulos', promedioDias: 'Promedio (días)', aTiempo: 'A tiempo', tardias: 'Tardías', porcentajeATiempo: 'A tiempo (%)', porcentajeTardias: 'Tardías (%)', usuarios: 'Usuarios', codigoEjemplar: 'Ejemplar', fechaPrestamo: 'Préstamo', fechaVencimiento: 'Vencimiento', fechaDevolucion: 'Devolución', estado: 'Estado', usuario: 'Usuario', movimientos: 'Movimientos', ubicacion: 'Ubicación', devoluciones: 'Devoluciones' };
const idLabels = { G02: 'Categoría', G03: 'Autor', G05: 'Categoría', G08: 'Editorial', C05: 'Tipo de usuario', C10: 'Tipo de usuario', J01: 'Días de retraso', J03: 'Categoría', J04: 'Mes', J08: 'Categoría', J10: 'Mes' };
function normalized(row, code) {
  const result = {};
  if (row._id && typeof row._id === 'object') Object.assign(result, row._id);
  else if (idLabels[code]) result[idLabels[code]] = row._id;
  for (const [key, value] of Object.entries(row)) if (key !== '_id') result[key] = value;
  return result;
}
function cell(value, key) {
  if (value == null) return '—';
  if (key.startsWith('fecha')) return date(value, true);
  if (typeof value === 'number') return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);
  if (Array.isArray(value)) {
    if (value.every(v => typeof v !== 'object')) return e(value.join(', '));
    return `<details><summary>${value.length} movimientos</summary>${value.map(v => `<p><strong>${e(v.tipo || '')}</strong> ${v.fecha ? date(v.fecha, true) : ''}<br>${e(v.detalle || JSON.stringify(v))}</p>`).join('')}</details>`;
  }
  return e(typeof value === 'object' ? Object.entries(value).map(([k, v]) => `${labels[k] || k}: ${v}`).join(' · ') : value);
}
export function mountReports(container, catalog, isCurrent) {
  let group = 'GAEL', code = 'G01', revision = 0, currentVariables, result = null;
  function paint() {
    ++revision; result = null; currentVariables = null;
    const selected = catalog.find(c => c.codigo === code);
    container.innerHTML = `${heading('ANÁLISIS DE LA BIBLIOTECA', 'Consultas avanzadas', '30 formas de entender tu colección, tus lectores y sus hábitos.', refreshButton())}<div class="tabs" role="tablist" aria-label="Responsables de las consultas">${Object.entries(groupInfo).map(([g, [person, title]]) => `<button type="button" role="tab" aria-selected="${g === group}" class="tab ${g === group ? 'active' : ''}" data-report-group="${g}">${person}<span class="count-pill">${title}</span></button>`).join('')}</div><div class="report-layout"><section class="card report-list" aria-label="Consultas disponibles"><div class="report-list-header">${groupInfo[group][1]} · 10 consultas</div>${catalog.filter(c => c.grupo === group).map(c => `<button type="button" class="report-option ${c.codigo === code ? 'active' : ''}" data-report-code="${c.codigo}" aria-pressed="${c.codigo === code}"><span class="report-code">${c.codigo}</span><span>${e(c.nombre)}</span></button>`).join('')}</section><section class="card"><div class="report-title"><div class="eyebrow">${code} · ${groupInfo[group][1]}</div><h2>${e(selected.nombre)}</h2><p>${e(selected.descripcion)}</p><div class="module-footer report-owner">${icon('users')}${e(selected.responsable)}</div></div><form id="report-form" class="report-controls">${selected.requierePeriodo ? field('Desde (incluido)', 'desde', '', { type: 'date', required: true }) + field('Hasta (incluido)', 'hasta', '', { type: 'date', required: true }) : ''}${selected.requiereUsuario ? lookupMarkup('Seleccionar usuario *', 'reportUsuario', 'Buscar por nombre o matrícula…') : ''}<button type="submit" class="button button-primary">${icon('chart')}Ejecutar consulta</button></form><div id="report-result" class="report-result">${empty('Tu próxima perspectiva empieza aquí', selected.requierePeriodo || selected.requiereUsuario ? 'Completa los filtros y ejecuta la consulta para ver los resultados.' : 'Ejecuta la consulta para analizar los datos de tu biblioteca.')}</div></section></div>`;
    container.querySelectorAll('[data-report-group]').forEach(button => button.onclick = () => { group = button.dataset.reportGroup; code = catalog.find(c => c.grupo === group).codigo; paint(); });
    container.querySelectorAll('[data-report-code]').forEach(button => button.onclick = () => { code = button.dataset.reportCode; paint(); });
    if (selected.requiereUsuario) attachLookup(container, 'reportUsuario', 'user');
    container.querySelector('#report-form').onsubmit = event => {
      event.preventDefault(); const data = new FormData(event.target);
      const variables = { codigo: code, limite: 10, pagina: 1 };
      if (selected.requierePeriodo) {
        const desde = new Date(`${data.get('desde')}T00:00:00`), hasta = new Date(`${data.get('hasta')}T00:00:00`);
        if (desde > hasta) { showError('La fecha final debe ser igual o posterior a la fecha inicial.'); return; }
        hasta.setDate(hasta.getDate() + 1); variables.desde = desde.toISOString(); variables.hasta = hasta.toISOString();
      }
      if (selected.requiereUsuario) { variables.usuarioId = data.get('reportUsuario'); if (!variables.usuarioId) { showError('Busca y selecciona un usuario antes de ejecutar la consulta.'); return; } }
      currentVariables = variables; execute();
    };
  }
  function showError(message) { container.querySelector('#report-result').innerHTML = `<div class="error-state" role="alert">${icon('alert')}<p>${e(message)}</p></div>`; }
  async function execute(page = 1) {
    const current = ++revision;
    const target = container.querySelector('#report-result'); target.innerHTML = loading('Consultando los datos de tu biblioteca…');
    const submit = container.querySelector('#report-form button[type=submit]'); submit.disabled = true;
    try {
      result = (await request(queries.report, { ...currentVariables, pagina: page })).consultaAvanzada;
      if (current !== revision || !isCurrent()) return;
      const rows = result.filas.map(row => normalized(row, code));
      if (!rows.length) { target.innerHTML = empty('Sin resultados para esta consulta', 'No hay registros que cumplan las condiciones. Puedes probar otra consulta o periodo.'); return; }
      const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
      target.innerHTML = `<div class="result-heading"><strong>Resultados <span class="count-pill">${number(result.total)}</span></strong><span class="cell-secondary">Actualizado ${date(new Date(), true)}</span></div>${table(keys.map(k => labels[k] || k), rows.map(row => `<tr>${keys.map(key => `<td>${cell(row[key], key)}</td>`).join('')}</tr>`), result.consulta.nombre)}${pagination(result, 'report')}`;
      target.querySelectorAll('[data-page]').forEach(button => button.onclick = () => execute(Number(button.dataset.page)));
    } catch (error) { if (current === revision && isCurrent()) showError(error.message); }
    finally { submit.disabled = false; }
  }
  paint();
}
