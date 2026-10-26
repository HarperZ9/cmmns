// Injected into the active tab by the self-audit page (selfaudit.js), on the user's click only.
// It reads three markers the page itself shows and returns them; it reads no posts and sends
// nothing. The self-audit runs only when they prove the page is the signed-in user's own profile
// (PB.ownedProfile): the account menu's profile link, the profile shown, and the Edit profile
// button that X shows on your own profile alone. The local test harness counts as X.
(() => {
  "use strict";
  const host = location.hostname;
  const fixture = /^(localhost|127\.0\.0\.1)$/.test(host) && document.documentElement.dataset.pbFixture === "own-profile";
  if (!/(^|\.)(x|twitter)\.com$/.test(host) && !fixture) return { site: null };
  const link = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
  const signedIn = link ? (link.getAttribute("href") || "").split("/").filter(Boolean)[0] || null : null;
  const pageHandle = location.pathname.split("/").filter(Boolean)[0] || null;
  const editProfile = !!document.querySelector('a[data-testid="editProfileButton"], a[href="/settings/profile"]');
  return { site: "X", signedIn, pageHandle, editProfile };
})();
