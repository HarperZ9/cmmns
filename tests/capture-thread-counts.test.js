// What a thread file's numbers may claim (src/core/capture-thread.js). Every case is planted, with the
// shape of a capture that went wrong: an empty thread called complete, "Captured 5 of 1" because a
// nested total met a direct count, a short capture called complete for the same reason, an empty
// thread told to open a page for comments that do not exist, and a post author's own continuation
// counted as other people's comments. Files already written in the first format stay readable.
import test from "node:test";
import assert from "node:assert/strict";
import { captureThread, completeness, completenessSentence, commentsMarkdown, countedTowardExpected, expectedCountsFor, readCaptureThread, threadSummary, CAPTURE_THREAD_FORMAT } from "../src/core/capture-thread.js";
import { postMeta, sidecarMarkdown } from "../src/core/media-meta.js";

const NOT_ON_PAGE = "the comments were not on this page; open the post's own page to save them";
const xPost = { url: "https://x.com/Painter/status/100", id: "100", author: "Painter" };
const x = (comments, expected, more = {}) => captureThread({ site: "x", post: xPost, comments, expected, ...more });
const direct = (id, author = "@ann") => ({ id, parent: null, author, text: id });
const under = (id, parent, author = "@bo") => ({ id, parent, author, text: id });

test("the format is versioned past the first one", () => {
  assert.equal(CAPTURE_THREAD_FORMAT, "cmmns.capture-thread/2");
  assert.equal(x([], 0).format, "cmmns.capture-thread/2");
});

test("an empty thread has its own state, and complete never claims it", () => {
  const c = x([], 0).completeness;
  assert.equal(c.complete, "empty");
  assert.notEqual(c.complete, true);
  assert.equal(c.missing, 0);
  assert.equal(completenessSentence(c), "No comments: the site counted none on this post.");
});

test("empty needs the site's own zero and nothing left to open", () => {
  assert.equal(completeness({ expected: null, captured: 0 }).complete, "unknown", "no count is no evidence of none");
  assert.equal(completeness({ expected: 0, captured: 0, stubs: 1 }).complete, false, "an unopened control can hold more");
  assert.equal(completeness({ expected: 0, captured: 0, capHit: true }).complete, false);
});

test("comments against a site count of zero are kept, and the count cannot confirm them", () => {
  const c = x([direct("1")], 0).completeness;
  assert.equal(c.complete, "unknown");
  assert.equal(completenessSentence(c), "Captured 1 comment; the site counted none.");
});

test("an empty thread is never told to open the post's page; comments that exist elsewhere still are", () => {
  const empty = x([], 0, { reason: NOT_ON_PAGE }).completeness;
  assert.equal(empty.reason, null);
  assert.doesNotMatch(completenessSentence(empty), /open the post/);
  const elsewhere = x([], 9, { reason: NOT_ON_PAGE }).completeness;
  assert.equal(elsewhere.complete, false);
  assert.equal(elsewhere.reason, NOT_ON_PAGE);
  assert.match(completenessSentence(elsewhere), /^Captured 0 of 9 direct replies; the comments were not on this page/);
});

test("X's count is of direct replies, so one direct reply with four beneath it reads 1 of 1, never 5 of 1", () => {
  const t = x([direct("1"), under("2", "1"), under("3", "2"), under("4", "3"), under("5", "1")], 1);
  const c = t.completeness;
  assert.deepEqual([c.expected, c.expectedCounts, c.captured, c.capturedDirect, c.capturedNested, c.missing, c.complete], [1, "direct", 5, 1, 4, 0, true]);
  const line = completenessSentence(c);
  assert.equal(line, "Captured 1 of 1 direct reply, and 4 more deeper in the thread.");
  assert.doesNotMatch(line, /5 of 1/);
  assert.match(commentsMarkdown(t).join("\n"), /Captured 1 of 1 direct reply, and 4 more/);
});

