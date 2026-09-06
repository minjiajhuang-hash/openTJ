param([string]$Version = '1.4.6')
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Use a numeric ClamAV release version.' }
$repoRoot = Split-Path -Parent $PSScriptRoot
$clamRoot = Join-Path $repoRoot 'clamav-data'
$engineRoot = Join-Path $clamRoot 'engine'
$engine = Join-Path $engineRoot "clamav-$Version.win.x64"
$database = Join-Path $clamRoot 'database'
New-Item -ItemType Directory -Force -Path $clamRoot, $engineRoot, $database | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $engine 'freshclam.exe'))) {
    $archive = Join-Path $clamRoot "clamav-$Version.zip"
    Write-Host "Downloading ClamAV $Version from clamav.net..."
    & curl.exe --fail --location --silent --show-error --output $archive "https://www.clamav.net/downloads/production/clamav-$Version.win.x64.zip"
    if ($LASTEXITCODE -ne 0) { throw 'ClamAV download failed.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $engineRoot -Force
}
# Native ClamAV tools need ASCII paths on Windows, including non-ASCII profiles.
$fs = New-Object -ComObject Scripting.FileSystemObject
$shortDatabase = $fs.GetFolder($database).ShortPath
$shortEngine = $fs.GetFolder($engine).ShortPath
$configPath = Join-Path $clamRoot 'freshclam.conf'
$config = "DatabaseDirectory $shortDatabase`nDatabaseMirror database.clamav.net`nDNSDatabaseInfo current.cvd.clamav.net`nConnectTimeout 30`nReceiveTimeout 120`n"
[IO.File]::WriteAllText($configPath, $config, [Text.Encoding]::ASCII)
Write-Host 'Updating and verifying the official antivirus signatures...'
& (Join-Path $shortEngine 'freshclam.exe') "--config-file=$($fs.GetFile($configPath).ShortPath)" --quiet
if ($LASTEXITCODE -ne 0) { throw 'Signature update failed; uploads must remain quarantined.' }
$envPath = Join-Path $repoRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw 'Create .env from .env.example first.' }
$envText = [IO.File]::ReadAllText($envPath)
$settings = @{
    CLAMAV_COMMAND = (Join-Path $shortEngine 'clamscan.exe').Replace('\', '/')
    CLAMAV_DATABASE = $shortDatabase.Replace('\', '/')
}
foreach ($key in $settings.Keys) {
    $line = "$key=$($settings[$key])"
    if ($envText -match "(?m)^$key=.*$") {
        $envText = [regex]::Replace($envText, "(?m)^$key=.*$", $line)
    } else { $envText = $envText.TrimEnd() + "`n$line`n" }
}
[IO.File]::WriteAllText($envPath, $envText, (New-Object Text.UTF8Encoding($false)))
Write-Host 'ClamAV is ready. Restart the worker to read the updated .env.'
