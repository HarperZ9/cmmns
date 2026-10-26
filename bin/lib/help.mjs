// Help for every command, and error messages that say what to do next.
//   daylight <command> --help        daylight case <command> --help        daylight case help <command>
// Each entry: what the command does for you, its usage line, and one example you can run.

export const TOP_HELP = {
  analyze: ["Read a saved thread or export and list the evidence Daylight Commons finds in it.",
    "daylight analyze <file> [--json] [--bundle out.json] [--include-text] [--key path] [--no-claims] [--carrier-safe [--page address]]",
    "daylight analyze thread.html --bundle evidence.json",
    "The file can be a saved page (.html), thread JSON, an X archive tweets.js, a Reddit export CSV, a Mastodon outbox.json or a Bluesky .car."],
  verify: ["Check that a signed evidence bundle or a saved evidence chain is unchanged since it was made.",
    "daylight verify <bundle.json | evidence-chain.json> [--key-id id] [--json]",
    "daylight verify evidence.json",
    "Exit code 0 means every check passed; 1 means at least one failed, and the output names it."],
  site: ["Show who owns a news site, its owner type and its fact-check record, from the bundled tables.",
    "daylight site <domain> [--json]", "daylight site example.org", ""],
  media: ["Read an image or video file's Content Credentials and AI-generation labels. \"daylight media convert\" and \"daylight media compress\" change a file's format or size.",
    "daylight media <file> [--json]", "daylight media photo.jpg", "See daylight media convert --help and daylight media compress --help."],
  clean: ["Share clean: write a copy of a file with everything it says about itself removed (EXIF and GPS, XMP, IPTC, comments, video tags, PDF and office authors), losslessly.",
    "daylight clean <file> [--out file] [--json]", "daylight clean photo.jpg",
    "The original is never changed. Its lineage (original hash to clean hash) goes to clean-lineage.jsonl beside it; keep that file and do not send it. What the picture or words show is not changed."],
  protect: ["Turn source-protection mode on or off for every case on this computer: no requests, Share clean and carrier-safe exports, no investigator name in the case.",
    "daylight protect on|off|status|limits", "daylight protect on", "\"daylight protect limits\" lists what the mode cannot protect against. Not yet independently reviewed."],
  "self-audit": ["See what Daylight's own signals show about your account: place label, posting clock, apps, renames. Your own account only, from the data export the platform gave you.",
    "daylight self-audit <your export files...> [--json]", "daylight self-audit tweets.js account.js", "There is no way to name an account: only your own export files are read, on this computer."],
  export: ["Turn a saved evidence chain into a legal dossier, a PROV record, a write-up or a research dataset.",
    "daylight export <evidence-chain.json> --profile legal|technical|journalistic|research [--out dir] [--reply replies.json] [--corrections corrections.json] [--seed text]",
    "daylight export chain.json --profile legal --out dossier", "It refuses a chain that fails its own check."],
};

// `daylight media convert` and `compress` (bin/lib/media.mjs), through a system ffmpeg.
export const MEDIA_HELP = {
  convert: ["Convert a picture, GIF, video or sound file to a similar format, with ffmpeg on this computer, and write its lineage beside it.",
    "daylight media convert <file> --to png|jpg|webp|avif|mp4|webm|ogg|opus [--quality 0-1] [--max-side N] [--max-height N] [--bitrate 2M] [--audio-bitrate 96k] [--fps N] [--out file] [--force] [--json]",
    "daylight media convert clip.gif --to mp4", "Needs ffmpeg on the PATH, or FFMPEG set to its path. The original is never replaced; <new file>.lineage.json records both hashes and the step."],
  compress: ["Make a picture, GIF, video or sound file smaller in the same kind of format, with ffmpeg on this computer.",
    "daylight media compress <file> [--to format] [--quality 0-1] [--max-side N] [--max-height N] [--bitrate 1M] [--audio-bitrate 64k] [--fps N] [--out file] [--force] [--json]",
    "daylight media compress interview.mp4 --max-height 720", "Writes <name>.small.<ext> beside the original, with its lineage file."],
};

