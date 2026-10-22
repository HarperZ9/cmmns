// Synthetic launch-campaign fixtures (project-docs/CAMPAIGN-LENS.md, "Controls that must fail").
// Everything here is invented: handles are generated, bios are cut from made-up templates in the
// shape of the patterns studied, and no real account, post or screenshot text is used.

const T0 = Date.parse("2026-06-01T15:00:00Z");
const iso = (ms) => new Date(ms).toISOString();
// A deterministic generator so fixtures never change between runs.
export function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];

const JOBS = ["Recruiter", "Nurse", "Carpenter", "Baker", "Pilot", "Teacher", "Plumber", "Designer"];
const PLACES = ["Avalon", "Brightwater", "Calder", "Dunmore", "Eastvale", "Fairhaven", "Glenrock", "Harlow"];
const COINS = ["WBTC", "ETH", "SOL", "DOGE"];
const HOBBIES = ["Candle Making", "Pottery", "Birdwatching", "Origami", "Knitting", "Chess"];
const PETS = ["Cat person", "Dog lover"];

// Two templates in the studied shape: a job-place-coin template and an age-hobby-crypto-pet template.
export function farmBio(r, i) {
  return i % 2
    ? `A ${pick(r, JOBS)} in ${pick(r, PLACES)}, stacking ${pick(r, COINS)} like a pro. Here for the memes.`
    : `Age ${30 + Math.floor(r() * 30)}, still young at heart, passionate about ${pick(r, HOBBIES)}. Crypto is the future. | ${pick(r, PETS)}`;
}

export function farmHandle(r) {
  const a = "abcdefghjkmnpqrstuvwxyz";
  const w = Array.from({ length: 4 + Math.floor(r() * 3) }, () => pick(r, a)).join("");
  return `${w}_${Math.floor(r() * 9)}${pick(r, a)}${Math.floor(r() * 9)}`;
}

// Varied, human-looking bios with no shared template.
const ORGANIC_BIOS = [
  "Backend engineer. Opinions on caching are mine.", "PhD student working on retrieval and evals.", "I build tools for climate scientists",
  "Dad of two, writes Rust on weekends", "ML at a small startup; previously robotics", "Open source maintainer, coffee snob",
  "Teaching kids to code since 2012", "Data journalist. DMs open for tips", "Compilers, type systems and long walks",
  "Product designer who still writes CSS", "Indie hacker shipping small apps", "GPU kernels and bad puns",
  "Security researcher. Views my own", "Writing a book about databases", "Statistician turned software person",
  "Running an AI reading group in my town", "Hardware tinkerer, synth builder", "Infra at a fintech, mostly Kubernetes",
  "Linguist working on speech models", "Mobile dev, Android mostly", "Physics teacher curious about LLMs",
  "Accessibility advocate and frontend dev", "Researcher in human computer interaction", "Startup founder, second time",
];

export function organicAccounts(n, seed = 7, { joinFrom = Date.parse("2012-01-01"), spreadDays = 4000 } = {}) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => ({ handle: `person${i}${pick(r, ["dev", "codes", "writes", "reads"])}`, bio: ORGANIC_BIOS[i % ORGANIC_BIOS.length], joinDate: iso(joinFrom + Math.floor(r() * spreadDays) * 86400000).slice(0, 10) }));
}

export function farmAccounts(n, seed = 11) {
  const r = rng(seed);
  const join = Date.parse("2026-04-20");
  return Array.from({ length: n }, (_, i) => ({ handle: farmHandle(r), bio: farmBio(r, i), joinDate: iso(join + Math.floor(r() * 10) * 86400000).slice(0, 10) }));
}

export const LAUNCH_TEXT = "We are announcing the public beta of our data platform for AI research teams. Open API, open benchmark.";

// Paid quotes in one template inside an hour, half labelled.
export function campaignQuotes(n = 8, seed = 3) {
  const r = rng(seed);
  const openers = ["sir... they just dropped", "sir… they just dropped", "sir... they just launched"];
  return Array.from({ length: n }, (_, i) => ({ id: `q${i}`, author: farmHandle(r), posted: iso(T0 + i * 6 * 60000), paidPartnership: i % 2 === 0, text: `${pick(r, openers)} a data platform that ${pick(r, ["changes everything for", "is insane for", "rewires"])} AI research teams` }));
}

// Ordinary quotes: varied wording, spread over a day.
export function organicQuotes(n = 8) {
  const lines = ["Tried the beta, the API docs need work but the idea is solid", "Curious how they handle licensing for scraped data",
    "We need more of this in academia", "Pricing page is missing, anyone know?", "Congrats to the team, long time coming",
    "How does this compare to existing dataset hubs", "Signed up, waiting list is long", "Interesting, but who audits the data?"];
  return Array.from({ length: n }, (_, i) => ({ id: `o${i}`, author: `reader${i}`, posted: iso(T0 + i * 3 * 3600000), paidPartnership: false, text: lines[i % lines.length] }));
}

// The author's own ordinary posts: likes well above reposts.
export const OWN_POSTS = [
  { reposts: 22, likes: 304 }, { reposts: 12, likes: 180 }, { reposts: 40, likes: 520 }, { reposts: 5, likes: 61 },
  { reposts: 30, likes: 410 }, { reposts: 9, likes: 140 },
];
export const LAUNCH_COUNTS = { reposts: 5200, likes: 631, replies: 131, bookmarks: 426, views: 211000, followers: 40000, text: LAUNCH_TEXT };
export const ORDINARY_COUNTS = { reposts: 16, likes: 306, replies: 42, bookmarks: 57, views: 31000, followers: 40000, text: LAUNCH_TEXT };
