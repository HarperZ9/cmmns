#!/usr/bin/env sh
# Zero-friction 1-command installer for CMMNS (browser extension + CLI) with fail-closed SHA256SUMS verification.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/HarperZ9/cmmns/main/install.sh | sh
#   sh install.sh --self-test
set -eu

REPO="HarperZ9/cmmns"
VERSION="${CMMNS_VERSION:-latest}"
INSTALL_DIR="${CMMNS_INSTALL_DIR:-$HOME/.cmmns}"
FROM_DIR="${CMMNS_FROM_DIR:-}"
NO_PATH=0
SELF_TEST=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --from-dir) FROM_DIR="$2"; shift 2 ;;
    --no-path) NO_PATH=1; shift ;;
    --self-test) SELF_TEST=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print tolower($1)}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print tolower($1)}'
  else
    echo "Refusing install: sha256sum or shasum is required." >&2
    exit 1
  fi
}

expected_hash() {
  sums_file="$1"
  asset_name="$2"
  awk -v target="$asset_name" '
    {
      h = tolower($1)
      name = $2
      sub(/^\*/, "", name)
      if (name == target && h ~ /^[0-9a-f]{64}$/) { print h; exit 0 }
    }
  ' "$sums_file"
}

verify_checksum() {
  file_path="$1"
  asset_name="$2"
  sums_file="$3"
  expected="$(expected_hash "$sums_file" "$asset_name")"
  if [ -z "$expected" ]; then
    echo "Refusing install: $asset_name is missing from SHA256SUMS." >&2
    return 1
  fi
  actual="$(sha256_file "$file_path")"
  if [ "$actual" != "$expected" ]; then
    echo "Refusing install: SHA-256 mismatch for $asset_name (expected $expected, got $actual)." >&2
    return 1
  fi
}

unpack_zip() {
  zip_path="$1"
  out_dir="$2"
  if command -v unzip >/dev/null 2>&1; then
    unzip -qo "$zip_path" -d "$out_dir"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$zip_path" "$out_dir"
  else
    echo "Refusing install: unzip or python3 is required to unpack $zip_path." >&2
    return 1
  fi
}

install_from_stage() {
  stage="$1"
  target="$2"
  sums="$stage/SHA256SUMS"
  [ -f "$sums" ] || { echo "Refusing install: SHA256SUMS not found in $stage." >&2; return 1; }

  ext_zip=""
  if [ -f "$stage/cmmns-ext.zip" ]; then
    ext_zip="$stage/cmmns-ext.zip"
  else
    for cand in "$stage"/cmmns-chrome-*.zip; do
      if [ -f "$cand" ]; then ext_zip="$cand"; break; fi
    done
  fi
  [ -n "$ext_zip" ] || { echo "Refusing install: no CMMNS extension zip found." >&2; return 1; }
  verify_checksum "$ext_zip" "$(basename "$ext_zip")" "$sums"

  cli_zip=""
  for cand in "$stage"/cmmns-cli-*.zip; do
    if [ -f "$cand" ]; then cli_zip="$cand"; break; fi
  done
  if [ -n "$cli_zip" ]; then
    verify_checksum "$cli_zip" "$(basename "$cli_zip")" "$sums"
  fi

  ext_dir="$target/ext"
  cli_dir="$target/cli"
  bin_dir="$target/bin"
  rm -rf "$ext_dir"
  mkdir -p "$ext_dir" "$bin_dir"
  unpack_zip "$ext_zip" "$ext_dir"

  if [ -n "$cli_zip" ]; then
    rm -rf "$cli_dir"
    mkdir -p "$cli_dir"
    unpack_zip "$cli_zip" "$cli_dir"
    entry="$(find "$cli_dir" -name 'radar.mjs' -type f | head -n 1 || true)"
    if [ -n "$entry" ]; then
      cat > "$bin_dir/cmmns" <<EOF
#!/usr/bin/env sh
exec node "$entry" "\$@"
EOF
      chmod +x "$bin_dir/cmmns"
      if [ "$NO_PATH" -eq 0 ] && [ -n "${HOME:-}" ]; then
        for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
          if [ -f "$rc" ] && ! grep -Fq "$bin_dir" "$rc"; then
            printf '\nexport PATH="%s:$PATH"\n' "$bin_dir" >> "$rc"
          fi
        done
      fi
    fi
  fi

  cp "$sums" "$target/SHA256SUMS"
  echo "CMMNS verified (SHA256SUMS OK) and unpacked to: $target"
  echo "Load unpacked extension in chrome://extensions -> $ext_dir"
}

