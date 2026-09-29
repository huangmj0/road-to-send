// Structural check of a payload against src/schema.json, in the spirit of the protocol-fixtures
// suite: no JSON-schema library, only the keywords schema.json uses (type, const, enum, pattern,
// minimum/maximum, minLength/maxLength, required, properties, additionalProperties, items, $ref,
// anyOf). Returns a list of problems; an empty list means the payload conforms.
export function schemaProblems(schema, value) {
  const problems = [];
  const resolve = ref => ref.slice(2).split('/').reduce((node, key) => node[key], schema);
  const typeOk = (type, v) => ({
    object: v !== null && typeof v === 'object' && !Array.isArray(v),
    array: Array.isArray(v), string: typeof v === 'string', integer: Number.isInteger(v), null: v === null,
  })[type];
  function check(node, v, at) {
    if (node.$ref) return check(resolve(node.$ref), v, at);
    if (node.anyOf) {
      if (!node.anyOf.some(option => { const before = problems.length; check(option, v, at); return problems.splice(before).length === 0; })) problems.push(`${at}: matches no anyOf option`);
      return;
    }
    if ('const' in node && v !== node.const) problems.push(`${at}: expected ${JSON.stringify(node.const)}`);
    if (node.enum && !node.enum.includes(v)) problems.push(`${at}: not one of ${JSON.stringify(node.enum)}`);
    if (node.type && !typeOk(node.type, v)) return problems.push(`${at}: expected ${node.type}`);
    if (typeof v === 'string') {
      if (node.pattern && !new RegExp(node.pattern).test(v)) problems.push(`${at}: does not match ${node.pattern}`);
      if (node.minLength != null && v.length < node.minLength) problems.push(`${at}: too short`);
      if (node.maxLength != null && v.length > node.maxLength) problems.push(`${at}: too long`);
    }
    if (typeof v === 'number') {
      if (node.minimum != null && v < node.minimum) problems.push(`${at}: below ${node.minimum}`);
      if (node.maximum != null && v > node.maximum) problems.push(`${at}: above ${node.maximum}`);
    }
    if (Array.isArray(v) && node.items) v.forEach((item, i) => check(node.items, item, `${at}[${i}]`));
    if (typeOk('object', v)) {
      for (const key of node.required || []) if (!(key in v)) problems.push(`${at}.${key}: is required`);
      for (const [key, child] of Object.entries(node.properties || {})) if (key in v) check(child, v[key], `${at}.${key}`);
      if (node.additionalProperties === false) for (const key of Object.keys(v)) if (!(key in (node.properties || {}))) problems.push(`${at}.${key}: is not allowed`);
    }
  }
  check(schema, value, '$');
  return problems;
}
