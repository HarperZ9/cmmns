// Help for every command, and error messages that say what to do next.
//   cmmns <command> --help        cmmns case <command> --help        cmmns case help <command>
// Each entry: what the command does for you, its usage line, and one example you can run.

export const TOP_HELP = {
  analyze: ["Read a saved thread or export and list the evidence CMMNS finds in it.",
    "cmmns analyze <file> [--json] [--bundle out.json] [--include-text] [--key path] [--no-claims] [--carrier-safe [--page address]]",
    "cmmns analyze thread.html --bundle evidence.json",
    "The file can be a saved page (.html), thread JSON, an X archive tweets.js, a Reddit export CSV, a Mastodon outbox.json or a Bluesky .car."],
  verify: ["Check that a signed evidence bundle or a saved evidence chain is unchanged since it was made.",
    "cmmns verify <bundle.json | evidence-chain.json> [--key-id id] [--json]",
    "cmmns verify evidence.json",
    "Exit code 0 means every check passed; 1 means at least one failed, and the output names it."],
  site: ["Show who owns a news site, its owner type and its fact-check record, from the bundled tables.",
    "cmmns site <domain> [--json]", "cmmns site example.org", ""],
  media: ["Read an image or video file's Content Credentials and AI-generation labels. \"cmmns media convert\" and \"cmmns media compress\" change a file's format or size.",
    "cmmns media <file> [--json]", "cmmns media photo.jpg", "See cmmns media convert --help and cmmns media compress --help."],
  clean: ["Share clean: write a copy of a file with everything it says about itself removed (EXIF and GPS, XMP, IPTC, comments, video tags, PDF and office authors), losslessly.",
    "cmmns clean <file> [--out file] [--json]", "cmmns clean photo.jpg",
    "The original is never changed. Its lineage (original hash to clean hash) goes to clean-lineage.jsonl beside it; keep that file and do not send it. What the picture or words show is not changed."],
  protect: ["Turn source-protection mode on or off for every case on this computer: no requests, Share clean and carrier-safe exports, no investigator name in the case.",
    "cmmns protect on|off|status|limits", "cmmns protect on", "\"cmmns protect limits\" lists what the mode cannot protect against. Not yet independently reviewed."],
  "self-audit": ["See what CMMNS's own signals show about your account: place label, posting clock, apps, renames. Your own account only, from the data export the platform gave you.",
    "cmmns self-audit <your export files...> [--json]", "cmmns self-audit tweets.js account.js", "There is no way to name an account: only your own export files are read, on this computer."],
  export: ["Turn a saved evidence chain into a legal dossier, a PROV record, a write-up or a research dataset.",
    "cmmns export <evidence-chain.json> --profile legal|technical|journalistic|research [--out dir] [--reply replies.json] [--corrections corrections.json] [--seed text]",
    "cmmns export chain.json --profile legal --out dossier", "It refuses a chain that fails its own check."],
};

// `cmmns board make` (bin/lib/board.mjs).
export const BOARD_HELP = ["Make a study board from saved items and their CMMNS notes: book spreads, a grid, a timeline, or an evidence board with a case. Every plate keeps its source, author, time and link.",
  "cmmns board make <folder> --title <name> [--lane design|research|journalism|...] [--keywords a,b,c] [--layout book|grid|timeline|evidence] [--head grotesk|accession|mono] [--site x] [--study] [--since date] [--until date] [--case folder] [--clean] [--no-sidecars] [--pdf] [--out folder]",
  "cmmns board make ~/Downloads/CMMNS/study --title \"Observing mind\" --lane design --keywords contextual,intuitive,human --pdf",
  "Writes index.html, board.json (refdb.board/1, the reference library's format), plates/, fonts/, sidecars/ and MANIFEST.sha256. --clean saves Share clean copies of the plates. --pdf needs Chrome or Edge on this computer. cmmns board render <board.json> [--layout ...] [--out folder] draws a board the reference library made."];

// `cmmns capture verify` (bin/lib/capture-verify.mjs).
export const CAPTURE_HELP = ["Check the evidence captures CMMNS saved: each file and page picture still has the hash its capture recorded, each record is the one its custody line names, and the custody lines found form one unbroken chain.",
  "cmmns capture verify <folder> [--json]", "cmmns capture verify ~/Downloads/CMMNS", "Reads local files only. Exits with 1 when a file or line has changed. Lines saved in other folders are listed as not here, not as broken."];

