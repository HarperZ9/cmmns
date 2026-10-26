// Share clean for office documents: Word, Excel and PowerPoint (OOXML: .docx, .xlsx, .pptx) and
// OpenDocument (.odt, .ods, .odp). Both are zip packages. The property parts that name people and
// machines (docProps/core.xml, app.xml and custom.xml; ODF meta.xml) are replaced by empty ones,
// and every zip entry loses its timestamps, extra fields (which hold more times and owner ids) and
// comments. Every other part is copied as the same compressed bytes, so the content is unchanged.
// Returns { bytes, removed, notes }.

import { le16, le32, putLe16, putLe32, latin1, cleanCat, cleanEnc, cleanCrc32 } from "./clean-util.js";

const EMPTY = {
  "docProps/core.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"></cp:coreProperties>',
  "docProps/app.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"></Properties>',
  "docProps/custom.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"></Properties>',
  "meta.xml": '<?xml version="1.0" encoding="UTF-8"?>\n<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"><office:meta/></office:document-meta>',
};
const PART_NAMES = { "docProps/core.xml": "author, last editor, title and dates (core.xml)", "docProps/app.xml": "company, manager, application and editing time (app.xml)", "docProps/custom.xml": "custom properties (custom.xml)", "meta.xml": "author, dates, editing time and generator (meta.xml)" };
const DOS_DATE = 0x21; // 1980-01-01, the earliest a zip can say
export const OFFICE_NOTE = "Comment authors, tracked-change authors and anything written in the document itself stay as they are.";

function centralEntries(b) {
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (le32(b, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("not a zip package");
  const count = le16(b, e + 10), off = le32(b, e + 16);
  if (count === 0xffff || off === 0xffffffff) throw new Error("zip64 packages are not supported");
  const list = [];
  for (let i = 0, p = off; i < count; i++) {
    if (le32(b, p) !== 0x02014b50) throw new Error("zip central directory not understood");
    const nl = le16(b, p + 28), xl = le16(b, p + 30), cl = le16(b, p + 32);
    list.push({ flags: le16(b, p + 8), method: le16(b, p + 10), crc: le32(b, p + 16), csize: le32(b, p + 20), usize: le32(b, p + 24), intAttr: le16(b, p + 36), local: le32(b, p + 42), stamped: le16(b, p + 12) !== 0 || le16(b, p + 14) !== DOS_DATE || xl + cl > 0 || le32(b, p + 38) !== 0, name: new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl)) });
    p += 46 + nl + xl + cl;
  }
  const sorted = list.sort((a, c) => a.local - c.local);
  sorted.comment = le16(b, e + 20);
  return sorted;
}


function header(sig, e, nameBytes, offset) {
  const common = [putLe16(20), putLe16(e.flags & 0x0800), putLe16(e.method), putLe16(0), putLe16(DOS_DATE), putLe32(e.crc), putLe32(e.csize), putLe32(e.usize), putLe16(nameBytes.length), putLe16(0)];
  if (sig === 0x04034b50) return cleanCat([putLe32(sig), ...common, nameBytes]);
  return cleanCat([putLe32(sig), putLe16(20), ...common, putLe16(0), putLe16(0), putLe16(e.intAttr), putLe32(0), putLe32(offset), nameBytes]);
}

export function isOfficePackage(names) { return names.includes("[Content_Types].xml") || names.includes("mimetype"); }

export function zipNames(b) { return centralEntries(b).map((e) => e.name); }

export function cleanOffice(b) {
  const entries = centralEntries(b);
  if (!isOfficePackage(entries.map((e) => e.name))) throw new Error("a zip archive, not an office document; clean each file inside it on its own");
  if (entries.some((e) => e.flags & 1)) throw new Error("the document is encrypted; Share clean cannot read its properties");
  const locals = [], centrals = [], removed = [];
  let at = 0, stamped = entries.comment > 0;
  for (const e of entries) {
    if (e.stamped || le16(b, e.local + 28) > 0) stamped = true;
    const nameBytes = cleanEnc.encode(e.name);
    let data;
    if (EMPTY[e.name] !== undefined) {
      data = cleanEnc.encode(EMPTY[e.name]);
      if (!(e.method === 0 && e.crc === cleanCrc32(data))) removed.push(PART_NAMES[e.name]);
      Object.assign(e, { method: 0, crc: cleanCrc32(data), csize: data.length, usize: data.length });
    } else {
      const start = e.local + 30 + le16(b, e.local + 26) + le16(b, e.local + 28);
      data = b.subarray(start, start + e.csize);
    }
    const local = header(0x04034b50, e, nameBytes);
    centrals.push(header(0x02014b50, e, nameBytes, at));
    locals.push(local, data);
    at += local.length + data.length;
  }
  const cd = cleanCat(centrals);
  const end = cleanCat([putLe32(0x06054b50), putLe16(0), putLe16(0), putLe16(entries.length), putLe16(entries.length), putLe32(cd.length), putLe32(at), putLe16(0)]);
  if (stamped) removed.push("file times, owner ids and comments in the package");
  return { bytes: cleanCat([...locals, cd, end]), removed, notes: [OFFICE_NOTE] };
}

export const zipSniff = (b) => b.length > 4 && le32(b, 0) === 0x04034b50 && latin1(b, 30, 1) !== "";

// A zip of clean copies, stored without compression, with no times, extra fields or comments:
// the package itself says nothing about when or where it was made. entries: [{ name, bytes }].
export function storedZip(entries) {
  const locals = [], centrals = [];
  let at = 0;
  for (const { name, bytes } of entries) {
    const nameBytes = cleanEnc.encode(name), e = { flags: 0x0800, method: 0, crc: cleanCrc32(bytes), csize: bytes.length, usize: bytes.length, intAttr: 0 };
    const local = header(0x04034b50, e, nameBytes);
    centrals.push(header(0x02014b50, e, nameBytes, at));
    locals.push(local, bytes);
    at += local.length + bytes.length;
  }
  const cd = cleanCat(centrals);
  return cleanCat([...locals, cd, putLe32(0x06054b50), putLe16(0), putLe16(0), putLe16(entries.length), putLe16(entries.length), putLe32(cd.length), putLe32(at), putLe16(0)]);
}
