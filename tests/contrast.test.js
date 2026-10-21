// Contrast of the window's text tokens on its own ground, in X's light, dim and dark themes,
// read from src/ext/badges.css. WCAG AA: 4.5:1 for body text; 3:1 for focus outlines.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/ext/badges.css", import.meta.url), "utf8");
const block = (sel) => {
  const m = css.match(new RegExp("^" + sel.replace(/\./g, "\.") + " \{([^}]*)\}", "m"));
  assert.ok(m, "missing " + sel);
  return Object.fromEntries([...m[1].matchAll(/--pb-([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
};
const rgb = (c) => {
  if (/^#[0-9a-f]{3}$/i.test(c)) c = "#" + [...c.slice(1)].map((x) => x + x).join("");
  if (c.startsWith("#")) return { r: parseInt(c.slice(1, 3), 16), g: parseInt(c.slice(3, 5), 16), b: parseInt(c.slice(5, 7), 16), a: 1 };
  const [r, g, b, a = 1] = c.match(/[\d.]+/g).map(Number);
  return { r, g, b, a };
};
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const light = block(":root"), dark = { ...light, ...block(".pb-dark") }, dim = { ...dark, ...block(".pb-dark.pb-dim") };
for (const [name, t] of [["light", light], ["dim", dim], ["dark", dark]]) {
  test(`${name}: ink, muted and hot text reach 4.5:1 on the ground and on the warm tint`, () => {
    const ground = rgb(t.ground), tint = over(rgb(t["hot-bg"]), ground);
    for (const k of ["ink", "muted", "hot"]) assert.ok(ratio(rgb(t[k]), ground) >= 4.5, `${name} ${k} ${ratio(rgb(t[k]), ground).toFixed(2)}`);
    assert.ok(ratio(rgb(t.hot), tint) >= 4.5, `${name} hot on tint ${ratio(rgb(t.hot), tint).toFixed(2)}`);
    assert.ok(ratio(rgb(t.ink), tint) >= 4.5, `${name} ink on tint`);
  });
  test(`${name}: the focus outline reaches 3:1 on the ground`, () => {
    assert.ok(ratio(rgb(t.focus), rgb(t.ground)) >= 3, name);
  });
}

test("no fixed accent blue is left in the window's styles", () => {
  assert.doesNotMatch(css, /#1d9bf0/i);
});