// `cmmns sidecar check` (bin/lib/sidecar-check.mjs).
export const SIDECAR_HELP = ["Check the notes CMMNS saved beside your files. Flags notes whose \"Continued by the author\" parts were not proved to be one thread (3.6.0 could join unrelated posts saved from a profile or timeline page), and notes that name a file that is missing or was written by another save (3.8.0 and earlier saved a taken name as \"name (1).jpg\" while the note still named \"name.jpg\"). --fix repairs a note's file names only where a file carries the note's post address and was written in the note's save window.",
  "cmmns sidecar check <folder> [--fix] [--json]", "cmmns sidecar check ~/Downloads/CMMNS", "Reads local files only; --fix rewrites only the files line of the notes it can prove. Exits with 1 when a note needs checking."];

// `cmmns media convert` and `compress` (bin/lib/media.mjs), through a system ffmpeg.
export const MEDIA_HELP = {
  convert: ["Convert a picture, GIF, video or sound file to a similar format, with ffmpeg on this computer, and write its lineage beside it.",
    "cmmns media convert <file> --to png|jpg|webp|avif|mp4|webm|ogg|opus [--quality 0-1] [--max-side N] [--max-height N] [--bitrate 2M] [--audio-bitrate 96k] [--fps N] [--out file] [--force] [--json]",
    "cmmns media convert clip.gif --to mp4", "Needs ffmpeg on the PATH, or FFMPEG set to its path. The original is never replaced; <new file>.lineage.json records both hashes and the step."],
  compress: ["Make a picture, GIF, video or sound file smaller in the same kind of format, with ffmpeg on this computer.",
    "cmmns media compress <file> [--to format] [--quality 0-1] [--max-side N] [--max-height N] [--bitrate 1M] [--audio-bitrate 64k] [--fps N] [--out file] [--force] [--json]",
    "cmmns media compress interview.mp4 --max-height 720", "Writes <name>.small.<ext> beside the original, with its lineage file."],
  fetch: ["Save a video from its page address with yt-dlp on this computer, into Downloads/CMMNS/<site>/ (Downloads/Daylight/<site>/ when only that folder exists), with the same note beside it as the extension writes.",
    "cmmns media fetch <page address> [--dir folder] [--json] [--keep-info]",
    "cmmns media fetch \"https://www.youtube.com/watch?v=...\"", "Needs yt-dlp on the PATH, or YTDLP set to its path. Protected (DRM) video is refused. Only save what you have the right to keep."],
};

