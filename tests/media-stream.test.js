// Saving streamed video (src/core/media-hls.js, media-dash.js) and refusing protected media
// (src/core/media-protect.js): playlists and manifests are read into fetch lists, and any
// encryption, DRM key system or EME element stops the save with a plain sentence.
import test from "node:test";
import assert from "node:assert/strict";
import { parseM3u8, hlsProtection, pickVariant, audioFor, hlsFetchList, hlsContainer } from "../src/core/media-hls.js";
import { parseMpd, dashProtection, pickRepresentation, dashFill, isoSeconds } from "../src/core/media-dash.js";
import { mp4Encryption, webmEncryption, elementProtection, fileProtection, mediaProtection, PROTECTED_LINE } from "../src/core/media-protect.js";
import { readXml } from "../src/core/media-xml.js";
import { muxMp4 } from "../src/core/media-mp4.js";
import { muxWebM } from "../src/core/media-webm.js";

const BASE = "https://cdn.example.org/v/master.m3u8";
const MASTER = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="English",LANGUAGE="en",DEFAULT=YES,URI="audio/en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,CODECS="avc1.4d401e,mp4a.40.2",AUDIO="aud"
360/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720,AUDIO="aud"
720/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=1920x1080
1080/index.m3u8
`;
const MEDIA = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-MAP:URI="init.mp4"
#EXTINF:6.0,
seg0.m4s
#EXTINF:6.0,
seg1.m4s
#EXTINF:3.5,
https://other.example.net/seg2.m4s
#EXT-X-ENDLIST
`;

test("an HLS master playlist lists its variants and audio renditions, and the save picks within a height", () => {
  const m = parseM3u8(MASTER, BASE);
  assert.equal(m.kind, "master");
  assert.deepEqual(m.variants.map((v) => [v.url, v.bandwidth, v.height]), [
    ["https://cdn.example.org/v/360/index.m3u8", 800000, 360], ["https://cdn.example.org/v/720/index.m3u8", 2400000, 720], ["https://cdn.example.org/v/1080/index.m3u8", 6000000, 1080]]);
  assert.equal(pickVariant(m).height, 1080);
  assert.equal(pickVariant(m, { maxHeight: 720 }).height, 720);
  assert.equal(pickVariant(m, { maxHeight: 100 }).height, 360, "nothing fits: the smallest");
  assert.equal(audioFor(m, m.variants[0]).url, "https://cdn.example.org/v/audio/en.m3u8");
  assert.equal(hlsProtection(m), null);
});

test("an HLS media playlist gives the init map first, then every segment, resolved against the playlist", () => {
  const p = parseM3u8(MEDIA, "https://cdn.example.org/v/720/index.m3u8");
  assert.equal(p.kind, "media");
  assert.equal(p.endList, true);
  assert.equal(p.duration, 15.5);
  assert.deepEqual(hlsFetchList(p).map((x) => x.url), ["https://cdn.example.org/v/720/init.mp4", "https://cdn.example.org/v/720/seg0.m4s",
    "https://cdn.example.org/v/720/seg1.m4s", "https://other.example.net/seg2.m4s"]);
  assert.equal(hlsContainer(p), "mp4");
  const ts = parseM3u8("#EXTM3U\n#EXTINF:4,\na.ts\n#EXT-X-BYTERANGE:100@0\n#EXTINF:4,\nb.ts\n#EXT-X-BYTERANGE:50\n#EXTINF:4,\nb.ts\n", BASE);
  assert.equal(hlsContainer(ts), "ts");
  assert.deepEqual(ts.segments.map((s) => s.range), [null, { length: 100, offset: 0 }, { length: 50, offset: 100 }], "a byte range without an offset follows the last one");
  assert.equal(parseM3u8("not a playlist", BASE), null);
});

