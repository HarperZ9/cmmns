// Brand look-alike accounts (src/core/brands.js). Every account here is synthetic: made-up handles
// and names built to test the rule, never a real person's account. Controls cover the legitimate
// cases: an outlet's own accounts, sub-accounts that carry X's affiliation badge, organisations X
// verified, accounts X labels parody, commentary or fan, and ordinary names.
import test from "node:test";
import assert from "node:assert/strict";
import { BRANDS, brandLookalike, BRAND_DOES_NOT_PROVE } from "../src/core/brands.js";
import { flagsFor, isFlagged, WEAK_FLAGS, DOES_NOT_PROVE } from "../src/core/flags.js";
import { FAMILIES, familyOf } from "../src/core/families.js";

const look = (a) => brandLookalike(a);

test("every brand entry is sourced", () => {
  assert.ok(BRANDS.length >= 25);
  for (const b of BRANDS) {
    assert.ok(b.name && b.kind && Array.isArray(b.names) && b.names.length, b.name);
    assert.ok(["platform", "outlet"].includes(b.kind), b.name);
    assert.match(b.source, /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/, b.name);
    for (const h of b.handles) assert.match(h, /^[A-Za-z0-9_]{1,15}$/, `${b.name} ${h}`);
  }
});

test("names that imitate a platform's or an outlet's brand are flagged", () => {
  const cases = [
    [{ handle: "xglobal_help2", display: "X Global" }, "X"],
    [{ handle: "Supp0rtTeamX", display: "𝕏 Support" }, "X"],
    [{ handle: "news_flash_247", display: "BBC Breaking" }, "BBC News"],
    [{ handle: "cnnbreakingnewz", display: "Breaking News" }, "CNN"],
    [{ handle: "FoxNewsAlerts_", display: "Fox News Alerts" }, "Fox News"],
    [{ handle: "reuters_live_now", display: "Reuters Live" }, "Reuters"],
    [{ handle: "meta_support_desk", display: "Meta Support" }, "Meta"],
    [{ handle: "official_ytteam", display: "YouTube Official" }, "YouTube"],
    [{ handle: "bbcnews24h", display: "B B C" }, "BBC News"],
    [{ handle: "whatever_1", display: "Reuters" }, "Reuters"],
  ];
  for (const [acct, brand] of cases) {
    const r = look(acct);
    assert.ok(r, `${acct.display} / @${acct.handle} not flagged`);
    assert.equal(r.brand, brand, acct.handle);
    assert.ok(r.evidence.includes(brand), r.evidence);
  }
});

test("look-alike letters from other scripts are folded first", () => {
  // Cyrillic В and С in "ВВС"
  assert.ok(look({ handle: "breaking_uk_1", display: "ВВС Breaking" }));
});

test("controls: official accounts, affiliates, verified organisations, labelled fans, ordinary names", () => {
  const clean = [
    { handle: "BBCBreaking", display: "BBC Breaking News" },
    { handle: "bbcbreaking", display: "BBC Breaking News" },
    { handle: "CNN", display: "CNN" },
    { handle: "X", display: "X" },
    { handle: "Support", display: "Support" },
    // a real outlet sub-account not in the list, with X's affiliation badge for the outlet
    { handle: "BBCLocalDesk", display: "BBC News Local Desk", affiliate: "BBC" },
    { handle: "ReutersMarketsNow", display: "Reuters Markets Live", affiliate: "Reuters" },
    // an organisation X verified (gold check)
    { handle: "FoxNewsRadioLive", display: "Fox News Radio Live", verifiedType: "Business" },
    // X's own parody, commentary or fan label
    { handle: "bbc_breaking_parody", display: "BBC Breaking", xLabel: "Parody" },
    { handle: "cnn_fan_77", display: "CNN Fan Account" },
    { handle: "critic_of_fox", display: "Not affiliated with Fox News" },
    { handle: "jane_doe", display: "Jane Doe" },
    { handle: "alex_reads", display: "Alex | reads the news" },
    { handle: "maxglobal", display: "Max Global Trading" },
    { handle: "skywatcher", display: "Sky Watcher" },
    { handle: "abc7fan", display: "ABC7 viewer" },
    { handle: "meta_analysis_lab", display: "Meta-analysis lab" },
    { handle: "metaverse_art", display: "Metaverse art" },
  ];
  for (const a of clean) assert.equal(look(a), null, `${a.display} / @${a.handle}`);
});

test("an affiliation badge for a different organisation does not clear the flag", () => {
  assert.ok(look({ handle: "bbc_breaking_live", display: "BBC Breaking", affiliate: "Daily Wire" }));
});

test("the symmetry of outlets: left-, right- and centre-coded brands are treated alike", () => {
  for (const [brand, display] of [["Fox News", "Fox News Breaking"], ["MS NOW (MSNBC)", "MSNBC Breaking"], ["Breitbart News", "Breitbart News Live"],
    ["HuffPost", "HuffPost Breaking"], ["Reuters", "Reuters Breaking"], ["Newsmax", "Newsmax Breaking"], ["The Guardian", "The Guardian Breaking"]]) {
    const r = look({ handle: "lookalike_test_1", display });
    assert.ok(r, display);
    assert.equal(r.brand, brand);
  }
});

test("flagsFor adds the weak brand-lookalike flag only when asked, with its does-not-prove line", () => {
  const acct = { handle: "xglobal_help2", display: "X Global" };
  assert.ok(!flagsFor(acct).some((f) => f.id === "brand-lookalike"), "off unless the site gives brand data");
  const f = flagsFor({ ...acct, brandCheck: true }).find((x) => x.id === "brand-lookalike");
  assert.ok(f);
  assert.equal(f.doesNotProve, BRAND_DOES_NOT_PROVE);
  assert.equal(DOES_NOT_PROVE["brand-lookalike"], BRAND_DOES_NOT_PROVE);
  assert.ok(WEAK_FLAGS.has("brand-lookalike"));
  assert.equal(isFlagged([{ id: "brand-lookalike" }]), false, "alone it is context");
  assert.equal(isFlagged([{ id: "brand-lookalike" }, { id: "store-elsewhere" }]), true);
});

test("the family is listed in the account area", () => {
  assert.equal(familyOf("flag", "brand-lookalike"), "brand-lookalike");
  assert.ok(FAMILIES.some((x) => x.id === "brand-lookalike" && x.area === "account"));
});
