// The self-check page. Made-up posts, half leaning on a move and half giving support, hard to
// easy, with an explanation after every answer. Answers stay in chrome.storage.local under
// PB.LEARN_KEY. The page never shows a score unless the user opens "How you are doing", and that
// shows discernment (hits against false alarms), never a count of fakes caught.
import { ORDERED, QUESTION, ANSWERS } from "./learn/quiz.js";
import { lesson } from "./learn/index.js";

const el = (tag, attrs = {}, text) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
};
const KEY = PB.LEARN_KEY;
const store = globalThis.chrome && chrome.storage && chrome.storage.local;
let state = { answers: {} };

async function load() {
  try { state = PB.normalizeLearn(store ? (await store.get(KEY))[KEY] : null); } catch (e) { console.error("[radar] could not read self-check answers", e); }
}
async function save() {
  try { if (store) await store.set({ [KEY]: state }); } catch (e) { console.error("[radar] could not save a self-check answer", e); }
}

function verdict(item, said) {
  const right = said === item.leans;
  const p = el("p", { class: "verdict" });
  p.append(el("strong", {}, right ? "Matches the answer. " : "The answer is the other one. "), document.createTextNode(item.explain + " "));
  const l = lesson(item.lesson);
  if (l) p.append(el("a", { href: `learn.html#${l.id}` }, `Lesson: ${l.title}`));
  return p;
}

function card(item, n) {
  const li = el("li", { class: "item" });
  li.append(el("p", { class: "muted mono" }, `Post ${n} of ${ORDERED.length}`), el("p", { class: "post" }, item.text));
  const row = el("div", { class: "row", role: "group", "aria-label": QUESTION });
  const out = el("div", { "aria-live": "polite" });
  for (const [key, label] of ANSWERS) {
    const b = el("button", { type: "button", class: "quiet" }, label);
    b.addEventListener("click", async () => {
      const said = key === "leans";
      state = PB.recordAnswer(state, item.id, said, Date.now());
      out.replaceChildren(verdict(item, said));
      await save();
      renderMine();
    });
    row.append(b);
  }
  const prior = state.answers[item.id];
  if (prior) out.append(verdict(item, prior.said));
  li.append(row, out);
  return li;
}

const pc = (x) => `${Math.round(x * 100)}%`;
function renderMine() {
  const box = document.getElementById("mine-body");
  const answered = ORDERED.filter((i) => state.answers[i.id]).length;
  const d = PB.discernment(ORDERED, state);
  const lines = [`You have answered ${answered} of ${ORDERED.length} posts. Your answers stay in this browser.`];
  if (!d) lines.push("Discernment shows once you have answered at least one post of each kind.");
  else {
    lines.push(`Posts that lean on a move, called leaning: ${d.hits} of ${d.signal} (${pc(d.hitRate)}).`);
    lines.push(`Posts that give support, called leaning: ${d.falseAlarms} of ${d.noise} (${pc(d.falseAlarmRate)}).`);
    lines.push(`Discernment, the first share minus the second: ${Math.round(d.difference * 100)} points. In signal detection terms, d' = ${d.dPrime.toFixed(2)}. Zero means no better than calling every post the same.`);
    const c = Math.abs(d.bias) < 0.2 ? "You call both kinds about evenly." : d.bias < 0 ? "You lean toward calling posts leaning. The research found this is the common trap: more doubt about everything, true posts included." : "You lean toward calling posts fair.";
    lines.push(c);
  }
  box.replaceChildren(...lines.map((t) => el("p", {}, t)));
}

async function start() {
  await load();
  const list = document.getElementById("items");
  list.replaceChildren(...ORDERED.map((item, i) => card(item, i + 1)));
  renderMine();
  document.getElementById("clear").addEventListener("click", async () => {
    state = { answers: {} };
    try { if (store) await store.remove(KEY); } catch (e) { console.error("[radar] could not clear self-check answers", e); }
    list.replaceChildren(...ORDERED.map((item, i) => card(item, i + 1)));
    renderMine();
  });
}

start().catch((e) => console.error("[radar] self-check page failed", e));
