// The lessons page: the index of lessons, or one lesson when the address ends in #<id>. Built from
// data with textContent only. Everything is local; the page makes no network request, and the
// research links open only when clicked.
import { GROUPS, lesson, doesNotProve, readSeconds, TRUE_TOO } from "./learn/index.js";
import { RESEARCH, METHOD } from "./learn/research.js";

const el = (tag, attrs = {}, text) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
const DNP = (globalThis.PB && PB.DOES_NOT_PROVE) || {};
const KIND = { sign: "Shows the sign", fair: "Fair use of the same words", ordinary: "Ordinary account, same sign" };
const main = document.getElementById("main");

function section(title, ...nodes) {
  const s = el("section");
  s.append(el("h2", {}, title), ...nodes);
  return s;
}

function sourceList(keys) {
  const ul = el("ul", { class: "sources" });
  for (const k of keys) {
    const r = RESEARCH[k];
    if (!r) continue;
    const li = el("li");
    const a = el("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, r.cite);
    li.append(a, el("p", { class: "muted" }, `${r.found} Limit: ${r.limit}`));
    ul.append(li);
  }
  return ul;
}

function examples(l) {
  const ul = el("ul", { class: "examples" });
  for (const x of l.examples) {
    const li = el("li", { class: `ex ex-${x.kind}` });
    li.append(el("span", { class: "ex-kind" }, KIND[x.kind] || x.kind), el("p", {}, x.text));
    ul.append(li);
  }
  return ul;
}

function measured(id) {
  if (!globalThis.PB || !PB.measuredLine || id === "thread-report") return null;
  return el("p", { class: "figure muted" }, `How Radar measures it: ${PB.measuredLine(id).text}.`);
}

function showLesson(l) {
  document.title = `${l.title}: a Radar lesson`;
  const head = el("header");
  head.append(el("p", { class: "muted" }, `Lesson, about ${readSeconds(l, DNP)} seconds`), el("h1", {}, l.title), el("p", { class: "lead" }, l.what));
  const dnp = el("div");
  dnp.append(el("p", {}, doesNotProve(l, DNP)), el("p", { class: "true-too" }, TRUE_TOO));
  const parts = [
    head,
    section("Made-up examples", el("p", { class: "muted" }, "No real person wrote these."), examples(l)),
    section("Why it works on people", el("p", {}, l.why)),
    section("See it without Radar", el("p", {}, l.spot)),
    section("The counter-move", el("p", {}, l.counter)),
    section("What the sign does not prove", dnp),
  ];
  const m = measured(l.id);
  if (m) parts.push(m);
  if (l.research.length) parts.push(section("Research", sourceList(l.research)));
  const nav = el("nav", { class: "row" });
  nav.append(el("a", { href: "learn.html" }, "All lessons"), el("a", { href: "quiz.html" }, "Try the self-check"));
  parts.push(nav);
  main.replaceChildren(...parts);
  window.scrollTo(0, 0);
}

function showIndex() {
  document.title = "Radar lessons";
  const head = el("header");
  head.append(el("h1", {}, "Learn to see it yourself"), el("p", { class: "lead" },
    "Every sign Radar shows has a lesson of a minute or two: what the move is, a made-up example, why it works on people, how to spot it without Radar, and what it does not prove."));
  const parts = [head];
  for (const [name, ids] of GROUPS) {
    const ul = el("ul", { class: "index" });
    for (const id of ids) {
      const l = lesson(id);
      if (!l) continue;
      const li = el("li");
      li.append(el("a", { href: `#${id}` }, l.title), el("span", { class: "muted mono" }, ` ${readSeconds(l, DNP)} s`));
      ul.append(li);
    }
    parts.push(section(name, ul));
  }
  const how = el("div");
  for (const p of METHOD) how.append(el("p", {}, p));
  parts.push(section("How these lessons work", how), section("Research", sourceList(Object.keys(RESEARCH))));
  const nav = el("nav", { class: "row" });
  nav.append(el("a", { href: "quiz.html" }, "Try the self-check"));
  parts.push(nav);
  main.replaceChildren(...parts);
}

function route() {
  const id = decodeURIComponent(location.hash.slice(1));
  const l = id ? lesson(id) : null;
  if (l) showLesson(l); else showIndex();
}

window.addEventListener("hashchange", route);
route();
