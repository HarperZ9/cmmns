// "What Daylight shows about you": Daylight's own account signals, run on the user's own account
// only, each with what it reveals and how to reduce it. Ownership is proved two ways and no other:
// the page itself shows the signed-in account on its own profile (ownedProfile), or the input is
// the platform's own data export, which only the account holder can download. There is no way to
// name an account: no function here takes a handle from the user. Pure and local; nothing is sent.

import { flagsFor, DOES_NOT_PROVE, storeCountry, nameFlags, ageDays } from "./flags.js";
import { postingPattern } from "./pattern.js";
import { xArchivePosts, redditExportPosts, mastodonOutboxPosts } from "./import-exports.js";

export const SELF_AUDIT_NOT_CHECKED = [
  "what your photos and videos show (faces, places, screens, reflections)",
  "who you follow and who follows you, by name",
  "what friends tag you in or say about you",
  "data brokers, leaks and the platform's own records",
  "your writing style, which can identify a person across accounts",
  "your other accounts: this audit never links accounts or platforms",
];
export const SELF_AUDIT_REFUSED = "This works only on your own account: open your own profile while signed in (the page must show the signed-in account and its Edit profile button), or load the data export the platform gave you.";

const clean = (h) => String(h || "").trim().replace(/^@/, "").toLowerCase();

// The handle the page proves is the signed-in user's own profile, or null. markers: what the page
// itself shows, read by src/ext/selfaudit-page.js: { signedIn (the account menu's profile link),
// pageHandle (the profile being shown), editProfile (the Edit profile button is present) }.
export function ownedProfile(markers = {}) {
  const a = clean(markers.signedIn), b = clean(markers.pageHandle);
  if (!a || !b || a !== b || markers.editProfile !== true) return null;
  return /^[a-z0-9_]{1,15}$/.test(a) ? a : null;
}

// The hours of the UTC day with posts, the longest quiet stretch and the UTC offset that puts it
// around 01:00 to 07:00 local, the usual sleeping hours. hist: 24 counts.
export function postingClock(hist) {
  if (!Array.isArray(hist) || hist.length !== 24 || !hist.some((x) => x > 0)) return null;
  const total = hist.reduce((s, x) => s + x, 0), quiet = (h) => hist[h % 24] <= total * 0.01;
  let best = { start: 0, len: 0 };
  for (let s = 0; s < 24; s++) { let len = 0; while (len < 24 && quiet(s + len)) len++; if (len > best.len) best = { start: s, len }; }
  if (best.len < 3) return { active: hist.filter((x) => x > 0).length, quietHours: best.len, offset: null };
  const mid = (best.start + best.len / 2) % 24, off = ((Math.round(4 - mid) + 36) % 24) - 12;
  return { active: hist.filter((x) => x > 0).length, quietHours: best.len, quietFromUtc: best.start, offset: off };
}

function row(id, title, shows, reveals, reduce) { return { id, title, shows, reveals, reduce }; }

function placeRows(a) {
  const out = [];
  if (a.basedIn) out.push(row("place-label", "Place label", `The platform labels this account as based in ${a.basedIn}${a.proxyNote ? ", and notes the location may be inaccurate" : ""}.`, "Anyone who opens your About page sees this country or region, and Daylight shows it beside your replies.", "The platform sets it from its own data (sign-up, network, phone). You cannot edit it. A VPN changes what it sees from now on; the label can lag."));
  const store = storeCountry(a.connectedVia);
  if (store) out.push(row("app-store", "App store country", `Connected via ${a.connectedVia}.`, `The country of the app store your phone uses: ${store}.`, "It follows your app store account's country. It cannot be hidden from this page."));
  if (a.profileLocation) out.push(row("profile-location", "Profile location", `Your profile says "${a.profileLocation}".`, "A place you typed yourself, shown to everyone.", "Edit your profile and clear the location, or make it vaguer."));
  const flags = nameFlags(a.display);
  if (flags.length) out.push(row("name-flag", "Flag in your name", `Your display name shows the flag of ${flags.join(", ")}.`, "A country you chose to show.", "Remove the flag from your display name if you do not want it read as where you are."));
  return out;
}

function accountRows(a, now) {
  const out = [], age = ageDays(a.joinDate, now);
  if (age != null) out.push(row("account-age", "Account age", `Joined ${a.joinDate} (${age} days ago).`, "When you started, which can match a job, a move or an event.", "It cannot be changed. A new account starts a new date, and new accounts draw more suspicion."));
  if (Number.isFinite(a.nameChanges)) out.push(row("renames", "Username changes", `Username changed ${a.nameChanges} time${a.nameChanges === 1 ? "" : "s"}.`, "The count is public, and old handles survive in archives, quotes and replies.", "Each change adds to the count. Old names cannot be removed from what others saved."));
  if (Number.isFinite(a.followersCount) && Number.isFinite(a.followingCount)) out.push(row("follow-counts", "Follow counts", `${a.followersCount} followers, following ${a.followingCount}.`, "The size of your circle; the lists themselves are public unless the account is protected.", "A protected account hides the lists and posts from people you have not approved."));
  return out;
}

