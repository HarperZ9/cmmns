<!-- writing-profile: procedure -->
# Troubleshooting

Each entry: what you see, why it happens, and what to do.

## Nothing appears beside the replies

- **Daylight Commons is off for this site or paused.** Open the toolbar popup. If it says Paused or
  the site is switched off, switch it on.
- **The page is not a post's replies.** Signs appear on a post's page and in feeds. Open the post
  itself.
- **The site changed its page.** A redesign can stop a reader from finding posts until the next
  update. Open the toolbar popup: its self-test says which part found nothing. Daylight Commons then
  stays quiet on that part and the site keeps working. Report it on the
  [issue tracker](https://github.com/HarperZ9/daylight-commons/issues) with the site and the date.
- **The first window takes a moment.** On the first post after the browser starts, the rules are
  prepared once. Rest the pointer on the reply again after a second.

## Place says nothing for an account

X shows a location only on an account's About page. Daylight Commons reads it at a steady pace, one
account every 1.5 seconds, or when you press the scan button in the toolbar. Other sites publish no
location; their windows show what that site discloses.

## Firefox removed the add-on after a restart

Release Firefox keeps an unsigned add-on for one session only. Until Mozilla signs the build, load it
again from `about:debugging`, or use Firefox Developer Edition or Nightly. See
[INSTALL.md](../../INSTALL.md#install-in-firefox).

## Chrome warns about developer-mode extensions

Chrome shows that warning for every extension loaded unpacked. It is Chrome's rule for installs
outside the store, not a finding about Daylight Commons. The warning goes away once the extension is
installed from the Chrome Web Store.

## Evidence lookups say "no access"

Evidence lookups need the browser's permission for web.archive.org. Turn the switch off and on in
**Options** and accept the browser's prompt.

## verify-release says "a different head with version ... was already accepted here"

This machine accepted a signed head for the same version before, and the head in your download is
a different one. The command prints both hashes and the steps:

1. Compare the download's `SHA256SUMS` with the one on the release page, from another device or
   person.
2. If they match, the earlier entry came from a local or test build. Check the download once with
   `--no-state`, then rename `~/.radar/head-state.json` (for example to `head-state.json.old`) and
   check again.
3. If they do not match, do not install the download.

Checking any newer release also replaces the stored entry.

## A case command says the folder is not a case folder

Run the command inside the case folder, or add `--case <folder>`. Start a new one with
`node bin/radar.mjs case init "<name>"`.

## A case command refuses a file name "outside the case folder"

A row in the case's tables names a file with `../` or a full path. Daylight Commons reads and writes
only inside the case folder, so it stops. Open the named table (`sources.jsonl`) and correct the
`capture.file` or `capture.text_file` of that row to a name under `captures/`.

## The browser feels slow on a very long thread

Daylight Commons measures each pass. When two passes in a row take longer than 200 ms it waits longer
between passes, up to 2 seconds, and five failed passes in a row stop it on that page until you leave
it. If a page still feels slow, pause Daylight Commons for that site from the toolbar popup and
report the page.

## Where to see what went wrong

Open the page's developer console. Every message from Daylight Commons starts with
`[daylight-commons]`, one line per kind of failure per minute, as a warning.