test("a nested total cannot hide missing direct replies", () => {
  const flat = [...Array.from({ length: 16 }, (_, i) => direct(`d${i}`)), ...Array.from({ length: 5 }, (_, i) => under(`n${i}`, "d0"))];
  const c = x(flat, 18).completeness;
  assert.deepEqual([c.captured, c.capturedDirect, c.missing, c.complete], [21, 16, 2, false]);
  assert.match(c.countNote, /deleted, removed or hidden/);
  assert.equal(completenessSentence(c), "Captured 16 of 18 direct replies, and 5 more deeper in the thread.");
});

test("a reply whose parent was not captured is not a direct reply", () => {
  const c = x([under("2", "gone")], 1).completeness;
  assert.deepEqual([c.capturedDirect, c.capturedNested, c.missing, c.complete], [0, 1, 1, false]);
});

test("a site that counts every comment compares against every comment", () => {
  for (const site of ["reddit", "youtube", "instagram"]) assert.equal(expectedCountsFor(site), "all", site);
  assert.equal(expectedCountsFor("x"), "direct");
  const c = captureThread({ site: "reddit", comments: [direct("1"), under("2", "1")], expected: 2 }).completeness;
  assert.deepEqual([c.expectedCounts, c.capturedDirect, c.capturedNested, c.missing, c.complete], ["all", 1, 1, 0, true]);
  assert.equal(completenessSentence(c), "Captured 2 of 2 comments.");
});

test("the opening of more stops on the count that compares with the site's", () => {
  const flat = [direct("1"), under("2", "1"), under("3", "1")];
  assert.equal(countedTowardExpected(flat, "x"), 1);
  assert.equal(countedTowardExpected(flat, "reddit"), 3);
});

