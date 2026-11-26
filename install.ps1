param(
  [string]$Version = $(if ($env:CMMNS_VERSION) { $env:CMMNS_VERSION } else { "latest" }),
  [string]$InstallDir = $(if ($env:CMMNS_INSTALL_DIR) { $env:CMMNS_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "CMMNS" }),
  [string]$FromDir = $(if ($env:CMMNS_FROM_DIR) { $env:CMMNS_FROM_DIR } else { "" }),
  [switch]$NoPath,
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"
$Repo = "HarperZ9/cmmns"

function Get-Sha256Hex([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Parse-Sums([string]$SumsPath) {
  $map = @{}
  foreach ($line in (Get-Content -Path $SumsPath -Encoding UTF8)) {
    if ($line -match '^\s*([0-9a-fA-F]{64})\s+\*?(.+?)\s*$') {
      $map[$Matches[2].Trim()] = $Matches[1].ToLowerInvariant()
    }
  }
  return $map
}

function Assert-Checksum([string]$FilePath, [string]$AssetName, [hashtable]$Sums) {
  if (-not $Sums.ContainsKey($AssetName)) {
    throw "Refusing install: $AssetName is missing from SHA256SUMS."
  }
  $actual = Get-Sha256Hex $FilePath
  $expected = $Sums[$AssetName]
  if ($actual -ne $expected) {
    throw "Refusing install: SHA-256 mismatch for $AssetName (expected $expected, got $actual)."
  }
}

function Add-UserPath([string]$BinDir) {
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($current) { $parts = $current.Split(";") | Where-Object { $_ -ne "" } }
  if ($parts -notcontains $BinDir) {
    $next = ($parts + $BinDir) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $next, "User")
  }
  if (($env:Path.Split(";")) -notcontains $BinDir) {
    $env:Path = "$BinDir;$env:Path"
  }
}

function Resolve-ReleaseInfo([string]$RequestedVersion) {
  $api = if ($RequestedVersion -eq "latest") {
    "https://api.github.com/repos/$Repo/releases/latest"
  } else {
    $tag = if ($RequestedVersion.StartsWith("v")) { $RequestedVersion } else { "v$RequestedVersion" }
    "https://api.github.com/repos/$Repo/releases/tags/$tag"
  }
  $headers = @{ "User-Agent" = "cmmns-installer"; "Accept" = "application/vnd.github+json" }
  return Invoke-RestMethod -Uri $api -Headers $headers
}

function Install-FromStage([string]$StageDir, [string]$TargetDir, [bool]$SkipPath) {
  $sumsFile = Join-Path $StageDir "SHA256SUMS"
  if (-not (Test-Path $sumsFile)) { throw "Refusing install: SHA256SUMS not found in $StageDir." }
  $sums = Parse-Sums $sumsFile

  $extAsset = Get-ChildItem -Path $StageDir -File | Where-Object {
    $_.Name -eq "cmmns-ext.zip" -or $_.Name -match '^cmmns-chrome-.+\.zip$'
  } | Select-Object -First 1
  if (-not $extAsset) { throw "Refusing install: no CMMNS extension archive found." }
  Assert-Checksum $extAsset.FullName $extAsset.Name $sums

  $cliAsset = Get-ChildItem -Path $StageDir -File | Where-Object {
    $_.Name -match '^cmmns-cli-.+\.zip$'
  } | Select-Object -First 1
  if ($cliAsset) { Assert-Checksum $cliAsset.FullName $cliAsset.Name $sums }

  $extDir = Join-Path $TargetDir "ext"
  $cliDir = Join-Path $TargetDir "cli"
  $binDir = Join-Path $TargetDir "bin"
  New-Item -ItemType Directory -Force -Path $extDir, $binDir | Out-Null
  Get-ChildItem -Path $extDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
  Expand-Archive -Path $extAsset.FullName -DestinationPath $extDir -Force

  if ($cliAsset) {
    New-Item -ItemType Directory -Force -Path $cliDir | Out-Null
    Get-ChildItem -Path $cliDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
    Expand-Archive -Path $cliAsset.FullName -DestinationPath $cliDir -Force
    $entry = Get-ChildItem -Path $cliDir -Recurse -Filter "radar.mjs" | Select-Object -First 1
    if ($entry) {
      $shim = "@echo off`r`nnode `"$($entry.FullName)`" %*`r`n"
      Set-Content -Path (Join-Path $binDir "cmmns.cmd") -Value $shim -Encoding ASCII
      if (-not $SkipPath) { Add-UserPath $binDir }
    }
  }

  Copy-Item -Path $sumsFile -Destination (Join-Path $TargetDir "SHA256SUMS") -Force
  Write-Output "CMMNS verified (SHA256SUMS OK) and unpacked to: $TargetDir"
  Write-Output "Load unpacked extension in chrome://extensions -> $extDir"
}

function Invoke-SelfTest {
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("cmmns-install-selftest-" + [Guid]::NewGuid().ToString("N"))
  try {
    $stage = Join-Path $tmp "stage"
    $payload = Join-Path $tmp "payload"
    $cliPayload = Join-Path $tmp "cli-payload"
    $destOk = Join-Path $tmp "dest-ok"
    $destBad = Join-Path $tmp "dest-bad"
    New-Item -ItemType Directory -Force -Path $stage, $payload, (Join-Path $cliPayload "bin") | Out-Null

    Set-Content -Path (Join-Path $payload "manifest.json") -Value '{"manifest_version":3,"name":"CMMNS","version":"3.10.0"}' -Encoding UTF8
    Set-Content -Path (Join-Path $cliPayload "bin\radar.mjs") -Value 'console.log("cmmns selftest ok");' -Encoding UTF8
    $extZip = Join-Path $stage "cmmns-ext.zip"
    $cliZip = Join-Path $stage "cmmns-cli-3.10.0.zip"
    Compress-Archive -Path (Join-Path $payload "*") -DestinationPath $extZip -Force
    Compress-Archive -Path (Join-Path $cliPayload "*") -DestinationPath $cliZip -Force

    $sumsText = "$(Get-Sha256Hex $extZip)  cmmns-ext.zip`n$(Get-Sha256Hex $cliZip)  cmmns-cli-3.10.0.zip`n"
    Set-Content -Path (Join-Path $stage "SHA256SUMS") -Value $sumsText -NoNewline -Encoding UTF8

    Install-FromStage $stage $destOk $true
    if (-not (Test-Path (Join-Path $destOk "ext\manifest.json"))) { throw "Self-test failed: manifest.json missing after valid install." }
    if (-not (Test-Path (Join-Path $destOk "bin\cmmns.cmd"))) { throw "Self-test failed: cmmns.cmd shim missing after valid install." }

    # Planted 1-byte tamper control: installer must refuse before extracting.
    $bytes = [System.IO.File]::ReadAllBytes($extZip)
    $bytes[$bytes.Length - 1] = $bytes[$bytes.Length - 1] -bxor 0x01
    [System.IO.File]::WriteAllBytes($extZip, $bytes)

    $refused = $false
    try { Install-FromStage $stage $destBad $true } catch { if ($_.Exception.Message -match "SHA-256 mismatch") { $refused = $true } else { throw } }
    if (-not $refused) { throw "Self-test failed: tampered archive was not refused." }
    if (Test-Path (Join-Path $destBad "ext\manifest.json")) { throw "Self-test failed: tampered archive was extracted." }
    Write-Output "SELFTEST PASS: valid install verified and planted 1-byte tamper refused."
  } finally {
    Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if ($SelfTest) {
  Invoke-SelfTest
  exit 0
}

if ($FromDir) {
  Install-FromStage (Resolve-Path $FromDir).Path $InstallDir ([bool]$NoPath)
  exit 0
}

$rel = Resolve-ReleaseInfo $Version
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("cmmns-install-" + [Guid]::NewGuid().ToString("N"))
try {
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $assets = @($rel.assets)
  $sumsAsset = $assets | Where-Object { $_.name -eq "SHA256SUMS" } | Select-Object -First 1
  if (-not $sumsAsset) { throw "Refusing install: release $($rel.tag_name) has no SHA256SUMS asset." }
  $extAsset = $assets | Where-Object { $_.name -eq "cmmns-ext.zip" } | Select-Object -First 1
  if (-not $extAsset) { $extAsset = $assets | Where-Object { $_.name -match '^cmmns-chrome-.+\.zip$' } | Select-Object -First 1 }
  if (-not $extAsset) { throw "Refusing install: release $($rel.tag_name) has no extension zip asset." }
  $cliAsset = $assets | Where-Object { $_.name -match '^cmmns-cli-.+\.zip$' } | Select-Object -First 1

  foreach ($a in @($sumsAsset, $extAsset, $cliAsset)) {
    if ($a) { Invoke-WebRequest -Uri $a.browser_download_url -OutFile (Join-Path $tmp $a.name) }
  }
  Install-FromStage $tmp $InstallDir ([bool]$NoPath)
} finally {
  Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