export const CASE_HELP = {
  init: ["Open a new case folder with its own git history, so every change is recorded.", "daylight case init <name> [--dir <folder>]", 'daylight case init "Port contract"'],
  add: ["Capture a web page or a file as a source: its bytes and hash. With --archive, also ask the Wayback Machine to save it.", "daylight case add <url|file|list.jsonl> [--archive | --no-archive] [--origin O] [--tier T] [--date D] [--what W]", "daylight case add https://example.org/report", "--archive asks the Internet Archive to save this page. The page's server and the Archive will see the request, and the copy is public. Off by default."],
  claim: ["Record one claim a source makes, with how well it is supported.", 'daylight case claim "<text>" --source S01 --rung documented|inference|unproven|contradicted [--retells C01 | --corroborates C01] [--self-sourced] [--date D] [--key K]', 'daylight case claim "The contract was signed in May" --source S01 --rung documented'],
  claims: ["List every claim; --blind hides the rungs so a second person can label them fresh.", "daylight case claims [--blind] [--json]", "daylight case claims --blind"],
  label: ["Record a blind label for a claim from a second reader.", "daylight case label <claim> --labeller <name> --rung R", "daylight case label C01 --labeller ana --rung inference"],
  labels: ["Show how far two labellers agree, with Cohen's kappa and each disagreement.", "daylight case labels [--json]", "daylight case labels"],
  trace: ["Follow a claim back to its origin and show where its wording drifted.", "daylight case trace <claim> [--json]", "daylight case trace C03"],
  event: ["Add a dated event to the timeline, tied to a source.", 'daylight case event "<text>" --date D --source S [--key K]', 'daylight case event "Contract signed" --date 2026-05-02 --source S01'],
  timeline: ["Show the timeline, with gaps longer than --gap days marked.", "daylight case timeline [--gap days] [--json]", "daylight case timeline --gap 7"],
  edge: ["Record one public act between two accounts: a quote, reply, repost, mention or link.", "daylight case edge --from A --to B --type quote|reply|repost|mention|link --source S", "daylight case edge --from @a --to @b --type quote --source S02"],
  network: ["Show who quoted, replied to or linked whom, as text or an offline HTML page.", "daylight case network [--html out.html] [--json]", "daylight case network --html network.html"],
  lead: ["Record a record worth asking for, and how decisive it would be.", 'daylight case lead "<question>" --record R --holder H --decisive 1-5 [--access public|request|legal|unknown] [--claims C01,C02]', 'daylight case lead "Who approved it?" --record "board minutes" --holder "the council" --decisive 5'],
  leads: ["List the open leads, most decisive first.", "daylight case leads [--json]", "daylight case leads"],
  absent: ["Record something that should exist and does not: deleted, edited, sealed, withheld or missing.", 'daylight case absent ["<what>" --status deleted|edited|sealed|withheld|missing --custodian C [--source S]]', 'daylight case absent "The original post" --status deleted --custodian X'],
  actor: ["Mark an account as a public figure (handle kept in exports) or private (pseudonym).", "daylight case actor @handle [--name N] [--public-figure] [--keep-name]", "daylight case actor @mayor --public-figure", "In source-protection mode every account is a pseudonym in exports unless marked --keep-name."],
  export: ["Write a signed, versioned export for a newsroom, a lawyer or a researcher.", "daylight case export --profile newsroom|legal|research|all [--clean] [--key-file path] [--force]", "daylight case export --profile all", "--clean runs Share clean on every file in the export; it is always on in source-protection mode."],
  "verify-export": ["Check an export folder: its signature and every file's hash. Works outside a case folder.", "daylight case verify-export <export folder>", "daylight case verify-export exports/newsroom-v1"],
  read: ["Run the Reading lens over every capture and count the techniques it names.", "daylight case read [--json]", "daylight case read"],
  run: ["Run the whole pipeline from seed addresses; it resumes where it stopped after a crash.", "daylight case run <seed...> [--archive] [--stop <stage>] [--name N]", "daylight case run https://example.org/post/1", "The archive stage asks the Wayback Machine for snapshots only with --archive or the case's archive setting."],
  settings: ["Show or change this case's Wayback requests (off by default) and source-protection mode.", "daylight case settings [archive on|off] [protection on|off] [--json]", "daylight case settings protection on", "Protection mode refuses every request; add pages you saved in your browser as files."],
  review: ["Accept or reject the claims and links the pipeline proposed.", "daylight case review [--accept ids] [--reject ids]", "daylight case review --accept C04,C05"],
  watch: ["Re-check every capture and lead and record what changed; --schedule shows how to run it daily.", "daylight case watch [--export] [--schedule]", "daylight case watch"],
  import: ["Bring a hand-made case folder into this format, without changing the old folder.", "daylight case import <old-case-folder> [--with-captures]", "daylight case import ../old-case --with-captures"],
};

export function helpText([what, usage, example, note], name) {
  return `${name}: ${what}\n\nUsage:\n  ${usage}\n\nExample:\n  ${example}\n${note ? `\n${note}\n` : ""}\nEvery command works on local files; only add, run and watch go online.\n`;
}

// An error, said as what happened and what to do.
export function friendly(e, cmd) {
  const m = String(e && e.message || e);
  const hint = cmd ? `Run "daylight ${cmd} --help" for the usage and an example.` : 'Run "daylight --help" for the commands.';
  if (e && e.code === "ENOENT") return `No such file or folder: ${e.path || m}. Check the path, or run the command from the folder that holds it.\n${hint}`;
  if (e && e.code === "EACCES") return `Permission denied: ${e.path || m}. Choose a folder you can write to.\n${hint}`;
  if (e instanceof SyntaxError) return `A file is not valid JSON: ${m}. Check that it was saved by Daylight Commons and not edited by hand.\n${hint}`;
  return `${m}\n${hint}`;
}
