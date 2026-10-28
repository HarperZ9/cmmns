<!-- writing-profile: research -->
# Synthetic-media provenance and reuse tracing: plan

Status: planned, not built. Decided by the author on 2026-10-25: "plan redaction and provenance
tracing next." Source brief: the counter-repression brief of 2026-10-25, feature F5.

## The problem

Fabricated images and video are pushed by coordinated accounts. A reader needs two answers: is this
image's origin known, and is a crowd carrying it? CMMNS already reads Content Credentials (C2PA,
`src/core/c2pa-verify.js`) and IPTC "made with generative AI" metadata (`src/core/aimeta.js`), and it
already measures coordination (the same text from many accounts, one upload carried by many). This
plan joins the two.

Who it protects: readers facing fabricated evidence, and the people falsely shown in it.

## What it does

1. **Provenance, as it is today, shown everywhere media appears.** For each picture or video in a
   post: Content Credentials checked offline (signature, assertion hashes, hard binding), with the
   signer and the claim generator named; IPTC `DigitalSourceType` values such as
   `trainedAlgorithmicMedia` and `compositeWithTrainedAlgorithmicMedia` read and named.
2. **A plain "no provenance found" state.** Most platforms strip credentials, so absence is the
   usual state. The window says: "No provenance found. Most platforms remove it; this says nothing
   about whether the image is real or made." It is never shown as a warning colour.
3. **Reuse count across accounts.** A perceptual hash (a 64-bit difference hash of the decoded
   image, and of keyframes for video) for each media item in posts the user already loaded. The
   window shows "the same or a near-identical image was carried by N accounts in threads you opened",
   with up to three examples the user can open. It joins the existing coordination signals and
   their measured thresholds.
4. **First-seen date** from the earliest post the user's browser saw carrying it, beside the
   existing "first uploaded long before the post" sign.

## What it does not do, and why

**No pixel-level AI-image classifier.** Detectors of generated images have unstable accuracy
across generators, versions and ordinary processing (resizing, recompression, screenshots), and
their error rates on real photos are not known for the images CMMNS users see. A wrong
"AI-made" label on a real photo of an atrocity is the worst error CMMNS could make: it hands
deniers a tool and harms the people in the photo. If a classifier is ever proposed, it ships under
the reading lens rule: held-out precision of 80% or more from at least three hits, shown per
generator, or it stays off, and its label never stands alone.

## Lines that hold (the boundary)

- Reuse tracing compares images, never faces. The hash is of the whole image; no face crop is hashed.
- It runs only on posts the user already loaded. No search of other sites, no reverse-image request
  without the user's click on a named outside service.
- Private accounts appear only as counts ("carried by 31 accounts"), as the coordination signals
  already require. No list of the accounts that posted one person's photo.
- No account linking across platforms: counts are per platform.
- A test enforces it: the hash module takes a decoded frame and returns a 64-bit value; a boundary
  test fails if it accepts a region, returns anything else, or is reached from any code path that
  takes a handle or a person's name.

## Measurement before any default

- Near-duplicate precision of the perceptual hash at the chosen distance, on a labelled set that
  includes memes, stock images and screenshots (the common collisions), reported with intervals.
- The count shows as "not measured yet" until that figure exists, like other new signs.
- C2PA results stay held to "never more favourable than c2patool" on the c2pa-rs test files (CI).

## Failure modes

- Hash collisions on memes, stock and templated images: shown as a count with examples, never a
  verdict; the threshold is measured first.
- Edits that defeat the hash (crops, mirrors, overlays): the count is a lower bound and says so.
- Stripped credentials read as suspicion: the "no provenance found" wording above.

## Order of work

1. "No provenance found" state and naming of C2PA and IPTC results in the window and the card.
2. Perceptual hash of loaded media, kept per thread in the existing local logs, with the boundary test.
3. The reuse count in the coordination section, "not measured yet".
4. The near-duplicate measurement, then the measured threshold.

## Does not prove

Content Credentials show who signed a claim about a file and that the file matches it; they do not
show the claim is true. A reuse count shows how many accounts carried an image in what the user
loaded; it does not show who made it or why.
