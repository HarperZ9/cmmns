// Ad transparency libraries for the evidence layer (project-docs/EVIDENCE-LAYER.md). Daylight Commons fetches
// none of them: each needs a login, an approved key, or has no public API, and their terms limit
// automated access. Daylight Commons builds a search link the user opens in a tab of their own, and says which
// libraries offer an API and what it needs. Status checked 2026-10-22 (HTTP status of the search
// page to a script, and each provider's API documentation).

export const AD_LIBRARIES = [
  { id: "meta", name: "Meta Ad Library", covers: "Facebook, Instagram, Messenger; all ads in the EU under the DSA, political and issue ads elsewhere",
    search: (q) => `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodeURIComponent(q)}`,
    api: "Ad Library API (graph.facebook.com ads_archive): needs a Meta developer account, identity confirmation and the user's own access token.", by: "name", checked: "search page answered 403 to a script; opens in a browser" },
  { id: "google", name: "Google Ads Transparency Center", covers: "Google Search, YouTube, Display; advertiser identity and ad dates",
    search: (q, domain) => (domain ? `https://adstransparency.google.com/?region=anywhere&domain=${encodeURIComponent(domain)}` : `https://adstransparency.google.com/?region=anywhere`),
    api: "No public API. Google publishes a political-ads dataset in BigQuery; commercial ads are web only.", by: "domain", checked: "search page answered 200" },
  { id: "tiktok", name: "TikTok Ad Library", covers: "Ads shown in the EU, the EEA, Switzerland and the UK",
    search: (q) => `https://library.tiktok.com/ads?region=all&adv_name=${encodeURIComponent(q)}`,
    api: "Commercial Content API: needs an approved TikTok research or developer application.", by: "name", checked: "search page answered 200" },
  { id: "linkedin", name: "LinkedIn Ad Library", covers: "Ads on LinkedIn, with EU targeting details under the DSA",
    search: (q) => `https://www.linkedin.com/ad-library/search?keyword=${encodeURIComponent(q)}`,
    api: "No public API.", by: "name", checked: "search page answered 403 to a script; opens in a browser" },
  { id: "x", name: "X Ads Repository", covers: "Ads served in the EU under the DSA",
    search: () => "https://ads.x.com/ads-repository",
    api: "No public API; the repository page takes an advertiser and a date range.", by: "none", checked: "page answered 200" },
];
export const ADS_DOES_NOT_PROVE = "An ad library lists ads a platform chose to record for its own rules. No entry does not mean no paid promotion: influencer payments, agency-run accounts and engagement bought off-platform never appear there.";

// { name, domain } -> [{ id, name, url, covers, api, checked }] for the user to open.
export function adLibraryLinks({ name, domain } = {}) {
  const q = String(name || domain || "").trim();
  if (!q) return [];
  return AD_LIBRARIES.map((l) => ({ id: l.id, name: l.name, url: l.search(q, domain || null), covers: l.covers, api: l.api, checked: l.checked }));
}
