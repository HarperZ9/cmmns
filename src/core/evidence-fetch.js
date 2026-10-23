// The evidence lookups (project-docs/EVIDENCE-LAYER.md): one user click, for the post the user is
// viewing, asks GitHub, RDAP and the Internet Archive about the repositories and domains that post
// links to, and returns receipts. The fetch function is passed in, so tests run on fixtures and the
// extension's background worker passes the browser's fetch.
//
// Limits that hold: at most MAX_REPOS repositories and MAX_DOMAINS domains per click; at most
// STAR_MAX_PAGES stargazer pages per repository, and only with the user's own token; one request at a
// time per host; a 403 or 429 stops that host for the click and is reported, never retried around.

import { makeReceipt } from "./receipt.js";
import { GITHUB_API, repoFacts, starTimes, starPages, starBursts, REPO_DOES_NOT_PROVE, STARS_DOES_NOT_PROVE } from "./evidence-github.js";
import { rdapUrl, cdxUrl, rdapFacts, waybackFirst, daysBefore, hostedOn, DOMAIN_DOES_NOT_PROVE, WAYBACK_DOES_NOT_PROVE } from "./evidence-domain.js";

export const MAX_REPOS = 2, MAX_DOMAINS = 3, LOOKUP_TIMEOUT_MS = 15000;

async function getJson(fetchFn, url, headers = {}) {
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), LOOKUP_TIMEOUT_MS) : 0;
  try {
    const r = await fetchFn(url, { headers, ...(ctrl ? { signal: ctrl.signal } : {}), credentials: "omit", redirect: "follow" });
    if (!r.ok) return { status: r.status };
    return { status: r.status, json: await r.json() };
  } catch (e) {
    console.error("[daylight-commons] evidence lookup failed", url, e);
    return { status: "error" };
  } finally { if (timer) clearTimeout(timer); }
}

async function github(fetchFn, { owner, repo }, token, postedAt) {
  const base = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const out = [], notes = [];
  const r = await getJson(fetchFn, base, { Accept: "application/vnd.github+json" });
  const facts = r.json ? repoFacts(r.json) : null;
  if (!facts) return { receipts: out, notes: [`GitHub answered ${r.status} for ${owner}/${repo}.`] };
  const age = daysBefore(facts.created, postedAt);
  out.push(await makeReceipt({ kind: "github-repo", subject: facts.repo, observed: { ...facts, daysBeforePost: age }, raw: r.json, source: "GitHub REST API, repository endpoint", url: base, dnp: REPO_DOES_NOT_PROVE }));
  if (!token) return { receipts: out, notes: ["Star timestamps need your own GitHub token (GitHub requires a login for the stargazers list). Add one in Options to see star bursts."] };
  const plan = starPages(facts.stars), times = [];
  for (const p of plan.pages) {
    const s = await getJson(fetchFn, `${base}/stargazers?per_page=100&page=${p}`, { Accept: "application/vnd.github.star+json", Authorization: `Bearer ${token}` });
    if (!s.json) { notes.push(`GitHub stopped the star list at page ${p} (${s.status}); Daylight Commons does not retry around a limit.`); break; }
    times.push(...starTimes(s.json));
  }
  const bursts = starBursts(times);
  if (bursts) out.push(await makeReceipt({ kind: "github-stars", subject: facts.repo, observed: { ...bursts, pagesRead: plan.pages.length, pagesSkipped: plan.skipped }, source: "GitHub REST API, stargazers with timestamps (your token)", url: `${base}/stargazers`, dnp: STARS_DOES_NOT_PROVE }));
  return { receipts: out, notes };
}

async function domain(fetchFn, d, postedAt, wayback) {
  const out = [], notes = [];
  const host = hostedOn(d);
  if (host) notes.push(`${d} is a site on ${host}, a hosting service. RDAP dates ${host}, so it was skipped for this site.`);
  else {
    const r = await getJson(fetchFn, rdapUrl(d), { Accept: "application/rdap+json" });
    const f = r.json ? rdapFacts(r.json) : null;
    if (f && f.registered) out.push(await makeReceipt({ kind: "domain-registration", subject: f.domain, observed: { ...f, daysBeforePost: daysBefore(f.registered, postedAt) }, raw: r.json, source: "RDAP via rdap.org", url: rdapUrl(d), dnp: DOMAIN_DOES_NOT_PROVE }));
    else notes.push(`RDAP answered ${r.status} for ${d}.`);
  }
  if (!wayback) { notes.push(`The Internet Archive was skipped for ${d}: allow access to web.archive.org by turning Evidence lookups off and on again in Options.`); return { receipts: out, notes }; }
  const w = await getJson(fetchFn, cdxUrl(d));
  const first = w.json ? waybackFirst(w.json) : null;
  if (first) out.push(await makeReceipt({ kind: "wayback-first", subject: d, observed: { ...first, daysBeforePost: daysBefore(first.first, postedAt) }, raw: w.json, source: "Internet Archive Wayback CDX", url: cdxUrl(d), dnp: WAYBACK_DOES_NOT_PROVE }));
  else notes.push(w.json ? `The Internet Archive holds zero captures of ${d}.` : `The Internet Archive answered ${w.status} for ${d}.`);
  return { receipts: out, notes };
}

// { repos: [{ owner, repo }], domains: [string], postedAt, token?, wayback? } -> { receipts, notes }.
// wayback: false when the browser has not granted access to web.archive.org (its CDX sends no CORS
// header), so the archive is reported as not asked rather than as an error.
export async function lookupEvidence(fetchFn, { repos = [], domains = [], postedAt = null, token = null, wayback = true } = {}) {
  const receipts = [], notes = [];
  for (const x of repos.slice(0, MAX_REPOS)) { const g = await github(fetchFn, x, token, postedAt); receipts.push(...g.receipts); notes.push(...g.notes); }
  for (const d of domains.slice(0, MAX_DOMAINS)) { const g = await domain(fetchFn, d, postedAt, wayback); receipts.push(...g.receipts); notes.push(...g.notes); }
  if (repos.length > MAX_REPOS || domains.length > MAX_DOMAINS) notes.push(`Looked up the first ${MAX_REPOS} repositories and ${MAX_DOMAINS} domains.`);
  return { receipts, notes };
}
