// One launch-campaign definition per platform (project-docs/CAMPAIGN-LENS.md, "Platforms"). The
// author's requirement (2026-10-22): campaigns look and behave differently on different platforms
// and in different communities, so no threshold is shared between platforms. A platform without a
// definition gets "not defined for this site yet", never X's rules.

export const CAMPAIGN_PLATFORMS = {
  x: {
    status: "built",
    shapeCounts: ["reposts", "likes", "replies", "quotes", "bookmarks", "views"],
    sampleFrom: ["repost list", "quote list", "replies"],
    signs: ["shape-outlier-own", "bio-template", "stock-persona", "join-cluster", "topic-mismatch", "undisclosed-lookalike", "cross-launch"],
    disclosure: "Paid partnership",
    notes: "X shows repost lists, quote lists, join dates, bios and a Paid partnership label on quote posts.",
  },
  reddit: {
    status: "definitions only",
    shapeCounts: ["score", "comments", "upvoteRatio"],
    sampleFrom: ["commenters"],
    signs: ["join-cluster", "karma-for-age", "arrival-burst"],
    notes: "Vote rings, karma farming, aged accounts bought for posting, and brigading from another community. Reddit fuzzes vote counts and shows no repost list. Thresholds are not set until labelled Reddit cases exist.",
  },
  instagram: { status: "not defined", notes: "Engagement pods: the same commenters across one creator's posts. Like counts are often hidden, so no shape." },
  tiktok: { status: "not defined", notes: "Not defined yet." },
  linkedin: { status: "not defined", notes: "Engagement pods. Daylight Commons does not run on LinkedIn." },
};

export function campaignPlatform(id) {
  const p = CAMPAIGN_PLATFORMS[id];
  return p && p.status === "built" ? p : null;
}
