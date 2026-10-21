// The coordination graph on the history page: accounts that replied in at least two of the same
// threads the user opened (src/core/graph.js), drawn as a small force layout. Every account is a
// focusable point: Tab moves between accounts, and focus or the pointer lights its links. Enter
// on an account, or a click on a link, lists the evidence: the threads where the two replied. The
// table under the drawing holds the same pairs with their threads.
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const html = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const LABEL_NODES = 60, LABEL_EDGES = 150, TABLE_ROWS = 200;

  // parts: { svg, table, note, evidence }; net: the connections log.
  function render(parts, net, now = Date.now()) {
    const t0 = performance.now();
    const g = PB.coGraph(net, { min: 2, since: now - PB.RETAIN_DAYS * 86400000 });
    const big = g.nodes.length > LABEL_NODES, W = big ? 1200 : 720, H = big ? 800 : 400;
    const L = PB.forceLayout(g, { width: W, height: H, pad: 40 });
    const { svg, note } = parts;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    fillTable(parts.table, g.edges);
    if (!g.edges.length) { svg.setAttribute("hidden", ""); note.textContent = "No two accounts have replied in two or more of the same threads you opened yet."; return; }
    svg.removeAttribute("hidden");
    note.textContent = `${g.nodes.length} accounts and ${g.edges.length} links${g.truncated ? ", the most connected shown" : ""}. A link's number is how many threads both accounts replied in. Tab moves between accounts; Enter lists an account's threads. ${PB.GRAPH_DOES_NOT_PROVE}`;
    const at = new Map(L.nodes.map((n) => [n.id, n]));
    const edges = svgEl("g", { class: "edges" }), labels = svgEl("g", { class: "edge-labels" }), nodes = svgEl("g", { class: "nodes" });
    const max = Math.max(...g.edges.map((e) => e.n));
    for (const e of L.edges) {
      const a = at.get(e.a), b = at.get(e.b), say = `@${e.a} and @${e.b}: ${e.n} threads${e.sameText ? `, same wording in ${e.sameText}` : ""}`;
      const line = svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, "stroke-width": (1 + (3 * e.n) / max).toFixed(1), "data-a": e.a, "data-b": e.b });
      line.append(svgEl("title", {}, say + ". Click for the threads."));
      line.addEventListener("click", () => evidence(parts.evidence, [e], say));
      edges.append(line);
      if (L.edges.length <= LABEL_EDGES) labels.append(svgEl("text", { x: ((a.x + b.x) / 2).toFixed(1), y: ((a.y + b.y) / 2).toFixed(1), "data-a": e.a, "data-b": e.b }, String(e.n)));
    }
    for (const n of L.nodes) nodes.append(node(n, g.edges, parts, !big));
    svg.append(edges, labels, nodes);
    svg.dataset.renderMs = String(Math.round(performance.now() - t0));
  }

  function node(n, edges, parts, labelled) {
    const mine = edges.filter((e) => e.a === n.id || e.b === n.id);
    const top = [...mine].sort((x, y) => y.n - x.n).slice(0, 3).map((e) => `@${e.a === n.id ? e.b : e.a} (${e.n})`).join(", ");
    const label = `@${n.id}: in ${n.threads} threads you opened; replied alongside ${mine.length} account${mine.length === 1 ? "" : "s"} shown here, most often ${top}. Press Enter for the threads.`;
    const g = svgEl("g", { class: "node", tabindex: "0", role: "button", "aria-label": label, transform: `translate(${n.x} ${n.y})` });
    g.append(svgEl("title", {}, label), svgEl("circle", { r: (labelled ? 5 + Math.min(7, n.degree) : 3 + Math.min(4, n.degree / 2)).toFixed(1) }));
    if (labelled) g.append(svgEl("text", { x: 0, y: -14 }, "@" + n.id));
    const on = () => light(parts.svg, n.id), off = () => light(parts.svg, null), show = () => evidence(parts.evidence, mine, `Threads where @${n.id} replied alongside these accounts`);
    g.addEventListener("focus", on); g.addEventListener("blur", off);
    g.addEventListener("mouseenter", on); g.addEventListener("mouseleave", off);
    g.addEventListener("click", show);
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); show(); } });
    return g;
  }

  // Lights one account's links and dims the rest; null restores every link.
  function light(svg, id) {
    svg.classList.toggle("focused", !!id);
    for (const x of svg.querySelectorAll("[data-a]")) x.classList.toggle("lit", !!id && (x.dataset.a === id || x.dataset.b === id));
  }

  // The threads behind one or more links, as links where the thread key allows one.
  function threadLinks(keys) {
    const span = html("span");
    keys.forEach((k, i) => {
      const url = PB.threadUrl(k);
      if (i) span.append(", ");
      if (!url) { span.append(html("span", k, "mono")); return; }
      const a = html("a", k.replace(/^[a-z]+:/, "")); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; span.append(a);
    });
    return span;
  }

  function evidence(box, edges, title) {
    box.replaceChildren(html("h3", title));
    const ul = html("ul");
    for (const e of [...edges].sort((x, y) => y.n - x.n)) { const li = html("li", `@${e.a} and @${e.b}, ${e.n} threads${e.sameText ? ` (same wording in ${e.sameText})` : ""}: `); li.append(threadLinks(e.threads)); ul.append(li); }
    box.append(ul);
    box.hidden = false;
    box.focus();
  }

  function fillTable(table, edges) {
    const tb = table.querySelector("tbody");
    tb.replaceChildren();
    if (!edges.length) { const tr = html("tr"); const td = html("td", "None yet.", "empty"); td.colSpan = 4; tr.append(td); tb.append(tr); return; }
    for (const e of edges.slice(0, TABLE_ROWS)) {
      const tr = html("tr"), ev = html("td");
      ev.append(threadLinks(e.threads));
      tr.append(html("td", "@" + e.a), html("td", "@" + e.b), html("td", String(e.n), "n"), ev);
      tb.append(tr);
    }
  }

  globalThis.PBGraph = Object.freeze({ render });
})();