function postingRows(p) {
  const out = [];
  if (!p) return out;
  const clock = postingClock(p.hourHist);
  if (clock) out.push(row("posting-clock", "Posting clock", clock.offset == null ? `Posts in ${clock.active} of the 24 hours of the day, with no long quiet stretch (${p.posts} posts).` : `Posts in ${clock.active} of 24 hours; quiet for ${clock.quietHours} hours from ${String(clock.quietFromUtc).padStart(2, "0")}:00 UTC (${p.posts} posts).`, clock.offset == null ? "Round-the-clock posting is one of the signs Daylight shows for automated accounts." : `Your quiet hours fit sleep at about UTC${clock.offset >= 0 ? "+" : ""}${clock.offset}, which points to your time zone and your sleeping hours.`, "Times cannot be hidden once posted. Scheduling posts at varied hours, or posting less from an account you keep apart, blurs the pattern."));
  if (p.clients && p.clients.length) out.push(row("posting-apps", "Posting apps", `Posted from ${p.clients.map((c) => `${c.name} (${Math.round(c.share * 100)}%)`).join(", ")}.`, "The kind of phone or tool you use. The platform's data carries it even where the page no longer shows it.", "Posting from the web app makes it the same as most people's. Scheduling tools show up by name."));
  if (Number.isFinite(p.perDay)) out.push(row("volume", "How often you post", `About ${p.perDay} posts a day over ${p.days} days.`, "How much time you spend here, and when you are busy.", "Volume shows over time; posting less, or in batches, changes it."));
  return out;
}

function sameTextRows(posts) {
  const seen = new Map();
  for (const p of posts || []) { const t = String(p.text || "").trim().toLowerCase(); if (t.length >= 20) seen.set(t, (seen.get(t) || 0) + 1); }
  const repeats = [...seen.values()].filter((n) => n > 1);
  return repeats.length ? [row("repeated-text", "Words you repeat", `${repeats.length} of your texts were posted more than once.`, "Repeated wording links posts together and can link accounts that use it.", "Varying how you word things makes posts harder to link.")] : [];
}

// The audit. input: { site, source: "page" | "export", account, pattern | posts, now }.
export function selfAudit(input = {}) {
  const a = input.account || {}, now = input.now || Date.now();
  const pattern = input.pattern || (input.posts ? postingPattern(input.posts.map((p, i) => ({ id: p.id || String(i), posted: p.posted, client: p.client || null }))) : null);
  const flags = flagsFor({ ...a, pattern }, { now }).map((f) => ({ id: f.id, evidence: f.evidence, doesNotProve: DOES_NOT_PROVE[f.id] || null }));
  return {
    site: input.site || null, source: input.source || null, local: true,
    signals: [...placeRows(a), ...accountRows(a, now), ...postingRows(pattern), ...sameTextRows(input.posts)],
    flags, notChecked: SELF_AUDIT_NOT_CHECKED,
  };
}

// window.YTD.<part>.part0 = [...] from an X archive file, or null.
function ytd(text, part) {
  const s = String(text || ""), at = s.indexOf("=");
  if (!new RegExp(`^\s*window\.YTD\.${part}\.`).test(s) || at < 0) return null;
  try { return JSON.parse(s.slice(at + 1).trim().replace(/;\s*$/, "")); } catch { return null; }
}

// The app each post was sent from, which an X archive keeps in tweets.js as an HTML link.
function withClients(posts, text) {
  const rows = ytd(text, "tweets") || ytd(text, "tweet");
  if (!rows) return posts;
  const app = new Map(rows.map((r) => r.tweet || r).filter((t) => t && t.source).map((t) => [String(t.id_str || t.id), String(t.source).replace(/<[^>]*>/g, "").trim() || null]));
  return posts.map((p) => ({ ...p, client: app.get(p.id) || null }));
}

// The audit input from the files of a platform's own data export: an X archive's tweets.js (with
// account.js and profile.js when given), a Reddit export CSV or a Mastodon outbox.json. Returns
// { ok, input } or { ok: false, reason }. files: [{ name, text }].
export function exportAuditInput(files = []) {
  const account = {}, posts = [], sites = new Set();
  let site = null;
  for (const f of files) {
    const acc = ytd(f.text, "account"), prof = ytd(f.text, "profile");
    if (acc && acc[0] && acc[0].account) { site = "X"; sites.add("X"); Object.assign(account, { joinDate: String(acc[0].account.createdAt || "").slice(0, 10) || null, display: acc[0].account.accountDisplayName || null, handle: acc[0].account.username || null }); continue; }
    if (prof && prof[0] && prof[0].profile) { site = "X"; sites.add("X"); account.profileLocation = (prof[0].profile.description || {}).location || null; continue; }
    const got = xArchivePosts(f.text) || (/\.csv$/i.test(f.name) ? redditExportPosts(f.text) : null) || (() => { try { return mastodonOutboxPosts(JSON.parse(f.text)); } catch { return null; } })();
    if (got && got.posts.length) { site = got.site || site; sites.add(site); posts.push(...withClients(got.posts, f.text)); }
  }
  if (sites.size > 1) return { ok: false, reason: `These files come from ${[...sites].join(" and ")}. The audit reads one platform at a time and never links accounts.` };
  if (!posts.length && !Object.keys(account).length) return { ok: false, reason: `No posts or account found. ${SELF_AUDIT_REFUSED}` };
  return { ok: true, input: { site, source: "export", account: Object.fromEntries(Object.entries(account).filter(([, v]) => v)), posts } };
}