test("the author's own continuation is labelled and counted apart; the author answering someone, or someone answering the chain, is a comment", () => {
  const t = x([direct("1", "@painter"), under("2", "1", "@PAINTER"), under("3", "2", "@ann"), direct("4", "@bo"), under("5", "4", "@painter")], 2);
  const c = t.completeness;
  const [a, b] = t.comments;
  assert.equal(a.continuation, true);
  assert.equal(a.replies[0].continuation, true);
  assert.equal(a.replies[0].replies[0].continuation, undefined, "another person, under the chain");
  assert.equal(b.continuation, undefined);
  assert.equal(b.replies[0].continuation, undefined, "the author answering a commenter");
  assert.deepEqual([c.captured, c.continuations, c.capturedDirect, c.complete], [5, 2, 2, true], "X's count includes the author's direct replies");
  assert.equal(completenessSentence(c), "Captured 2 of 2 direct replies, and 3 more deeper in the thread; 2 of 5 are the post author's own continuation.");
  const md = commentsMarkdown(t).join("\n");
  assert.match(md, /^- \*\*@painter\*\* \(the post author's continuation\)$/m);
  assert.match(md, /^  - \*\*@PAINTER\*\* \(the post author's continuation\)$/m);
  assert.match(md, /^- \*\*@bo\*\*$/m);
});

test("a handle matches across the site's prefix, and an unknown post author leaves continuations unknown", () => {
  const r = captureThread({ site: "reddit", post: { author: "u/Ann" }, comments: [direct("1", "u/ann")], expected: 1 });
  assert.equal(r.completeness.continuations, 1);
  const none = captureThread({ site: "reddit", comments: [direct("1", "u/ann")], expected: 1 });
  assert.equal(none.completeness.continuations, null);
  assert.equal(none.comments[0].continuation, undefined);
  const nobody = captureThread({ site: "reddit", post: { author: "u/ann" }, comments: [direct("1", null)], expected: 1 });
  assert.equal(nobody.completeness.continuations, 0, "a deleted author matches no one");
});

test("the sidecar and its summary carry the separate counts and the empty state", () => {
  const t = x([direct("1"), under("2", "1")], 1);
  assert.deepEqual(threadSummary(t, "a.thread.json"), { file: "a.thread.json", expected: 1, expectedCounts: "direct", captured: 2, capturedDirect: 1, capturedNested: 1, continuations: 0, complete: true, capHit: false, cap: 200, moreStubs: 0 });
  const md = sidecarMarkdown({ ...postMeta({ site: "x", postUrl: xPost.url }), threadCapture: t, threadFile: "a.thread.json" }, []);
  assert.match(md, /^comments_expected_counts: "direct"$/m);
  assert.match(md, /^comments_direct: 1$/m);
  assert.match(md, /^comments_nested: 1$/m);
  assert.match(md, /^comments_continuations: 0$/m);
  const none = sidecarMarkdown({ ...postMeta({ site: "x", postUrl: xPost.url }), threadCapture: x([], 0), threadFile: "b.thread.json" }, []);
  assert.match(none, /^comments_complete: "empty"$/m);
  assert.match(none, /No comments: the site counted none on this post\./);
});

// The first format, as version 3.9.1 wrote it: no post author, and one captured total.
const v1 = (completenessBlock, comments = [], url = "https://x.com/painter/status/100") => ({
  format: "cmmns.capture-thread/1", site: "x", post: { url, id: "100" }, savedAt: "2026-10-31T10:02:34.846Z", source: "the page's own data (X's answers to the page)",
  completeness: { missing: 0, cap: 200, capHit: false, moreStubs: 0, expanded: 0, reason: null, countNote: null, ...completenessBlock }, comments,
});
const node = (id, author, replies = [], extra = {}) => ({ id, author, text: id, links: [], replies, depth: 0, ...extra });

test("a first-format empty file reads as empty, without its stale advice", () => {
  const r = readCaptureThread(v1({ expected: 0, captured: 0, complete: true, reason: NOT_ON_PAGE }));
  assert.equal(r.format, "cmmns.capture-thread/2");
  assert.equal(r.upgradedFrom, "cmmns.capture-thread/1");
  assert.equal(r.completeness.complete, "empty");
  assert.equal(r.completeness.reason, null);
  assert.equal(r.post.author, "painter", "taken from the post's address");
});

test("a first-format 5 of 1 reads as 1 of 1 with its continuation labelled, and the file's object is left alone", () => {
  const file = v1({ expected: 1, captured: 5, complete: true }, [node("1", "@painter", [node("2", "@painter", [node("3", "@ann", [node("4", "@bo", [node("5", "@cy")])])])])]);
  const before = JSON.stringify(file);
  const r = readCaptureThread(file);
  const c = r.completeness;
  assert.deepEqual([c.expected, c.captured, c.capturedDirect, c.capturedNested, c.continuations, c.missing, c.complete], [1, 5, 1, 4, 2, 0, true]);
  assert.equal(r.comments[0].continuation, true);
  assert.equal(r.comments[0].replies[0].replies[0].continuation, undefined);
  assert.equal(JSON.stringify(file), before);
});

test("a first-format file that claimed complete on a nested total now says what is missing", () => {
  const r = readCaptureThread(v1({ expected: 2, captured: 3, complete: true }, [node("1", "@ann", [node("2", "@bo"), node("3", "@cy")])]));
  assert.deepEqual([r.completeness.capturedDirect, r.completeness.missing, r.completeness.complete], [1, 1, false]);
  assert.match(r.completeness.countNote, /deleted, removed or hidden/);
});

test("a first-format file with no author in its address keeps continuations unknown, and keeps cap, stubs and reason", () => {
  const r = readCaptureThread({ ...v1({ expected: 4, captured: 1, complete: false, cap: 10, capHit: true, moreStubs: 2, expanded: 3, reason: "Stop was pressed" }, [node("1", "u/ann")], "https://www.reddit.com/r/a/comments/x1/s/"), site: "reddit" });
  const c = r.completeness;
  assert.deepEqual([c.continuations, c.cap, c.capHit, c.moreStubs, c.expanded, c.reason, c.expectedCounts], [null, 10, true, 2, 3, "Stop was pressed", "all"]);
});

test("a current file reads as itself, and a format this build does not know is refused by name", () => {
  const t = x([direct("1")], 1);
  assert.deepEqual(readCaptureThread(t), t);
  assert.deepEqual(readCaptureThread(readCaptureThread(v1({ expected: 0, captured: 0, complete: true }))).completeness.complete, "empty");
  assert.throws(() => readCaptureThread({ format: "cmmns.capture-thread/9" }), /cmmns\.capture-thread\/9/);
  assert.throws(() => readCaptureThread(null), /thread file/);
});
