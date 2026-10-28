// Synthetic fixtures in the shapes X's web app used on 2026-10-22 (live check, see
// project-docs/LIVE-CHECKS.md). Every handle, name, bio and number is invented.
// What changed: User objects carry no `legacy` block; counts sit in relationship_counts,
// tweet_counts and action_counts. Quote posts carry X's paid mark in content_disclosure.

export const liveUser = (handle, extra = {}) => ({
  __typename: "User", rest_id: "100", id: "VXNlcjoxMDA=",
  core: { screen_name: handle, name: "Example Person", created_at: "Mon Mar 04 10:00:00 +0000 2019" },
  profile_bio: { description: "Sharing insights on example topics | DM for collaborations",
    entities: { description: {}, url: { urls: [{ display_url: "example.org", expanded_url: "https://example.org/me", url: "https://t.co/abc" }] } } },
  relationship_counts: { followers: 4210, following: 380 },
  tweet_counts: { tweets: 9120, media_tweets: 640 },
  action_counts: { favorites_count: 15200 },
  website: { url: "https://t.co/abc" },
  avatar: { image_url: "https://pbs.twimg.com/profile_images/1/example_normal.jpg" },
  location: { location: "" },
  privacy: { protected: false },
  verification: { verified: false },
  is_blue_verified: true,
  profile_image_shape: "Circle",
  ...extra,
});

export const liveTweet = (id, handle, extra = {}) => ({
  __typename: "Tweet", rest_id: id,
  core: { user_results: { result: liveUser(handle) } },
  views: { count: "27000", state: "EnabledWithCount" },
  edit_control: { edit_tweet_ids: [id], editable_until_msecs: "0", is_edit_eligible: false, edits_remaining: "5" },
  legacy: { created_at: "Wed Oct 22 17:20:00 +0000 2026", full_text: "short text https://t.co/xyz", lang: "en",
    quoted_status_id_str: "900", is_quote_status: true, retweet_count: 72, favorite_count: 120, reply_count: 11, quote_count: 0, bookmark_count: 35,
    entities: { urls: [] }, id_str: id, user_id_str: "100", conversation_id_str: id },
  ...extra,
});

// The Retweeters response wraps users in timeline entries; only the walk matters to CMMNS.
export const retweetersResponse = (handles) => ({ data: { retweeters_timeline: { timeline: { instructions: [{ type: "TimelineAddEntries",
  entries: handles.map((h, i) => ({ entryId: `user-${i}`, content: { itemContent: { itemType: "TimelineUser", user_results: { result: liveUser(h) } } } })) }] } } } });
