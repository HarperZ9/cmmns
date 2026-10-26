<!-- writing-profile: research -->
# Redaction of faces and identifying detail in exports: plan

Status: planned, not built. Decided by the author on 2026-10-25: "plan redaction and provenance
tracing next." Source brief: the counter-repression brief of 2026-10-25, feature F4.

## The problem

Share clean removes what a file says about itself. What a picture or video shows stays: faces of
bystanders and sources in protest footage, victims in evidence images, house numbers, number
plates, tattoos, badges, screens. Text redaction already exists for exports (`src/investigate/redact.js`,
salted pseudonyms). This plan is the media half.

Who it protects: people in the footage who did not choose to be in it. The decision it supports:
"Can I publish this without exposing the people in it?"

## What it does

1. **The user draws boxes** on a picture or on a video's frames (a box holds across a frame range,
   with keyframes the user moves). This is the primary tool and works with no detector at all.
2. **A detector may propose face boxes**, off by default, on this device. The user accepts or
   rejects each one. Proposals are never applied without a click.
3. **Solid fill only.** Every redaction is an opaque rectangle in one colour, written into the
   pixels. Never blur, pixelation, swirl or noise: those can be partly reversed or matched, and
   they leave the shape and tone of a face.
4. **Re-encode only the redacted output.** The redacted copy is decoded, filled and encoded again
   (it has to be). The original stays untouched, local, with its hash. The redacted copy then goes
   through Share clean.
5. **Audio.** Pitch shifting is not anonymisation. The options are: remove the audio track, mute
   chosen ranges, or replace speech with a transcript the user edits.
6. **A redaction log**, kept with the case, never inside the shared file:
   `{ original_sha256, redacted_sha256, at (day), by: "investigator", regions: [{ frame_from,
   frame_to, x, y, w, h, source: "drawn" | "proposed-accepted" }], audio: [...] }`. It lets the
   investigator show later what was hidden and that nothing else changed.

## Lines that hold (the boundary)

A face detector is one step from face recognition. The design keeps it at boxes:

- The detector returns rectangles and a confidence, nothing else. **No embeddings, landmarks or
  descriptors are computed, stored or compared.** No face crop is ever written, kept or returned.
- There is no API, message or export that returns faces. Boxes exist only in the editor's memory
  and, after the user accepts them, as rectangles in the redaction log.
- No matching of any kind: not across frames by identity (tracking a box across frames uses the
  box's position, never its content), not across files, not against any list.
- Pull requests that add matching, clustering, re-identification or a face crop output are refused.

**The build test that enforces it** (`tests/redaction.boundary.test.js`, written with the feature,
before any detector lands):

- It loads the detector module and runs it on fixtures with faces. It fails if any return value,
  at any depth, is an array or typed array longer than 4 numbers per box (an embedding or landmark
  set), an `ImageData`, `Blob`, `ArrayBuffer` or canvas, or any object with keys other than
  `{ x, y, w, h, score }`.
- It scans `src/` for the exported names and strings of known face-embedding models and APIs
  (`embedding`, `descriptor`, `faceapi`, `facenet`, `arcface`, `insightface`, `landmarks`,
  `getFaceDescriptor`, `computeFaceDescriptor`) and fails on any hit outside this plan and the test.
- It intercepts every write the editor makes (downloads, IndexedDB, storage, messages) during a
  redaction session and fails if any carries pixels other than the full redacted frame.
- It checks that the redaction log holds rectangles and hashes only.

## Measurement before any claim

- Detector recall measured on a public, consented face dataset with crowd scenes, side profiles and
  small faces, reported per condition with intervals, and shown in the editor: "faces proposed by a
  detector with recall X on [set]; check every frame".
- No claim that the detector finds all faces. The editor says the user must check every frame.
- Model choice: a small on-device detector with a licence compatible with AGPL-3.0, weights pinned
  by hash in the data lock, no download at run time.

## Failure modes

- Missed faces in crowds, at angles, in reflections and on screens. Answer: user review of every
  frame, recall shown, drawn boxes as the primary tool.
- Identification by other means: gait, clothing, tattoos, voice, location. Answer: the editor's
  limits note lists them; the tool hides regions, not people.
- False confidence. Answer: the same limits wording as source-protection mode, and the log.

## Order of work

1. Picture editor with drawn boxes, solid fill, Share clean after, redaction log. No detector.
2. Video: boxes over frame ranges, re-encode through the existing convert path, audio options.
3. The boundary test, landed before step 4.
4. Optional on-device face proposals, measured, off by default.

## Does not prove

A redacted export shows the regions the user chose were filled. It does not show that every
identifying detail was found, and a detector's measured recall on one dataset does not carry over to
every crowd.
