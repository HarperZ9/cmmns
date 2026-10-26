// The discourse results as a parts tree (refdb.parts/1, the reference library's study format: concept
// > layer > part > property, each property labelled observed, measured or inferred with its method),
// so a claim study is the same kind of object as an art study and joins the same concept layers.
const prop = (property, value, label, method, unit = null) => ({ property, value, ...(unit ? { unit } : {}), label, method });

function quoteLayer(q) {
  if (!q || (!q.results.length && !q.list)) return null;
  const parts = q.results.map((r) => ({ name: r.quote.slice(0, 120), tags: [r.status], properties: [
    prop("status", r.status, "measured", "quote finder: rarity-weighted word match over the bundled index"),
    ...(r.by ? [prop("credited to", r.by, "observed", "the post's own words")] : []),
    ...(r.work ? [prop("source", `${r.work.title}, ${r.work.author}${r.work.translator ? `, trans. ${r.work.translator}` : ""}, ${r.locator}`, "measured", "index match"), prop("share of meaning words", r.share, "measured", "rarity-weighted share", "0..1")] : []),
    ...(r.entry ? [prop("finding", r.entry.finding, "observed", `cited: ${r.entry.source}`)] : []),
  ] }));
  if (q.list) parts.push({ name: "list of attributions", tags: ["quote-list"], properties: [prop("lines", q.list.lines, "measured", "line count"), prop("sourced", q.list.sourced, "measured", "lines with a source"), prop("too short to look up", q.list.short, "measured", "lines under five words")] });
  return { name: "quotes", parts };
}

function docLayer(d) {
  if (!d) return null;
  return { name: "document pages", parts: [
    ...d.absent.map((x) => ({ name: x.term, tags: ["absent", x.kind], properties: [prop("on the pages shown", false, "measured", `word match over ${d.read} of ${d.images} images read by Daylight's recogniser`)] })),
    ...d.found.map((x) => ({ name: x.term, tags: ["found", x.kind], properties: [prop("images", x.images, "measured", "word match"), prop("line", x.snippet, "observed", "recogniser output")] })),
  ] };
}

function countLayer(counts) {
  if (!counts || !counts.length) return null;
  return { name: "counts", parts: counts.map((c) => ({ name: c.text.trim(), tags: c.small ? ["small sample"] : [], properties: [prop("k", c.k, "observed", "the post"), prop("n", c.n, "observed", "the post"), prop("95% interval", c.interval.map((v) => Math.round(v * 1000) / 1000), "measured", "Wilson score", "proportion")] })) };
}

function correctionLayer(ranked, independence) {
  if (!ranked || !ranked.length) return null;
  return { name: "correction replies", parts: [
    ...ranked.map((x) => ({ name: `@${x.author}`, tags: [x.source || "no link"], properties: [prop("score", x.score, "measured", "source kind, then specificity; likes not read"), prop("shared terms", x.shared, "measured", "content words shared with the post")] })),
    ...(independence ? [{ name: "independence", tags: ["metamer"], properties: [prop("replies", independence.replies, "measured", "raised replies"), prop("independent origins", independence.origins, "measured", "distinct sources; replies from one source count once")] }] : []),
  ] };
}

function personaLayer(p) {
  return p ? { name: "account", parts: [{ name: p.person.name, tags: ["persona"], properties: [prop("uses the name of", `${p.person.name} (${p.person.qid})`, "measured", "Wikidata name match with a second cue"), prop("cue", p.cue, "observed", "handle or display name")] }] } : null;
}

function argumentLayer(a) {
  if (!a || a.segments.length < 2) return null;
  return { name: "argument structure", parts: a.segments.map((s, i) => ({ name: `segment ${i + 1}`, tags: [s.role, ...(s.opener ? [s.opener.form] : [])], properties: [
    prop("text", s.text, "observed", "the post"), prop("role", s.role, "inferred", "argument lens: connective and position; role precision not yet measured"),
    ...(s.opener ? [prop("connective", s.opener.form, "measured", `lexicon match (${a.lang}); roles it can take: ${s.opener.roles.join(", ")}`)] : []),
  ] })).concat(a.units.map((u, i) => ({ name: `movement ${i + 1}`, tags: [u.movement], properties: [prop("segments", u.segments.map((k) => k + 1), "measured", "units cut at continuation connectives and conclusions"), prop("movement", u.movement, "inferred", "opening connective and shared words with the previous conclusion")] }))) };
}

function claimLayer(types, gaps, reframe) {
  const parts = [
    ...(types || []).map((t) => ({ name: t.text.slice(0, 120), tags: [t.type], properties: [prop("claim type", t.type, "inferred", `wording cue: ${t.cue}`)] })),
    ...(gaps || []).map((g) => ({ name: g.text.slice(0, 120), tags: ["inference gap", g.kind], properties: [prop("gap", g.why, "inferred", g.kind === "mind" ? `mind-reading cue "${g.cue}"` : "conclusion words absent from the premises")] })),
    ...(reframe ? [{ name: "reframing", tags: ["isomer"], properties: [prop("shared names", reframe.shared, "measured", "names found in the sources beneath"), prop("stated only to deny", reframe.denied, "measured", "negation within 80 characters before"), prop("in no source", reframe.added, "measured", "word match over the sources beneath")] }] : []),
  ];
  return parts.length ? { name: "claims", parts } : null;
}

// post: { site, postUrl, handle, author }; r: the results for one post.
export function discourseParts(post, r) {
  const layers = [quoteLayer(r.quotes), docLayer(r.doc), countLayer(r.counts), correctionLayer(r.corrections, r.independence), personaLayer(r.persona), argumentLayer(r.argument), claimLayer(r.types, r.gaps, r.reframing)].filter(Boolean);
  return {
    format: "refdb.parts/1", study: null,
    source: { site: post.site || null, postUrl: post.postUrl || null, author: { name: post.author || null, handle: post.handle || null } },
    concepts: [{ name: "Discourse checks", label: "measured", by: "code", layers }],
  };
}