run_self_test() {
  tmp="$(mktemp -d 2>/dev/null || mktemp -d -t cmmns-selftest)"
  trap 'rm -rf "$tmp"' EXIT INT TERM
  stage="$tmp/stage"
  mkdir -p "$stage" "$tmp/ext_src" "$tmp/cli_src/bin"
  printf '{"manifest_version":3,"name":"CMMNS","version":"3.10.0"}\n' > "$tmp/ext_src/manifest.json"
  printf 'console.log("cmmns selftest ok");\n' > "$tmp/cli_src/bin/radar.mjs"

  python3 -c '
import os, sys, zipfile
def pack(src, dst):
    with zipfile.ZipFile(dst, "w") as z:
        for root, _, files in os.walk(src):
            for f in files:
                p = os.path.join(root, f)
                z.write(p, os.path.relpath(p, src))
pack(sys.argv[1], sys.argv[2])
pack(sys.argv[3], sys.argv[4])
' "$tmp/ext_src" "$stage/cmmns-ext.zip" "$tmp/cli_src" "$stage/cmmns-cli-3.10.0.zip"

  printf '%s  cmmns-ext.zip\n%s  cmmns-cli-3.10.0.zip\n' \
    "$(sha256_file "$stage/cmmns-ext.zip")" \
    "$(sha256_file "$stage/cmmns-cli-3.10.0.zip")" > "$stage/SHA256SUMS"

  NO_PATH=1
  install_from_stage "$stage" "$tmp/dest_ok"
  [ -f "$tmp/dest_ok/ext/manifest.json" ] || { echo "Self-test failed: manifest.json missing." >&2; exit 1; }
  [ -x "$tmp/dest_ok/bin/cmmns" ] || { echo "Self-test failed: cmmns shim missing." >&2; exit 1; }

  # Planted 1-byte tamper control: must fail closed before extracting.
  python3 -c '
import sys
p = sys.argv[1]
b = bytearray(open(p, "rb").read())
b[-1] ^= 0x01
open(p, "wb").write(b)
' "$stage/cmmns-ext.zip"

  if install_from_stage "$stage" "$tmp/dest_bad" >/dev/null 2>&1; then
    echo "Self-test failed: tampered archive was not refused." >&2
    exit 1
  fi
  [ ! -f "$tmp/dest_bad/ext/manifest.json" ] || { echo "Self-test failed: tampered archive extracted." >&2; exit 1; }
  echo "SELFTEST PASS: valid install verified and planted 1-byte tamper refused."
}

if [ "$SELF_TEST" -eq 1 ]; then
  run_self_test
  exit 0
fi

if [ -n "$FROM_DIR" ]; then
  install_from_stage "$FROM_DIR" "$INSTALL_DIR"
  exit 0
fi

if [ "$VERSION" = "latest" ]; then
  api="https://api.github.com/repos/$REPO/releases/latest"
else
  case "$VERSION" in v*) tag="$VERSION" ;; *) tag="v$VERSION" ;; esac
  api="https://api.github.com/repos/$REPO/releases/tags/$tag"
fi

tmp="$(mktemp -d 2>/dev/null || mktemp -d -t cmmns-install)"
trap 'rm -rf "$tmp"' EXIT INT TERM
meta="$tmp/release.json"
curl -fsSL -H "Accept: application/vnd.github+json" -H "User-Agent: cmmns-installer" "$api" -o "$meta"

urls="$(python3 -c '
import json, re, sys
assets = json.load(open(sys.argv[1], encoding="utf-8")).get("assets", [])
by_name = {a["name"]: a["browser_download_url"] for a in assets}
pick = []
if "SHA256SUMS" in by_name: pick.append(("SHA256SUMS", by_name["SHA256SUMS"]))
if "cmmns-ext.zip" in by_name:
    pick.append(("cmmns-ext.zip", by_name["cmmns-ext.zip"]))
else:
    for n, u in by_name.items():
        if re.match(r"^cmmns-chrome-.+\.zip$", n): pick.append((n, u)); break
for n, u in by_name.items():
    if re.match(r"^cmmns-cli-.+\.zip$", n): pick.append((n, u)); break
for n, u in pick:
    print(f"{n}\t{u}")
' "$meta")"

printf '%s\n' "$urls" | while IFS='	' read -r name url; do
  [ -n "$name" ] && curl -fsSL "$url" -o "$tmp/$name"
done
install_from_stage "$tmp" "$INSTALL_DIR"