export const CASE_HELP = {
  init: ["Open a new case folder with its own git history, so every change is recorded.", "cmmns case init <name> [--dir <folder>]", 'cmmns case init "Port contract"'],
  add: ["Capture a web page or a file as a source: its bytes and hash. With --archive, also ask the Wayback Machine to save it.", "cmmns case add <url|file|list.jsonl> [--archive | --no-archive] [--origin O] [--tier T] [--date D] [--what W]", "cmmns case add https://example.org/report", "--archive asks the Internet Archive to save this page. The page's server and the Archive will see the request, and the copy is public. Off by default."],
  "add-library": ["Add every post of a library the browser extension saved (Save page as library) as a source, each with its sidecar note and the hash of each file checked against the library's index.jsonl. Run it again after the library grows: posts already in the case are skipped.",
    "cmmns case add-library <library-folder> [--copy-media] [--origin O] [--tier T] [--what W] [--json]", "cmmns case add-library ~/Downloads/CMMNS/library/x-meditationsincolor",
    "Evidence only: when the subject is a person, the tools show what can be measured (with its method and denominator) or quoted from the public posts, each linked to its post. They never label a person's character, disposition, beliefs not stated, honesty or intent, never predict what a person will do, and never rank people. Two quotes on one subject from different dates are shown side by side; you read them and judge. Media stays in the library folder unless --copy-media."],
  claim: ["Record one claim a source makes, with how well it is supported.", 'cmmns case claim "<text>" --source S01 --rung documented|inference|unproven|contradicted [--retells C01 | --corroborates C01] [--self-sourced] [--date D] [--key K]', 'cmmns case claim "The contract was signed in May" --source S01 --rung documented'],
  claims: ["List every claim; --blind hides the rungs so a second person can label them fresh.", "cmmns case claims [--blind] [--json]", "cmmns case claims --blind"],
  label: ["Record a blind label for a claim from a second reader.", "cmmns case label <claim> --labeller <name> --rung R", "cmmns case label C01 --labeller ana --rung inference"],
  labels: ["Show how far two labellers agree, with Cohen's kappa and each disagreement.", "cmmns case labels [--json]", "cmmns case labels"],
  trace: ["Follow a claim back to its origin and show where its wording drifted.", "cmmns case trace <claim> [--json]", "cmmns case trace C03"],
  event: ["Add a dated event to the timeline, tied to a source.", 'cmmns case event "<text>" --date D --source S [--key K]', 'cmmns case event "Contract signed" --date 2026-05-02 --source S01'],
  timeline: ["Show the timeline, with gaps longer than --gap days marked.", "cmmns case timeline [--gap days] [--json]", "cmmns case timeline --gap 7"],
  edge: ["Record one public act between two accounts: a quote, reply, repost, mention or link.", "cmmns case edge --from A --to B --type quote|reply|repost|mention|link --source S", "cmmns case edge --from @a --to @b --type quote --source S02"],
  network: ["Show who quoted, replied to or linked whom, as text or an offline HTML page.", "cmmns case network [--html out.html] [--json]", "cmmns case network --html network.html"],
  lead: ["Record a record worth asking for, and how decisive it would be.", 'cmmns case lead "<question>" --record R --holder H --decisive 1-5 [--access public|request|legal|unknown] [--claims C01,C02]', 'cmmns case lead "Who approved it?" --record "board minutes" --holder "the council" --decisive 5'],
  leads: ["List the open leads, most decisive first.", "cmmns case leads [--json]", "cmmns case leads"],
  absent: ["Record something that should exist and does not: deleted, edited, sealed, withheld or missing.", 'cmmns case absent ["<what>" --status deleted|edited|sealed|withheld|missing --custodian C [--source S]]', 'cmmns case absent "The original post" --status deleted --custodian X'],
  actor: ["Mark an account as a public figure (handle kept in exports) or private (pseudonym).", "cmmns case actor @handle [--name N] [--public-figure] [--keep-name]", "cmmns case actor @mayor --public-figure", "In source-protection mode every account is a pseudonym in exports unless marked --keep-name."],
  export: ["Write a signed, versioned export for a newsroom, a lawyer or a researcher.", "cmmns case export --profile newsroom|legal|research|all [--clean] [--key-file path] [--force]", "cmmns case export --profile all", "--clean runs Share clean on every file in the export; it is always on in source-protection mode."],
  "verify-export": ["Check an export folder: its signature and every file's hash. Works outside a case folder.", "cmmns case verify-export <export folder>", "cmmns case verify-export exports/newsroom-v1"],
  read: ["Run the Reading lens over every capture and count the techniques it names.", "cmmns case read [--json]", "cmmns case read"],
  run: ["Run the whole pipeline from seed addresses; it resumes where it stopped after a crash.", "cmmns case run <seed...> [--archive] [--stop <stage>] [--name N]", "cmmns case run https://example.org/post/1", "The archive stage asks the Wayback Machine for snapshots only with --archive or the case's archive setting."],
  settings: ["Show or change this case's Wayback requests (off by default) and source-protection mode.", "cmmns case settings [archive on|off] [protection on|off] [--json]", "cmmns case settings protection on", "Protection mode refuses every request; add pages you saved in your browser as files."],
  review: ["Accept or reject the claims and links the pipeline proposed.", "cmmns case review [--accept ids] [--reject ids]", "cmmns case review --accept C04,C05"],
  watch: ["Re-check every capture and lead and record what changed; --schedule shows how to run it daily.", "cmmns case watch [--export] [--schedule]", "cmmns case watch"],
  import: ["Bring a hand-made case folder into this format, without changing the old folder.", "cmmns case import <old-case-folder> [--with-captures]", "cmmns case import ../old-case --with-captures"],
};

export function helpText([what, usage, example, note], name) {
  return `${name}: ${what}\n\nUsage:\n  ${usage}\n\nExample:\n  ${example}\n${note ? `\n${note}\n` : ""}\nEvery command works on local files; only add, run, watch and media fetch go online.\n`;
}

// An error, said as what happened and what to do.
export function friendly(e, cmd) {
  const m = String(e && e.message || e);
  const hint = cmd ? `Run "cmmns ${cmd} --help" for the usage and an example.` : 'Run "cmmns --help" for the commands.';
  if (e && e.code === "ENOENT") return `No such file or folder: ${e.path || m}. Check the path, or run the command from the folder that holds it.\n${hint}`;
  if (e && e.code === "EACCES") return `Permission denied: ${e.path || m}. Choose a folder you can write to.\n${hint}`;
  if (e instanceof SyntaxError) return `A file is not valid JSON: ${m}. Check that it was saved by CMMNS and not edited by hand.\n${hint}`;
  return `${m}\n${hint}`;
}
