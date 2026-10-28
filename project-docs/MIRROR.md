<!-- writing-profile: procedure -->
# Codeberg mirror (author step)

The repository on GitHub stays the place where pull requests and challenges land. A read-only copy
on Codeberg means the code, the catalogue and the release tags survive if GitHub becomes
unavailable to the project. Codeberg is run by a German non-profit association, Codeberg e.V.

Only the author can do this: it needs a Codeberg account in the author's name. Nothing in this
repository creates the account or stores a Codeberg token.

## 1. Make the account and the empty repository

1. Sign up at https://codeberg.org with the email the author uses for the project.
2. Turn on two-factor authentication under Settings, Security.
3. Create a repository named `cmmns`. Leave it empty: no README, no licence, no
   `.gitignore`.
4. In the repository's settings, set the description to the GitHub one and add the GitHub address
   as the website.

## 2. Choose how the mirror updates

Read Codeberg's current mirror rules first (https://docs.codeberg.org, the pages on migrating and
mirroring repositories). Codeberg asks projects to use mirrors sparingly, and its rules can change.

Option A, push at each release (recommended). No token is stored anywhere but the author's machine.

1. Add an SSH key to Codeberg under Settings, SSH / GPG keys.
2. Add the remote once:

   ```
   git remote add codeberg git@codeberg.org:<account>/cmmns.git
   ```

3. After each release, push the default branch and every tag:

   ```
   git push codeberg main --follow-tags
   git push codeberg --tags
   ```

Option B, a pull mirror on Codeberg. Codeberg fetches from GitHub on a schedule.

1. On Codeberg, choose New migration, then GitHub.
2. Enter `https://github.com/HarperZ9/cmmns.git` and tick the mirror option. GitHub
   needs no token for a public repository; leave the token field empty.
3. Set the interval no shorter than 8 hours.

If a token is ever needed for an HTTPS push, make a Codeberg access token with write access to
repositories only, and nothing else. Keep it out of this repository and out of GitHub secrets.

## 3. Check the mirror

Run both commands. Every branch and tag line must match, hash for hash.

```
git ls-remote --heads --tags https://github.com/HarperZ9/cmmns.git | sort
git ls-remote --heads --tags https://codeberg.org/<account>/cmmns.git | sort
```

Then download one release zip from each host and compare its SHA-256 with `SHA256SUMS` from the
release. The signature check in `INSTALL.md` works the same on either copy.

Once releases carry a signed head (3.2.0 and later), compare whole mirrors in one step. Each base
address is the folder that holds `HEAD.json`, `SHA256SUMS` and the release files:

```
node scripts/mirror-check.mjs <mirror 1> <mirror 2> <mirror 3>
```

It checks each mirror's head and `SHA256SUMS` against the project key, then every listed file's
hash, and exits non-zero when any mirror is unreachable, serves an older head than the newest seen,
serves a different head under the same version, or serves a changed file. `--heads-only` skips the
file downloads. It cannot see a file a mirror adds without listing it, because plain HTTP gives no
folder listing.

## 4. Record it

1. Add the Codeberg address to `README.md` under the source link and to `INSTALL.md`.
2. Set row C4 in `docs/COMPLETION.md` to PASS with the date of the check in step 3.
3. On Codeberg, mark the repository as a mirror in its description so nobody opens issues there.
   Challenges and pull requests go to GitHub.
