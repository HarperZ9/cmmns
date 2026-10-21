// One key per conversation, from the id the site gives it, so the same thread reached by a
// different path (handle case, media or analytics suffix, a comment permalink) is never
// counted as a second thread. Unknown shapes fall back to the lower-cased path.

export function threadKey(siteId, pathname, search = "") {
  const path = String(pathname || "");
  let id = null;
  if (siteId === "x") id = (path.match(/\/status\/(\d+)/) || [])[1];
  else if (siteId === "reddit") id = (path.match(/\/comments\/([a-z0-9]+)/i) || [])[1];
  else if (siteId === "youtube") id = new URLSearchParams(search).get("v") || (path.match(/^\/shorts\/([\w-]+)/) || [])[1];
  else if (siteId === "instagram") id = (path.match(/\/(?:p|reels?|tv)\/([\w-]+)/) || [])[1];
  else if (siteId === "bluesky") id = (path.match(/\/post\/([a-z0-9]+)/i) || [])[1];
  else if (siteId === "facebook") {
    const q = new URLSearchParams(search);
    id = (path.match(/\/(?:posts|videos|reel)\/([\w-]+)/) || [])[1] || q.get("story_fbid") || q.get("v") || q.get("fbid");
  }
  if (id) return siteId + ":" + (siteId === "reddit" ? id.toLowerCase() : id);   // YouTube ids are case-sensitive
  return `${siteId}:${path.toLowerCase().replace(/\/+$/, "")}`;
}
