// A small JSON Schema checker, enough for schema/evidence.v1.json: type, const, enum, pattern,
// minLength, minimum, required, properties, additionalProperties, items, minItems, anyOf, oneOf
// and local $ref ("#/$defs/..."). Keywords it does not know are ignored, so it can only accept
// too much, never reject a valid document; the tests check it rejects what it should.
// Returns a list of errors, each "path: message"; an empty list means the value fits.

const typeOf = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v);
const fits = (v, t) => typeOf(v) === t || (t === "number" && typeof v === "number");

function resolve(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`only local $ref is supported: ${ref}`);
  return ref.slice(2).split("/").reduce((node, k) => node && node[k], root);
}

function scalar(s, v, path, errs) {
  if (s.const !== undefined && JSON.stringify(v) !== JSON.stringify(s.const)) errs.push(`${path}: must be ${JSON.stringify(s.const)}`);
  if (s.enum && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) errs.push(`${path}: ${JSON.stringify(v)} is not one of ${s.enum.join(", ")}`);
  if (typeof v === "string") {
    if (s.minLength != null && v.length < s.minLength) errs.push(`${path}: shorter than ${s.minLength}`);
    if (s.pattern && !new RegExp(s.pattern, "u").test(v)) errs.push(`${path}: does not match ${s.pattern}`);
  }
  if (typeof v === "number" && s.minimum != null && v < s.minimum) errs.push(`${path}: below ${s.minimum}`);
}

function object(root, s, v, path, errs) {
  for (const k of s.required || []) if (!(k in v)) errs.push(`${path}: missing ${k}`);
  const props = s.properties || {};
  for (const [k, x] of Object.entries(v)) {
    if (props[k]) check(root, props[k], x, `${path}.${k}`, errs);
    else if (s.additionalProperties === false) errs.push(`${path}: unexpected ${k}`);
    else if (s.additionalProperties && typeof s.additionalProperties === "object") check(root, s.additionalProperties, x, `${path}.${k}`, errs);
  }
}

function check(root, s, v, path, errs) {
  if (s.$ref) return check(root, resolve(root, s.$ref), v, path, errs);
  if (s.anyOf || s.oneOf) {
    const ok = (s.anyOf || s.oneOf).map((x) => { const e = []; check(root, x, v, path, e); return e; });
    const n = ok.filter((e) => !e.length).length;
    if (s.anyOf && !n) errs.push(`${path}: fits none of the allowed shapes (${ok.map((e) => e[0]).join(" | ")})`);
    if (s.oneOf && n !== 1) errs.push(`${path}: fits ${n} shapes, needs exactly one`);
  }
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.some((t) => fits(v, t))) { errs.push(`${path}: is ${typeOf(v)}, needs ${types.join(" or ")}`); return errs; }
  }
  scalar(s, v, path, errs);
  if (typeOf(v) === "object") object(root, s, v, path, errs);
  if (Array.isArray(v)) {
    if (s.minItems != null && v.length < s.minItems) errs.push(`${path}: fewer than ${s.minItems} items`);
    if (s.items) v.forEach((x, i) => check(root, s.items, x, `${path}[${i}]`, errs));
  }
  return errs;
}

export function validate(schema, value) { return check(schema, schema, value, "$", []); }
