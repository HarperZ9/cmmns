# Fonts in this directory

| File | Font | Designer | Terms |
|---|---|---|---|
| `AccessionStencil.woff2` | Accession Stencil, variable (weight 300 to 900), version 0.1.0 | Zain Dana Harper | SIL Open Font License 1.1, full text in `OFL-accession.txt` |
| `hanken-grotesk.woff2` | Hanken Grotesk | The Hanken Grotesk Project Authors | SIL Open Font License 1.1, full text in `OFL-hanken-grotesk.txt` |
| `jetbrains-mono-regular.woff2` | JetBrains Mono Regular, version 2.304 | The JetBrains Mono Project Authors | SIL Open Font License 1.1, full text in `OFL-jetbrains-mono.txt` |

Accession Stencil sets the running heads and titles of study boards, Hanken Grotesk sets the words and JetBrains Mono sets figures and code. The Accession file is the unmodified `variable/AccessionStencil[wght].woff2` from the typeface's release build, whose name table carries the OFL (nameID 13); its SHA-256 is `7e6c643fa9c4ea49a19fe3ee948288516dd83821e1dca56a5ae1253bba490963`. CMMNS' pages
use them; the window on social sites takes the site's own font for the post and these two for
itself.

## Why JetBrains Mono and not Conso (2026-10-22)

Until 3.0.0 the figure face was Conso, the face the author's site uses. Conso is under its
designer's licence, which is not an open source licence, so it could not ship inside an AGPL
release whose every file anyone may reuse. JetBrains Mono is the fallback the site's own style
sheet names next after Conso (`--font-mono: "Conso", "JetBrains Mono", ...` in the site's
`system/system.css`), and it is under the SIL Open Font License 1.1. The file is the unmodified
`fonts/webfonts/JetBrainsMono-Regular.woff2` from the JetBrains Mono 2.304 release
(github.com/JetBrains/JetBrainsMono, `JetBrainsMono-2.304.zip`, SHA-256
`6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf`). The woff2 file's
SHA-256 is `a9cb1cd82332b23a47e3a1239d25d13c86d16c4220695e34b243effa999f45f2`.

Conso is no longer in the tree or in any package. Commits before 3.0.0 still hold it in the
repository's history, under the author's licence for it; those copies are not covered by
CMMNS' licences.
