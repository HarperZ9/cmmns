// Draws radar-core results on the offline analyser page. Every string from the file goes in as
// text (textContent), never as markup, so a crafted file cannot run anything on the page.
(() => {
  "use strict";
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const LEVEL = [["warn", "Worth a look"], ["flag", "Signs that mean more alongside others"], ["info", "Context"]];
  const plural = (n, w) => `${n.toLocaleString("en")} ${w}${n === 1 ? "" : "s"}`;

  function item(e) {
    const li = el("li", e.level);
    li.append(el("p", "what", e.label));
    if (e.posts.length) li.append(el("p", "posts", `${e.posts.length === 1 ? "Post" : "Posts"} ${e.posts.slice(0, 8).join(", ")}${e.posts.length > 8 ? `, and ${e.posts.length - 8} more` : ""}`));
    li.append(el("p", null, e.shows));
    const spans = e.spans.filter((s) => s.text).slice(0, 3);
    if (spans.length) li.append(el("p", "match", spans.map((s) => `"${s.text}"`).join("  ")));
    li.append(el("p", "src", "Source: " + e.source));
    const dnp = el("p", "dnp");
    dnp.append(el("strong", null, "What it shows: "), document.createTextNode(e.context));
    li.append(dnp);
    return li;
  }

  function summary(r) {
    if (r.kind === "thread") return `${plural(r.posts.n, "post")} from ${r.posts.accounts === 1 ? "one account" : plural(r.posts.accounts, "account")}${r.site ? ` on ${r.site}` : ""}: ${plural(r.evidence.length, "evidence item")}.`;
    if (r.kind === "media") return `Content Credentials: ${r.media.state}${r.media.ai ? "; the file is marked as made with generative AI" : ""}.`;
    return `One text: ${plural(r.evidence.length, "evidence item")}.`;
  }

  // result: an envelope from radar-core; notes: lines about how the file was read.
  function show(root, result, notes) {
    root.querySelector("#summary").textContent = summary(result);
    const N = root.querySelector("#notes"); N.replaceChildren(...notes.map((n) => el("li", null, n)));
    const G = root.querySelector("#groups"); G.replaceChildren();
    for (const [level, title] of LEVEL) {
      const items = result.evidence.filter((e) => e.level === level);
      if (!items.length) continue;
      G.append(el("h3", "sub", `${title} (${items.length})`));
      const ul = el("ul", "ev"); ul.append(...items.map(item)); G.append(ul);
    }
    if (!result.evidence.length) G.append(el("p", "empty", "Nothing stands out in this file."));
    root.querySelector("#limits").replaceChildren(...result.limits.map((t) => el("p", "limit", t)));
    root.querySelector("#result").hidden = false;
  }

  function checks(list, v) {
    const head = el("li", v.ok ? "checks-pass" : "checks-fail", v.ok ? `Every check passes. Signed by key ${v.keyId}.` : `A check fails${v.keyId ? ` (key ${v.keyId})` : ""}.`);
    list.replaceChildren(head, ...v.checks.map((c) => el("li", null, `${c.ok ? "Pass" : "Fail"}, ${c.name}: ${c.text}.`)), el("li", "muted", PB.BUNDLE_DOES_NOT_PROVE));
  }

  // An evidence chain saved from "Save evidence chain" (src/core/evidence-seal.js chainChecks).
  function chain(list, c) {
    const head = el("li", c.ok ? "checks-pass" : "checks-fail", c.ok ? `Every check passes. An evidence chain of ${plural(c.size, "receipt")}.` : "A check fails. This evidence chain was changed after it was saved, or has parts missing.");
    const rows = c.checks.map((k) => el("li", null, `${k.ok ? "Pass" : "Fail"}, ${k.name}: ${k.text}.`));
    const held = c.receipts.slice(0, 20).map((r) => el("li", "muted", `${r.at || "no time"}: ${r.kind || "receipt"}${r.subject ? ` about ${r.subject}` : ""}, from ${r.source || "an unnamed source"}.`));
    list.replaceChildren(head, ...rows, ...held, el("li", "muted", c.dnp));
  }

  globalThis.PBAnalyzeView = Object.freeze({ show, checks, chain });
})();
