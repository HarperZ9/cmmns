// Environment variables under the product's names. CMMNS_<NAME> is read first; DAYLIGHT_<NAME>, the
// name before the 2026-10-28 rename, still works, so scripts and scheduled tasks written for it keep
// running. RADAR_* variables are separate and unchanged.

export const ENV_PREFIXES = Object.freeze(["CMMNS_", "DAYLIGHT_"]);

// The value of the first prefixed name that is set, or undefined.
export function envValue(env, name) {
  const e = env || {};
  for (const p of ENV_PREFIXES) if (e[p + name] !== undefined) return e[p + name];
  return undefined;
}

// The full variable name that supplied the value, for messages: "CMMNS_PROTECT" or "DAYLIGHT_PROTECT".
export function envSource(env, name) {
  const e = env || {};
  const p = ENV_PREFIXES.find((x) => e[x + name] !== undefined);
  return p ? p + name : null;
}
