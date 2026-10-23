// The demo stage (scripts/demo/README.md): synthetic X pages and X-shaped responses for filming the
// installed extension. Every account, post and company is invented and every handle starts with
// demo_. capture.py answers x.com addresses with these files inside the browser, so the real
// extension runs on them unchanged and nothing reaches X.
//   node scripts/demo/stage.mjs <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { liveUser } from "../../tests/fixtures/x-live-shapes.js";
import { farmAccounts, organicAccounts, campaignQuotes, organicQuotes, OWN_POSTS, LAUNCH_TEXT } from "../../tests/fixtures/campaign-fixtures.js";

const demo = (h) => ("demo_" + h.replace(/^demo_/, "")).slice(0, 15);
const xDate = (iso) => new Date(iso).toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) ([\d:]+) GMT$/, "$1 $3 $2 $5 +0000 $4");
const BASE = Date.parse("2026-10-22T15:00:00Z");

// A User object in X's 2026-10-22 shape, with X's "About this account" block when given.
function user(h, { name, bio, joinDate, about, business, followers = 900 } = {}) {
  const extra = { core: { screen_name: h, name: name || h.replace(/_/g, " "), created_at: xDate(joinDate || "2018-05-01") }, relationship_counts: { followers, following: 300 },
    profile_bio: { description: bio || "", entities: { description: {} } }, is_blue_verified: false, verification: { verified: false } };
  if (about) extra.about_profile = { account_based_in: about.basedIn, username_changes: { count: String(about.nameChanges || 0) }, source: about.via || "Web" };
  if (business) { extra.verification = { verified: true, verified_type: "Business" }; extra.professional = { professional_type: "Business" }; }
  return liveUser(h, extra);
}

