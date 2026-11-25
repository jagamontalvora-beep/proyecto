export async function request(query, variables = {}, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch('/graphql', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }), signal: controller.signal
    });
    const body = await response.json();
    window.dispatchEvent(new CustomEvent('bibliotrack:connection', { detail: response.ok }));
    if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join(' '));
    if (!response.ok || !body.data) throw new Error('No fue posible obtener la información. Intenta de nuevo.');
    return body.data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('La solicitud tardó demasiado. Comprueba tu conexión e intenta de nuevo.');
    if (error instanceof TypeError || error instanceof SyntaxError) {
      window.dispatchEvent(new CustomEvent('bibliotrack:connection', { detail: false }));
      throw new Error('No hay conexión con la biblioteca. Comprueba que el servidor esté en ejecución.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export const BOOK = 'id titulo isbn autores categoria editorial anioPublicacion idioma descripcion estado';
export const USER = 'id nombre apellidos matricula correo telefono tipoUsuario estado fechaRegistro';
export const COPY = `id codigoEjemplar libroId estado ubicacion fechaAdquisicion observaciones libro { ${BOOK} }`;
export const LOAN = `id usuarioId ejemplarId fechaPrestamo fechaVencimiento fechaDevolucion estado abierto observaciones usuario { ${USER} } ejemplar { id codigoEjemplar ubicacion libro { id titulo autores categoria } } movimientos { tipo fecha detalle }`;
export const PAGE = 'total pagina limite paginas';
export const queries = {
  dashboard: `query { estadisticasGenerales { totalLibros totalEjemplares totalUsuarios ejemplaresDisponibles prestamosActivos prestamosVencidos disponibilidad { estado cantidad } proximosAVencer { ${LOAN} } ultimosMovimientos { prestamoId usuarioId ejemplarId tipo fecha detalle } } }`,
  books: `query($texto:String,$categoria:String,$estado:String,$pagina:Int,$limite:Int){ libros(texto:$texto,categoria:$categoria,estado:$estado,pagina:$pagina,limite:$limite){${PAGE} items{${BOOK} disponibilidad{total disponibles prestados}}} categoriasLibros }`,
  copies: `query($texto:String,$libroId:ID,$estado:String,$pagina:Int,$limite:Int){ejemplares(texto:$texto,libroId:$libroId,estado:$estado,pagina:$pagina,limite:$limite){${PAGE} items{${COPY}}}}`,
  users: `query($texto:String,$tipoUsuario:String,$estado:String,$pagina:Int,$limite:Int){usuarios(texto:$texto,tipoUsuario:$tipoUsuario,estado:$estado,pagina:$pagina,limite:$limite){${PAGE} items{${USER}}}}`,
  loans: `query($texto:String,$estado:String,$usuarioId:ID,$desde:DateTime,$hasta:DateTime,$pagina:Int,$limite:Int){prestamos(texto:$texto,estado:$estado,usuarioId:$usuarioId,desde:$desde,hasta:$hasta,pagina:$pagina,limite:$limite){${PAGE} items{${LOAN}}}}`,
  history: `query($usuarioId:ID!,$pagina:Int,$limite:Int){historialUsuario(usuarioId:$usuarioId,pagina:$pagina,limite:$limite){${PAGE} items{${LOAN}}}}`,
  loan: `query($id:ID!){prestamo(id:$id){${LOAN}}}`,
  reports: 'query { consultasAvanzadas { codigo grupo responsable nombre descripcion requierePeriodo requiereUsuario } }',
  report: 'query($codigo:String!,$desde:DateTime,$hasta:DateTime,$usuarioId:ID,$pagina:Int,$limite:Int){consultaAvanzada(codigo:$codigo,desde:$desde,hasta:$hasta,usuarioId:$usuarioId,pagina:$pagina,limite:$limite){consulta{codigo nombre descripcion} filas total pagina limite}}'
};
export const mutations = {
  createBook: `mutation($input:CrearLibroInput!){crearLibro(input:$input){${BOOK}}}`,
  updateBook: `mutation($id:ID!,$input:ActualizarLibroInput!){actualizarLibro(id:$id,input:$input){${BOOK}}}`,
  deleteBook: 'mutation($id:ID!){eliminarLibro(id:$id)}',
  createCopy: `mutation($input:CrearEjemplarInput!){crearEjemplar(input:$input){${COPY}}}`,
  updateCopy: `mutation($id:ID!,$input:ActualizarEjemplarInput!){actualizarEjemplar(id:$id,input:$input){${COPY}}}`,
  deleteCopy: 'mutation($id:ID!){eliminarEjemplar(id:$id)}',
  createUser: `mutation($input:CrearUsuarioInput!){crearUsuario(input:$input){${USER}}}`,
  updateUser: `mutation($id:ID!,$input:ActualizarUsuarioInput!){actualizarUsuario(id:$id,input:$input){${USER}}}`,
  deleteUser: 'mutation($id:ID!){eliminarUsuario(id:$id)}',
  createLoan: `mutation($input:CrearPrestamoInput!){crearPrestamo(input:$input){${LOAN}}}`,
  updateLoan: `mutation($id:ID!,$input:ActualizarPrestamoInput!){actualizarPrestamo(id:$id,input:$input){${LOAN}}}`,
  returnLoan: 'mutation($id:ID!){registrarDevolucion(id:$id){id estado}}',
  cancelLoan: 'mutation($id:ID!,$motivo:String!){cancelarPrestamo(id:$id,motivo:$motivo){id estado}}'
};
