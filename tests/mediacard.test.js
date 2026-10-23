// The window's media rows, in node over the core bundle, with the page-side reader stubbed: every
// network step is a click, and the notes say what goes where.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

await import("../src/ext/core.bundle.js");
const state = { checks: new Map(), frames: new Map(), clicked: [] };
const vid = { type: "video", url: "https://pbs.twimg.com/amplify_video_thumb/7/img/a.jpg", uploaded: "2026-01-01T00:00:00.000Z" };
const lifted = { ...vid, fromPost: "2", fromPostTime: "2026-03-01T00:00:00Z" };
const photo = { type: "photo", url: "https://pbs.twimg.com/media/ABC.jpg", uploaded: "2026-04-01T00:00:00.000Z" };
globalThis.PBMedia = {
  inPost: (node, t) => t.media.map((m, i) => ({ i, type: m.type === "photo" ? "image" : "video", src: m.type === "photo" ? m.url + "?name=small" : null, searchUrl: m.url, video: m.type === "photo" ? null : {}, media: m })),
  check: (u) => state.clicked.push(["check", u]), takeFrames: (k) => state.clicked.push(["frames", k]), searchFrame: () => {},
  checkOf: (u) => state.checks.get(u) || null, framesOf: (k) => state.frames.get(k) || null,
};
const posts = [{ id: "1", author: "early", posted: "2026-01-02T00:00:00Z", media: [vid] }, { id: "2", author: "later", posted: "2026-03-01T00:00:00Z", media: [vid] }];
const log = globalThis.PB.recordSpread({}, posts);
globalThis.PBLogs = { trail: () => log };
await import("../src/ext/mediacard.js");
const flat = (rows) => rows.map(([h, t]) => `${h} ${typeof t === "string" ? t : JSON.stringify(t)}`).join("\n");

test("video: first seen, the From credit, search links with their note, frames on click", () => {
  const tweet = { id: "3", author: "relay", posted: "2026-04-01T00:00:00Z", media: [lifted] };
  const rows = globalThis.PBMediaCard.rows({ tweet, tweets: new Map(posts.map((p) => [p.id, p])) });
  const t = flat(rows);
  assert.match(t, /First seen @early, 2026-01-02 00:00 UTC/);
  assert.match(t, /Re-shared from @later/);
  assert.match(t, /tineye\.com\/search\?url=/);
  assert.match(t, /sends this image's address to that service/);
  assert.match(t, /streamed in pieces/);
  rows.find(([h]) => h === "Frames")[1].action[1]();
  assert.deepEqual(state.clicked.pop(), ["frames", "3:0"]);
});

test("image: nothing is read until the click; then the reading shows, never a pass word on a stripped file", async () => {
  const tweet = { id: "4", media: [photo] };
  let rows = globalThis.PBMediaCard.rows({ tweet, tweets: new Map() });
  const act = rows.find(([h]) => h === "Content Credentials")[1];
  assert.equal(act.action[0], "Check this file");
  assert.match(flat(rows), /already loaded, from the same address, without cookies/);
  act.action[1]();
  assert.deepEqual(state.clicked.pop(), ["check", photo.url + "?name=small"]);
  const plain = new Uint8Array(readFileSync(new URL("./fixtures/c2pa/plain.jpg", import.meta.url)));
  state.checks.set(photo.url + "?name=small", { state: "done", result: await globalThis.PB.readCredentials(plain) });
  rows = globalThis.PBMediaCard.rows({ tweet, tweets: new Map() });
  assert.match(flat(rows), /Absent, the usual case: platforms often strip them/i);
});
