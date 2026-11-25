module.exports = `#graphql
  scalar DateTime
  scalar JSON
  enum GrupoConsulta { GAEL CARLOS JAIME }
  type Libro {
    id: ID!, titulo: String!, isbn: String!, autores: [String!]!, categoria: String!, editorial: String!
    anioPublicacion: Int!, idioma: String!, descripcion: String, fechaRegistro: DateTime!, estado: String!
    ejemplares(pagina: Int = 1, limite: Int = 20): PaginaEjemplares!
    disponibilidad: DisponibilidadLibro!
  }
  type DisponibilidadLibro { total: Int!, disponibles: Int!, prestados: Int! }
  type Ejemplar {
    id: ID!, codigoEjemplar: String!, libroId: ID!, libro: Libro!, estado: String!, ubicacion: String!
    fechaAdquisicion: DateTime!, observaciones: String
  }
  type Usuario {
    id: ID!, nombre: String!, apellidos: String!, matricula: String!, correo: String!, telefono: String
    tipoUsuario: String!, fechaRegistro: DateTime!, estado: String!
    historial(pagina: Int = 1, limite: Int = 20): PaginaPrestamos!
  }
  type Movimiento { tipo: String!, fecha: DateTime!, detalle: String! }
  type MovimientoReciente {
    prestamoId: ID!, usuarioId: ID!, ejemplarId: ID!, tipo: String!, fecha: DateTime!, detalle: String!
  }
  type Prestamo {
    id: ID!, usuarioId: ID!, ejemplarId: ID!, usuario: Usuario!, ejemplar: Ejemplar!
    fechaPrestamo: DateTime!, fechaVencimiento: DateTime!, fechaDevolucion: DateTime
    estado: String!, abierto: Boolean!, observaciones: String, movimientos: [Movimiento!]!
  }
  type PaginaLibros { items: [Libro!]!, total: Int!, pagina: Int!, limite: Int!, paginas: Int! }
  type PaginaEjemplares { items: [Ejemplar!]!, total: Int!, pagina: Int!, limite: Int!, paginas: Int! }
  type PaginaUsuarios { items: [Usuario!]!, total: Int!, pagina: Int!, limite: Int!, paginas: Int! }
  type PaginaPrestamos { items: [Prestamo!]!, total: Int!, pagina: Int!, limite: Int!, paginas: Int! }
  type Disponibilidad { estado: String!, cantidad: Int! }
  type Estadisticas {
    totalLibros: Int!, totalEjemplares: Int!, totalUsuarios: Int!, ejemplaresDisponibles: Int!
    prestamosActivos: Int!, prestamosVencidos: Int!, disponibilidad: [Disponibilidad!]!
    ultimosMovimientos: [MovimientoReciente!]!, proximosAVencer: [Prestamo!]!
  }
  type Consulta {
    codigo: String!, grupo: GrupoConsulta!, responsable: String!, nombre: String!, descripcion: String!
    requierePeriodo: Boolean!, requiereUsuario: Boolean!
  }
  type ResultadoConsulta { consulta: Consulta!, filas: [JSON!]!, total: Int!, pagina: Int!, limite: Int! }
  input CrearLibroInput {
    titulo: String!, isbn: String!, autores: [String!]!, categoria: String!, editorial: String!
    anioPublicacion: Int!, idioma: String, descripcion: String, estado: String
  }
  input ActualizarLibroInput {
    titulo: String, isbn: String, autores: [String!], categoria: String, editorial: String
    anioPublicacion: Int, idioma: String, descripcion: String, estado: String
  }
  input CrearEjemplarInput {
    codigoEjemplar: String!, libroId: ID!, ubicacion: String!, estado: String
    fechaAdquisicion: DateTime, observaciones: String
  }
  input ActualizarEjemplarInput {
    codigoEjemplar: String, ubicacion: String, estado: String, fechaAdquisicion: DateTime, observaciones: String
  }
  input CrearUsuarioInput {
    nombre: String!, apellidos: String!, matricula: String!, correo: String!, telefono: String
    tipoUsuario: String!, estado: String
  }
  input ActualizarUsuarioInput {
    nombre: String, apellidos: String, matricula: String, correo: String, telefono: String
    tipoUsuario: String, estado: String
  }
  input CrearPrestamoInput { usuarioId: ID!, ejemplarId: ID!, fechaPrestamo: DateTime, fechaVencimiento: DateTime!, observaciones: String }
  input ActualizarPrestamoInput { fechaVencimiento: DateTime, observaciones: String }
  type Query {
    categoriasLibros: [String!]!
    libros(texto: String, categoria: String, estado: String, pagina: Int = 1, limite: Int = 20): PaginaLibros!
    libro(id: ID!): Libro
    buscarLibros(texto: String!, categoria: String, pagina: Int = 1, limite: Int = 20): PaginaLibros!
    ejemplares(libroId: ID, estado: String, texto: String, pagina: Int = 1, limite: Int = 20): PaginaEjemplares!
    ejemplaresDisponibles(libroId: ID, pagina: Int = 1, limite: Int = 20): PaginaEjemplares!
    ejemplar(id: ID!): Ejemplar
    usuarios(texto: String, tipoUsuario: String, estado: String, pagina: Int = 1, limite: Int = 20): PaginaUsuarios!
    usuario(id: ID!): Usuario
    buscarUsuarios(texto: String!, tipoUsuario: String, pagina: Int = 1, limite: Int = 20): PaginaUsuarios!
    prestamos(estado: String, texto: String, usuarioId: ID, ejemplarId: ID, desde: DateTime, hasta: DateTime, pagina: Int = 1, limite: Int = 20): PaginaPrestamos!
    prestamo(id: ID!): Prestamo
    prestamosActivos(usuarioId: ID, pagina: Int = 1, limite: Int = 20): PaginaPrestamos!
    prestamosVencidos(usuarioId: ID, pagina: Int = 1, limite: Int = 20): PaginaPrestamos!
    historialUsuario(usuarioId: ID!, pagina: Int = 1, limite: Int = 20): PaginaPrestamos!
    estadisticasGenerales: Estadisticas!
    consultasAvanzadas(grupo: GrupoConsulta): [Consulta!]!
    consultaAvanzada(codigo: String!, desde: DateTime, hasta: DateTime, usuarioId: ID, pagina: Int = 1, limite: Int = 20): ResultadoConsulta!
  }
  type Mutation {
    crearLibro(input: CrearLibroInput!): Libro!
    actualizarLibro(id: ID!, input: ActualizarLibroInput!): Libro!
    eliminarLibro(id: ID!): Boolean!
    crearEjemplar(input: CrearEjemplarInput!): Ejemplar!
    actualizarEjemplar(id: ID!, input: ActualizarEjemplarInput!): Ejemplar!
    eliminarEjemplar(id: ID!): Boolean!
    crearUsuario(input: CrearUsuarioInput!): Usuario!
    actualizarUsuario(id: ID!, input: ActualizarUsuarioInput!): Usuario!
    eliminarUsuario(id: ID!): Boolean!
    crearPrestamo(input: CrearPrestamoInput!): Prestamo!
    registrarDevolucion(id: ID!, fechaDevolucion: DateTime): Prestamo!
    actualizarPrestamo(id: ID!, input: ActualizarPrestamoInput!): Prestamo!
    cancelarPrestamo(id: ID!, motivo: String!): Prestamo!
  }
`;
