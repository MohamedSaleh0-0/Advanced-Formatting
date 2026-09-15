[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$ManifestPath = Join-Path $RepoRoot "manifest.json"
$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$PackagePath = Join-Path $RepoRoot "package.json"
$Package = Get-Content $PackagePath -Raw | ConvertFrom-Json
$VersionsPath = Join-Path $RepoRoot "versions.json"
$Versions = Get-Content $VersionsPath -Raw | ConvertFrom-Json
$Version = [string]$Manifest.version
$Title = "$($Manifest.name) $Version"

if (-not $Version) {
    throw "manifest.json does not contain a version."
}

if ($Version -notmatch "^\d+\.\d+\.\d+$") {
    throw "Version must use semantic versioning, for example 1.0.1."
}

if ([string]$Package.version -ne $Version) {
    throw "package.json version '$($Package.version)' does not match manifest.json version '$Version'."
}

$VersionEntry = $Versions.PSObject.Properties | Where-Object { $_.Name -eq $Version }
if (-not $VersionEntry) {
    throw "versions.json does not contain version '$Version'. Add an entry mapping it to the minimum Obsidian version before releasing."
}

if ([string]$VersionEntry.Value -ne [string]$Manifest.minAppVersion) {
    throw "versions.json entry for '$Version' must match manifest.json minAppVersion '$($Manifest.minAppVersion)'."
}

Write-Host "Checking GitHub authentication..."
gh auth status

Write-Host "Checking working tree..."
$Status = git status --porcelain
if ($Status) {
    throw "Working tree is not clean. Commit your changes before releasing."
}

$Branch = git branch --show-current
if (-not $Branch) {
    throw "Could not determine the current Git branch. Release from a named branch."
}

Write-Host "Pushing committed branch '$Branch'..."
git push origin $Branch

Write-Host "Building plugin..."
npm run typecheck
npm run build

$RequiredAssets = @(
    "main.js",
    "manifest.json"
)

foreach ($Asset in $RequiredAssets) {
    if (-not (Test-Path (Join-Path $RepoRoot $Asset))) {
        throw "Required release asset missing: $Asset"
    }
}

$Assets = @(
    "main.js",
    "manifest.json"
)

if (Test-Path (Join-Path $RepoRoot "styles.css")) {
    $Assets += "styles.css"
}

$ExistingTag = git tag --list $Version
if ($ExistingTag) {
    throw "Git tag '$Version' already exists locally."
}

$RemoteTag = git ls-remote --tags origin "refs/tags/$Version"
if ($RemoteTag) {
    throw "Git tag '$Version' already exists on origin."
}

Write-Host "Creating annotated tag '$Version'..."
git tag -a $Version -m "Release $Version"

Write-Host "Pushing tag..."
git push origin $Version

$ReleaseArgs = @(
    "release",
    "create",
    $Version
)

foreach ($Asset in $Assets) {
    $ReleaseArgs += $Asset
}

$ReleaseArgs += @(
    "--title", $Title,
    "--generate-notes",
    "--verify-tag",
    "--fail-on-no-commits"
)

Write-Host "Creating GitHub release..."
gh @ReleaseArgs

Write-Host ""
Write-Host "Release completed successfully:"
$RepoSlug = gh repo view --json nameWithOwner --jq .nameWithOwner
Write-Host "https://github.com/$RepoSlug/releases/tag/$Version"
