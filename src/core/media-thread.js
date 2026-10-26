// An author's own thread, proved part by part: each part answers the part before it (replyTo) and has
// the same author. Posts that only sit next to each other on a page are never joined; on a profile or
// a timeline they are unrelated posts by the same person (the 3.6.0 defect this replaces).

// The ids and texts after rootId, in order. posts: tweet records ({ id, author, replyTo, text, fullText }).
export function threadChain(posts, rootId, author, max = 25) {
  const list = [...posts], who = String(author || "").toLowerCase(), ids = [], texts = [];
  for (let cur = String(rootId), i = 0; i < max; i++) {
    const next = list.find((p) => p && p.replyTo === cur && p.author && p.author.toLowerCase() === who);
    if (!next) break;
    ids.push(next.id);
    if (next.fullText || next.text) texts.push(next.fullText || next.text);
    cur = next.id;
  }
  return { ids, texts };
}

// What a saved note's continuation can be trusted for, from its front matter and body:
// "verified" (3.6.1 and later, proved), "unknown" (a thread may exist that could not be proved),
// "unverified" (a continuation with no proof, as 3.6.0 wrote them on any page), or "none".
export function continuationStatus(markdown) {
  const md = String(markdown || ""), front = md.split("\n---\n")[0];
  const has = /\nContinued by the author:\n/.test(md);
  if (/\nthread_complete: true\n|\nthread_complete: true$/.test(front + "\n")) return has ? "verified" : "none";
  if (/\nthread_complete: "unknown"/.test(front + "\n")) return "unknown";
  return has ? "unverified" : "none";
}
