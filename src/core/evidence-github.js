// GitHub facts for the evidence layer (project-docs/EVIDENCE-LAYER.md): a repository's creation
// date and star count from the public repository endpoint, and star bursts from the stargazers
// list with timestamps. Checked 2026-10-22: the repository endpoint answers without a login; the
// stargazers list answers 401 "Requires authentication", so star timestamps need the user's own
// GitHub token, which Daylight Commons keeps on this device and sends only to api.github.com.

export const GITHUB_API = "https://api.github.com";
export const STAR_MAX_PAGES = 10, STAR_PER_PAGE = 100;
export const STAR_BURST_FACTOR = 10, STAR_BURST_MIN = 50;
export const REPO_DOES_NOT_PROVE = "A creation date is when this repository was made on GitHub. Work often starts elsewhere or in another repository, so it says nothing about how long a team has been building.";
export const STARS_DOES_NOT_PROVE = "Stars arrive in bursts after a launch, a newsletter or a front-page link. A burst shows when stars came, not who gave them or why.";

// github.com/<owner>/<repo> links in a text or a list of links -> unique [{ owner, repo }].
export function reposIn(textOrLinks) {
  const s = Array.isArray(textOrLinks) ? textOrLinks.join(" ") : String(textOrLinks || "");
  const out = new Map();
  for (const m of s.matchAll(/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})/g)) {
    const owner = m[1], repo = m[2].replace(/\.git$/, "").replace(/[.,;:]+$/, "");
    if (/^(?:orgs|sponsors|features|topics|marketplace|settings|login|about|pricing)$/i.test(owner)) continue;
    out.set(`${owner}/${repo}`.toLowerCase(), { owner, repo });
  }
  return [...out.values()];
}

// The repository endpoint's JSON -> the facts Daylight Commons keeps.
export function repoFacts(json) {
  if (!json || !json.full_name) return null;
  return { repo: json.full_name, created: json.created_at || null, pushed: json.pushed_at || null, stars: Number.isFinite(json.stargazers_count) ? json.stargazers_count : null, forks: Number.isFinite(json.forks_count) ? json.forks_count : null };
}

// One stargazers page (Accept: application/vnd.github.star+json) -> ISO times.
export const starTimes = (page) => (Array.isArray(page) ? page.map((x) => x && x.starred_at).filter((t) => Number.isFinite(Date.parse(t))) : []);

// The page numbers to read for a repository with `stars` stars: the first STAR_MAX_PAGES / 2 and the
// last STAR_MAX_PAGES / 2, so a big repository costs at most STAR_MAX_PAGES requests and both its
// first stars and its latest are seen. The middle is reported as not read.
export function starPages(stars) {
  const total = Math.max(1, Math.ceil((stars || 0) / STAR_PER_PAGE));
  if (total <= STAR_MAX_PAGES) return { pages: Array.from({ length: total }, (_, i) => i + 1), total, skipped: 0 };
  const half = STAR_MAX_PAGES / 2;
  const pages = [...Array.from({ length: half }, (_, i) => i + 1), ...Array.from({ length: half }, (_, i) => total - half + 1 + i)];
  return { pages, total, skipped: total - STAR_MAX_PAGES };
}

// Star times -> stars per UTC day, and the busiest 24 hours against the median day with any stars.
export function starBursts(times) {
  const t = times.map((x) => Date.parse(x)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!t.length) return null;
  const perDay = {};
  for (const x of t) { const d = new Date(x).toISOString().slice(0, 10); perDay[d] = (perDay[d] || 0) + 1; }
  const counts = Object.values(perDay).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)];
  let best = { n: 0, from: null, to: null };
  for (let i = 0, j = 0; i < t.length; i++) {
    while (t[i] - t[j] > 86400000) j++;
    if (i - j + 1 > best.n) best = { n: i - j + 1, from: new Date(t[j]).toISOString(), to: new Date(t[i]).toISOString() };
  }
  const factor = median ? best.n / median : null;
  return { stars: t.length, days: counts.length, medianPerDay: median, busiest: best, factor, burst: best.n >= STAR_BURST_MIN && factor >= STAR_BURST_FACTOR };
}
