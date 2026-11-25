const { GraphQLError } = require('graphql');
// Cuenta también fragmentos repetidos: limita profundidad, alias y expansión de ciclos de relaciones.
function queryLimits(context) {
  return { Document(node) {
    const fragments = new Map(node.definitions.filter(n => n.kind === 'FragmentDefinition').map(n => [n.name.value, n]));
    let count = 0;
    function walk(set, depth, seen = new Set()) {
      if (!set) return;
      if (depth > 10 || count > 300) throw new Error('limit');
      for (const selection of set.selections) {
        if (selection.kind === 'FragmentSpread') {
          if (seen.has(selection.name.value)) continue;
          const next = new Set(seen); next.add(selection.name.value);
          walk(fragments.get(selection.name.value)?.selectionSet, depth, next);
        } else {
          if (selection.kind === 'Field') count++;
          // La introspección estándar de Sandbox no recorre datos de la biblioteca.
          if (selection.kind !== 'Field' || !selection.name.value.startsWith('__')) {
            walk(selection.selectionSet, depth + (selection.kind === 'Field' ? 1 : 0), seen);
          }
        }
        if (count > 300) throw new Error('limit');
      }
    }
    try {
      for (const op of node.definitions.filter(n => n.kind === 'OperationDefinition')) walk(op.selectionSet, 1);
    } catch {
      context.reportError(new GraphQLError('Consulta demasiado compleja: máximo 10 niveles y 300 campos.', { extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }));
    }
  } };
}
module.exports = { queryLimits };