// A Tweet object; opts: { replyTo, quoted, paid, links, counts, client, at }.
function tweet(id, u, text, o = {}) {
  const c = o.counts || { reposts: 2, likes: 9, replies: 1, quotes: 0, bookmarks: 0 };
  const L = { created_at: xDate(o.at || new Date(BASE).toISOString()), full_text: text, lang: "en", id_str: id, conversation_id_str: o.conv || id,
    retweet_count: c.reposts, favorite_count: c.likes, reply_count: c.replies, quote_count: c.quotes || 0, bookmark_count: c.bookmarks || 0,
    entities: { urls: (o.links || []).map((u2) => ({ expanded_url: u2, display_url: u2.replace(/^https:\/\//, ""), url: "https://t.co/demo" })) } };
  if (o.replyTo) { L.in_reply_to_status_id_str = o.replyTo; L.in_reply_to_screen_name = o.replyToHandle; }
  if (o.quoted) { L.quoted_status_id_str = o.quoted; L.is_quote_status = true; }
  const t = { __typename: "Tweet", rest_id: id, core: { user_results: { result: u } }, source: `<a href="https://x.com">${o.client || "X Web App"}</a>`, views: { count: String(c.views || 400), state: "EnabledWithCount" }, legacy: L };
  if (o.paid) t.content_disclosure = { advertising_disclosure: { is_paid_promotion: true } };
  return t;
}
const detail = (tweets) => ({ data: { threaded_conversation_with_injections_v2: { instructions: [{ type: "TimelineAddEntries", entries: tweets.map((t, i) => ({ entryId: `tweet-${i}`, content: { itemContent: { itemType: "TimelineTweet", tweet_results: { result: t } } } })) }] } } });
const retweeters = (users) => ({ data: { retweeters_timeline: { timeline: { instructions: [{ type: "TimelineAddEntries", entries: users.map((u, i) => ({ entryId: `user-${i}`, content: { itemContent: { itemType: "TimelineUser", user_results: { result: u } } } })) }] } } } });

// The reply thread: one synthetic argument with signs on every side, from tests/fixtures/thread.html.
const THREAD = [
  ["newsdesk_fr", "Thousands marched in Paris today against the pension reform. Police report clashes near Place de la Nation.", { basedIn: "France", joinDate: "2011-04-01" }],
  ["claire_lyon", "I was at the march in Lyon, it was calm and full of families until the very end.", { basedIn: "France", joinDate: "2014-02-01" }],
  ["patriot847362", "Here in France we are sick of it. The protests are paid for by foreign money and the media will never tell you that", { basedIn: "Nigeria", joinDate: "2026-10-02", nameChanges: 4 }],
  ["truth_now_77", "The protests are paid for by foreign money and the media will never tell you that!!", { basedIn: "South Asia", joinDate: "2026-09-28", nameChanges: 1 }],
  ["eagle_watch", "@demo_newsdesk_f The protests are paid for by foreign money and the media will never tell you that", { basedIn: "Eastern Europe", joinDate: "2026-09-30" }],
  ["jean209955", "As a Frenchman I can tell you these rioters are vermin and they should all be shot", { basedIn: "West Asia", joinDate: "2026-10-09" }],
  ["redflag_now", "billionaires are parasites, bring out the guillotines for the billionaires", { basedIn: "United States", joinDate: "2026-10-12", nameChanges: 2 }],
  ["marc_dupont", "My grandmother marched in 1995 too. Same fight, different decade.", { basedIn: "France", joinDate: "2012-09-01" }],
  ["sophie_t", "The reform is a mistake but the violence near the end did not help anyone.", { basedIn: "Europe", joinDate: "2016-05-01" }],
  ["skywatch_lou", "Look up over Paris today, those are chemtrails and they are spraying us.", { basedIn: "France", joinDate: "2019-03-01" }],
  // Matches a claim fact-checkers reviewed (src/ext/claims.json), for the fact-check finding.
  ["pilot_watch", "Lufthansa fired a pilot because he refused to spray chemtrails from his aircraft during flights", { basedIn: "Germany", joinDate: "2020-02-01" }],
  // Links a state-funded outlet named in cited documents, for the Sources finding.
  ["linkdrop_net", "The other side of the story is here", { basedIn: "Europe", joinDate: "2021-06-01" }, "https://www.rt.com/news/demo-story/"],
].map(([h, text, about, link]) => [demo(h), text, about, link]);

export function threadStage() {
  const root = "1900000000000000100", tweets = [];
  THREAD.forEach(([h, text, about, link], i) => {
    const id = i ? String(BigInt(root) + BigInt(i)) : root;
    tweets.push(tweet(id, user(h, { joinDate: about.joinDate, about }), text, { conv: root, replyTo: i ? root : null, replyToHandle: THREAD[0][0], at: new Date(BASE + i * 47000).toISOString(), client: i === 3 || i === 4 ? "demo_autoposter" : "X for iPhone", links: link ? [link] : [] }));
  });
  const posts = THREAD.map(([h, text, , link], i) => ({ h, text, id: tweets[i].rest_id, root: i === 0, link }));
  return { url: `https://x.com/${THREAD[0][0]}/status/${root}`, html: page("Post", posts), json: { TweetDetail: detail(tweets) } };
}

// A launch: the company's post, its quotes and its reposters. kind "campaign" uses the farm and paid
// quotes; kind "organic" uses varied people and is the "run it on us" control.
export function launchStage(kind) {
  const campaign = kind === "campaign";
  const org = campaign ? "demo_examplelab" : "demo_daylight";
  const root = campaign ? "1900000000000000200" : "1900000000000000300";
  const links = campaign ? ["https://example.org/beta"] : ["https://github.com/HarperZ9/daylight-commons", "https://harperz9.github.io/daylight-commons/"];
  const text = campaign ? LAUNCH_TEXT : "Daylight Commons 3.0 is out: evidence beside the replies you read, each sign with its source and what it does not prove. Free and open source.";
  const counts = campaign ? { reposts: 5200, likes: 631, replies: 131, quotes: 12, bookmarks: 426, views: 211000 } : { reposts: 31, likes: 402, replies: 44, quotes: 12, bookmarks: 60, views: 25000 };
  const orgUser = user(org, { name: campaign ? "Example Lab" : "Daylight demo", joinDate: "2019-06-01", about: { basedIn: "United States" }, business: true, followers: 40000 });
  const NAMES = ["ada", "bram", "cleo", "dev", "esme", "finn", "gus", "hana", "ivo", "jun", "kai", "lena", "milo", "nia", "otto", "pia", "quin", "rosa", "sami", "tess"];
  const people = campaign ? farmAccounts(38) : organicAccounts(38).map((a, i) => ({ ...a, handle: `${NAMES[i % 20]}_${["reads", "codes", "writes"][Math.floor(i / 20) % 3]}` }));
  const crowd = people.map((a) => user(demo(a.handle), { bio: a.bio, joinDate: a.joinDate, about: { basedIn: campaign ? ["South Asia", "Eastern Europe", "West Africa"][a.handle.length % 3] : "United Kingdom" } }));
  // The control's quotes and replies are spread over days and each worded its own way.
  const OUR_QUOTES = ["Installed it. The does-not-prove lines are the best part", "Curious how the campaign lens handles fandoms", "A browser extension that shows its sources, finally",
    "Tried the offline verifier on a saved chain, it works", "AGPL and no server, I like that", "Wish it covered LinkedIn", "Reading the privacy page now", "The receipts idea is good, the UI needs polish"];
  const spread = (i, hours) => new Date(BASE + i * hours * 3600000).toISOString();
  const qs = (campaign ? [...campaignQuotes(8), ...organicQuotes(4)] : OUR_QUOTES.map((text, i) => ({ id: `u${i}`, author: `quoter${i}`, text, paidPartnership: false, posted: spread(i, 9) }))).map((q, i) => tweet(String(BigInt(root) + 10n + BigInt(i)), crowd[i] || user(demo(q.author)), q.text, { quoted: root, paid: !!q.paidPartnership, at: q.posted }));
  const own = OWN_POSTS.map((c, i) => tweet(String(BigInt(root) - 1000n + BigInt(i)), orgUser, `An ordinary post, number ${i + 1}.`, { counts: { ...c, replies: 4 } }));
  const launch = tweet(root, orgUser, text, { counts, links });
  const OWN = ["Read the privacy page first, then installed it", "How does it handle Mastodon servers?", "The receipts are a nice touch", "Does it work in Firefox on Android?",
    "Tried the CLI on my own archive, took a second", "Would love a Bluesky lens next", "Is the catalogue open to corrections?", "Nice to see the error bars", "Which licence is the data under?",
    "Ran the verifier, it caught my edit", "How do I report a wrong badge?", "Good to see no account needed"];
  const replies = crowd.slice(12, 24).map((u, i) => tweet(String(BigInt(root) + 40n + BigInt(i)), u, campaign ? "Congrats on the launch, this changes everything" : OWN[i], { replyTo: root, replyToHandle: org, at: campaign ? undefined : spread(i, 5) }));
  const posts = [{ h: org, text, id: root, root: true, counts }, ...qs.map((t) => ({ h: t.core.user_results.result.core.screen_name, text: t.legacy.full_text, id: t.rest_id, paid: !!t.content_disclosure, quoteOf: org }))];
  const base = `https://x.com/${org}/status/${root}`;
  return { url: base, quotesUrl: `${base}/quotes`, retweetsUrl: `${base}/retweets`, html: page("Post", posts), json: { TweetDetail: detail([launch, ...qs, ...replies, ...own]), Retweeters: retweeters(crowd) } };
}

// A long thread for the soak test (scripts/qa/prod_check.py): n invented replies, every fifth one a
// copy of an earlier one so the coordination signs have work to do. The page renders 20 at a time
// as the reader scrolls and keeps at most 60 in the page, the way X's own list drops posts that
// scrolled far out of view, so detached posts must not stay alive in memory.
export function longStage(n = 600) {
  const root = "1900000000000000900", words = ["the vote", "the budget", "the bridge", "the school plan", "the new rail line", "the clinic", "the park"];
  const posts = [{ h: demo("city_desk"), text: "The council publishes its plan for the coming year today. Read it and tell us what you think.", id: root, root: true }];
  for (let i = 1; i <= n; i++) {
    const text = i % 5 === 0 ? posts[Math.max(1, i - 7)].text : `Reply ${i}: my view on ${words[i % words.length]} is that it needs ${i % 3 ? "more time" : "a public meeting"} before anyone signs.`;
    posts.push({ h: demo(`reader${i}`), text, id: String(BigInt(root) + BigInt(i)) });
  }
  return { url: `https://x.com/${posts[0].h}/status/${root}`, html: page("Post", posts, { window: 60, step: 20 }), json: {} };
}

// An X-shaped page: articles with the test ids and status links X uses, flat-tone avatars, no faces,
// no X name or logo. The script asks for the stage's responses the way X's app does, so the
// extension's page-context reader sees them.
function page(title, posts, { window: win = 0, step = 20 } = {}) {
  const rows = JSON.stringify(posts);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} (synthetic demo)</title>
<style>
:root{--ink:#0f1419;--soft:#536471;--line:#eff3f4}
body{margin:0;background:#fff;color:var(--ink);font:15px/1.4 system-ui,"Segoe UI",sans-serif}
main{max-width:600px;margin:0 auto;border-inline:1px solid var(--line);min-height:100vh}
.bar{position:sticky;top:0;z-index:2;padding:12px 16px;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);font-weight:700;font-size:19px}
.bar small{display:block;font-weight:400;font-size:13px;color:var(--soft)}
article{position:relative;padding:12px 16px 12px 68px;border-bottom:1px solid var(--line)}
article::before{content:"";position:absolute;left:16px;top:14px;width:40px;height:40px;border-radius:50%;background:var(--av,#cfd9de)}
article.root [data-testid="tweetText"]{font-size:19px}
[data-testid="User-Name"]{font-weight:700}[data-testid="User-Name"] a{color:var(--ink);text-decoration:none}
[data-testid="User-Name"] span,[data-testid="User-Name"] span a{color:var(--soft);font-weight:400}
.paid{display:inline-block;margin-top:6px;font-size:13px;color:var(--soft)}.quoted{margin-top:8px;padding:8px 12px;border:1px solid var(--line);border-radius:12px;color:var(--soft);font-size:14px}
.counts{margin-top:10px;color:var(--soft);font-size:14px;display:flex;gap:20px}
</style></head><body><main><div class="bar">${title}<small>A synthetic page for a demonstration. Every account here is invented.</small></div><div id="thread"></div></main>
<script>
const P=${rows},tones=["#cfd9de","#d8cbb8","#bfcabd","#cfc3cf","#c4ccd6","#d6d0c2"],box=document.getElementById("thread");
const k=(n)=>n>=1000?(Math.round(n/100)/10)+"K":String(n);
const draw=(r,i)=>{const a=document.createElement("article");a.setAttribute("data-testid","tweet");a.tabIndex=0;if(r.root)a.className="root";a.style.setProperty("--av",r.root?"#20242b":tones[i%tones.length]);
a.innerHTML='<div data-testid="User-Name"><a href="/'+r.h+'"></a> <span>@'+r.h+' · <a href="/'+r.h+'/status/'+r.id+'"><time datetime="2026-10-22T15:00:00Z">'+(r.root?"2h":(i*4+1)+"m")+'</time></a></span></div><div data-testid="tweetText" lang="en" dir="auto"></div>';
a.querySelector('[data-testid="User-Name"] a').textContent=r.h.replace(/^demo_/,"").replace(/_/g," ");a.querySelector('[data-testid="tweetText"]').textContent=r.text;
if(r.link){const t=a.querySelector('[data-testid="tweetText"]'),l=document.createElement("a");l.href=r.link;l.textContent=" "+r.link.slice(8);t.append(l);}
if(r.quoteOf){const q=document.createElement("div");q.className="quoted";q.textContent="Quoting @"+r.quoteOf;a.append(q);}
if(r.paid){const s=document.createElement("span");s.className="paid";s.textContent="Paid partnership";a.append(s);}
if(r.counts){const c=document.createElement("div");c.className="counts";c.textContent=k(r.counts.replies)+" replies  "+k(r.counts.reposts)+" reposts  "+k(r.counts.likes)+" likes  "+k(r.counts.views)+" views";a.append(c);}
box.append(a);};
const W=${win},S=${step};let next=0;const more=()=>{const end=Math.min(P.length,next+S);for(;next<end;next++)draw(P[next],next);while(W&&box.children.length>W)box.firstElementChild.remove();};
if(!W)P.forEach(draw);else{more();more();addEventListener("scroll",()=>{if(innerHeight+scrollY>document.body.scrollHeight-400&&next<P.length)more();},{passive:true});}
window.__stage={rendered:()=>next,total:P.length};
for(const op of ["TweetDetail","Retweeters"]) fetch("/i/api/graphql/demo/"+op+"?stage=1").then((r)=>r.ok?r.json():null).catch(()=>null);
</script></body></html>`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2];
  if (!out) { console.error("usage: node scripts/demo/stage.mjs <out dir>"); process.exit(2); }
  const stages = { thread: threadStage(), campaign: launchStage("campaign"), ours: launchStage("organic"), long: longStage(Number(process.env.STAGE_LONG_N) || 600) };
  mkdirSync(out, { recursive: true });
  const index = {};
  for (const [name, s] of Object.entries(stages)) {
    writeFileSync(join(out, `${name}.html`), s.html);
    for (const [op, j] of Object.entries(s.json)) writeFileSync(join(out, `${name}.${op}.json`), JSON.stringify(j));
    index[name] = { url: s.url, quotesUrl: s.quotesUrl || null, retweetsUrl: s.retweetsUrl || null, ops: Object.keys(s.json) };
  }
  writeFileSync(join(out, "stages.json"), JSON.stringify(index, null, 2));
  console.log(`wrote ${Object.keys(stages).length} stages to ${out}`);
}