test("DRM detection: any HLS key other than NONE stops the save, a DRM key format is named", () => {
  for (const [line, re] of [
    ["#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"", /encrypted \(AES-128\)/],
    ["#EXT-X-KEY:METHOD=SAMPLE-AES,URI=\"skd://abc\",KEYFORMAT=\"com.apple.streamingkeydelivery\"", /SAMPLE-AES with the com\.apple\.streamingkeydelivery key system/],
    ["#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,KEYFORMAT=\"urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed\"", /SAMPLE-AES-CTR/],
  ]) {
    const p = parseM3u8(`#EXTM3U\n${line}\n#EXTINF:6,\na.ts\n#EXT-X-ENDLIST\n`, BASE);
    assert.match(hlsProtection(p), re);
  }
  assert.equal(hlsProtection(parseM3u8("#EXTM3U\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:6,\na.ts\n", BASE)), null, "METHOD=NONE is no encryption");
  const session = parseM3u8(`#EXTM3U\n#EXT-X-SESSION-KEY:METHOD=SAMPLE-AES,URI="skd://x",KEYFORMAT="com.apple.streamingkeydelivery"\n${MASTER.slice(8)}`, BASE);
  assert.match(hlsProtection(session), /encrypted/, "a session key on the master playlist counts");
});

const MPD = (extra = "") => `<?xml version="1.0" encoding="UTF-8"?>
<!-- a test manifest -->
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" mediaPresentationDuration="PT0M10S">
  <BaseURL>https://media.example.org/dash/</BaseURL>
  <Period>
    <AdaptationSet contentType="video" mimeType="video/mp4">${extra}
      <SegmentTemplate initialization="$RepresentationID$/init.mp4" media="$RepresentationID$/seg-$Number%05d$.m4s" startNumber="1" timescale="1000" duration="4000"/>
      <Representation id="v720" bandwidth="2000000" width="1280" height="720" codecs="avc1.64001f"/>
      <Representation id="v1080" bandwidth="5000000" width="1920" height="1080"/>
    </AdaptationSet>
    <AdaptationSet contentType="audio" mimeType="audio/mp4" lang="en">
      <Representation id="a1" bandwidth="128000">
        <SegmentTemplate initialization="a/init.mp4" media="a/$Time$.m4s" timescale="48000">
          <SegmentTimeline><S t="0" d="192000" r="1"/><S d="96000"/></SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;

test("a DASH manifest lists video and audio representations with their segment addresses", () => {
  const m = parseMpd(MPD(), "https://media.example.org/dash/manifest.mpd");
  assert.equal(m.duration, 10);
  assert.equal(dashProtection(m), null);
  const v = pickRepresentation(m, "video", { maxHeight: 720 });
  assert.equal(v.id, "v720");
  assert.deepEqual(v.segments.map((s) => s.url), ["https://media.example.org/dash/v720/init.mp4", "https://media.example.org/dash/v720/seg-00001.m4s",
    "https://media.example.org/dash/v720/seg-00002.m4s", "https://media.example.org/dash/v720/seg-00003.m4s"], "10 s at 4 s a segment is 3 segments");
  const a = pickRepresentation(m, "audio");
  assert.deepEqual(a.segments.map((s) => s.url.split("/dash/")[1]), ["a/init.mp4", "a/0.m4s", "a/192000.m4s", "a/384000.m4s"], "SegmentTimeline repeats and carries time on");
  assert.equal(dashFill("$$x$Number%03d$", { Number: 7 }), "$x007");
  assert.equal(isoSeconds("PT1H2M3.5S"), 3723.5);
});

test("DRM detection: a DASH ContentProtection element names the system and stops the save", () => {
  const m = parseMpd(MPD(`
      <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="cenc"/>
      <ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"><cenc:pssh>AAAA</cenc:pssh></ContentProtection>`), "https://media.example.org/m.mpd");
  assert.match(dashProtection(m), /protected \(Common Encryption, Widevine\)/);
  assert.equal(parseMpd("<html></html>", "https://x.org/"), null);
});

test("DRM detection: an element with MediaKeys, encryption boxes in MP4 and WebM content encryption", () => {
  assert.match(elementProtection({ mediaKeys: {} }), /Encrypted Media Extensions/);
  assert.match(elementProtection({ encrypted: true }), /Encrypted Media Extensions/);
  assert.equal(elementProtection({ mediaKeys: null, encrypted: false }), null);
  const clean = muxMp4({ video: { codec: "avc1", width: 16, height: 16, description: new Uint8Array([1, 0x42, 0, 0x1e, 0xff, 0xe0, 0]) },
    chunks: [{ track: "video", timestampUs: 0, key: true, data: new Uint8Array([0, 0, 0, 1, 0x65, 0x65, 0x6e, 0x63, 0x76]) }] });
  assert.equal(mp4Encryption(clean), null, "'encv' bytes inside mdat are media data, not a marker");
  // Rename the avc1 sample entry to encv, as a protected file has it.
  const at = Buffer.from(clean).indexOf("avc1", 40);
  const enc = new Uint8Array(clean); enc.set([0x65, 0x6e, 0x63, 0x76], at);
  assert.equal(mp4Encryption(enc), "encv");
  assert.match(fileProtection(enc), /MP4 encryption box \(encv\)/);
  const webm = muxWebM({ video: { codec: "V_VP9", width: 16, height: 16 }, chunks: [{ track: "video", timestampUs: 0, key: true, data: new Uint8Array([0x50, 0x35, 0x47, 0xe1]) }] });
  assert.equal(webmEncryption(webm), false, "bytes in a Cluster are not a header");
  const header = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x80, 0x6d, 0x80, 0x8a, 0x62, 0x40, 0x87, 0x50, 0x35, 0x84, 0x47, 0xe1, 0x81, 0x05]);
  assert.equal(webmEncryption(header), true);
  const p = mediaProtection(null, "The stream is encrypted (AES-128).");
  assert.deepEqual(p, { protected: true, reason: "The stream is encrypted (AES-128).", line: PROTECTED_LINE });
  assert.equal(mediaProtection(null, null).protected, false);
});

test("the XML reader keeps going on odd markup and decodes entities", () => {
  const x = readXml(`<?xml version="1.0"?><!DOCTYPE x><a k="1 &amp; 2"><b>t &lt; u</b><c/><![CDATA[<raw>]]></a>`);
  assert.equal(x.name, "a");
  assert.equal(x.attrs.k, "1 & 2");
  assert.equal(x.children[0].text, "t < u");
  assert.equal(x.children[1].name, "c");
  assert.equal(x.text, "<raw>");
  assert.equal(readXml(""), null);
});
