<#
.SYNOPSIS
    Safe alternating-slot production deployment for the Intelligent Systems Lab portfolio.

.DESCRIPTION
    Production serves one of two release directories, never `.next`:

        .next-release-a  /  .next-release-b

    A deployment always builds into the INACTIVE slot, smoke-tests it on a
    temporary loopback port, and only then points PM2 at it. The running
    production process reads a directory the build never touches, so a build
    can no longer corrupt the live site — the failure that took the portfolio
    down twice during Stage 05.

    If the post-switch health check fails, the previous slot is restored
    automatically and the script exits non-zero.

.PARAMETER AllowDirtyTree
    Proceed even though the Git working tree has uncommitted changes.
    Without it a dirty tree aborts, so unrelated files are never shipped
    unnoticed.

.PARAMETER FailAfterSwitchForTest
    Rollback drill. Forces the post-switch health check to be treated as
    failed, so the automatic rollback path can be exercised for real without
    breaking the site for more than a moment.

.EXAMPLE
    npm run deploy:safe
#>

[CmdletBinding()]
param(
    [switch]$AllowDirtyTree,
    [switch]$FailAfterSwitchForTest
)

$ErrorActionPreference = "Stop"

# --- Constants ---------------------------------------------------------------

$RepoRoot      = Split-Path -Parent $PSScriptRoot
$SlotA         = ".next-release-a"
$SlotB         = ".next-release-b"
$LegacySlot    = ".next"
$ProdPort      = 3100
$SmokePorts    = @(3199, 3198, 3197, 3196)
$PublicUrl     = "https://intelligent-systems-lab.duckdns.org"
$Pm2Config     = Join-Path $PSScriptRoot "pm2.portfolio.config.js"
$LogDir        = Join-Path $PSScriptRoot "logs"
$MutexName     = "Global\MilkyIntelligencePortfolioSafeDeploy"

$script:Phase = 0
$script:Log = [System.Collections.ArrayList]::new()
$script:SmokeProcess = $null
$script:Mutex = $null
$script:MutexHeld = $false
$script:PreviousSlot = $null
$script:SwitchedToTarget = $false

# --- Helpers -----------------------------------------------------------------

function Write-Phase([string]$Title) {
    $script:Phase++
    $line = "[{0,2}] {1}" -f $script:Phase, $Title
    Write-Host ""
    Write-Host $line -ForegroundColor Cyan
    [void]$script:Log.Add($line)
}

function Write-Step([string]$Message, [string]$Status = "") {
    $text = if ($Status) { "     {0,-52} {1}" -f $Message, $Status } else { "     $Message" }
    Write-Host $text
    [void]$script:Log.Add($text.TrimEnd())
}

function Write-Fail([string]$Message) {
    Write-Host "     $Message" -ForegroundColor Red
    [void]$script:Log.Add("FAIL: $Message")
}

function Get-HttpStatus([string]$Url, [int]$TimeoutSec = 15) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -MaximumRedirection 0 -ErrorAction Stop
        return [int]$r.StatusCode
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode
        }
        return 0
    }
}

# PM2 state is read through a Node helper: PowerShell 5.1's ConvertFrom-Json is
# case-insensitive about keys and throws on `pm2 jlist`, because a Windows
# process environment contains both `username` and `USERNAME`.
function Get-Pm2Portfolio {
    $lines = & node (Join-Path $PSScriptRoot "pm2-status.mjs") 2>$null
    if (-not $lines) { return $null }
    $map = @{}
    foreach ($line in $lines) {
        $i = $line.IndexOf("=")
        if ($i -gt 0) { $map[$line.Substring(0, $i)] = $line.Substring($i + 1) }
    }
    if ($map["exists"] -ne "yes") { return $null }
    return $map
}

function Get-ActiveSlot {
    $p = Get-Pm2Portfolio
    if (-not $p) { return $null }
    $slot = $p["slot"]
    if ([string]::IsNullOrWhiteSpace($slot)) { return $LegacySlot }
    return $slot.Trim()
}

# PM2 --update-env re-reads this shell's environment into the managed process.
# Strip tooling variables first so they cannot leak into a long-lived
# production process, as happened during the first deployment.
function Remove-ToolingEnv {
    $removed = @()
    foreach ($v in Get-ChildItem Env: | Where-Object { $_.Name -like "CLAUDE*" }) {
        Remove-Item "Env:$($v.Name)" -ErrorAction SilentlyContinue
        $removed += $v.Name
    }
    return $removed
}

function Start-SmokeServer([string]$Slot, [int]$Port) {
    $env:PORTFOLIO_DIST_DIR = $Slot
    $env:NODE_ENV = "production"
    $exe  = "C:\Program Files\nodejs\node.exe"
    $args = @("node_modules/next/dist/bin/next", "start", "-p", "$Port", "-H", "127.0.0.1")
    return Start-Process -FilePath $exe -ArgumentList $args -WorkingDirectory $RepoRoot `
        -WindowStyle Hidden -PassThru
}

function Stop-SmokeServer {
    if ($script:SmokeProcess -and -not $script:SmokeProcess.HasExited) {
        try { Stop-Process -Id $script:SmokeProcess.Id -Force -ErrorAction Stop } catch {}
    }
    $script:SmokeProcess = $null
}

function Set-ProductionSlot([string]$Slot) {
    Remove-ToolingEnv | Out-Null
    $env:PORTFOLIO_DIST_DIR = $Slot
    $env:NODE_ENV = "production"
    & pm2 startOrRestart $Pm2Config --update-env 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pm2 startOrRestart failed for slot $Slot" }
}

# The legacy process predates this system and has no PORTFOLIO_DIST_DIR, so it
# cannot be restored through the ecosystem file (which refuses `.next`). Only
# reachable if the very first migration fails its health check.
function Restore-LegacyProduction {
    Remove-ToolingEnv | Out-Null
    Remove-Item Env:PORTFOLIO_DIST_DIR -ErrorAction SilentlyContinue
    $env:NODE_ENV = "production"
    & pm2 delete portfolio 2>&1 | Out-Null
    & pm2 start "node_modules/next/dist/bin/next" --name portfolio `
        --interpreter "C:/Program Files/nodejs/node.exe" `
        --cwd $RepoRoot -- start -p $ProdPort -H 127.0.0.1 2>&1 | Out-Null
}

function Test-PublicHealth([int]$Attempts = 10, [int]$DelayMs = 800) {
    for ($i = 1; $i -le $Attempts; $i++) {
        $code = Get-HttpStatus $PublicUrl 12
        if ($code -eq 200) {
            $html = ""
            try { $html = (Invoke-WebRequest -Uri $PublicUrl -UseBasicParsing -TimeoutSec 12).Content } catch {}
            $css = ([regex]::Match($html, '/_next/static/[^"]*\.css')).Value
            $js  = ([regex]::Match($html, '/_next/static/[^"]*\.js')).Value
            $cssCode = if ($css) { Get-HttpStatus "$PublicUrl$css" 12 } else { 0 }
            $jsCode  = if ($js)  { Get-HttpStatus "$PublicUrl$js" 12 }  else { 0 }
            if ($cssCode -eq 200 -and $jsCode -eq 200) {
                Write-Step "attempt $i : page 200, css 200, js 200" "OK"
                return $true
            }
            Write-Step "attempt $i : page 200 but css=$cssCode js=$jsCode" "retry"
        } else {
            Write-Step "attempt $i : page $code" "retry"
        }
        Start-Sleep -Milliseconds $DelayMs
    }
    return $false
}

# --- Deployment --------------------------------------------------------------

$started = Get-Date
$deployOk = $false
$rolledBack = $false

try {
    # Only one deployment may run at a time: two concurrent runs could pick the
    # same "inactive" slot and build over each other.
    $script:Mutex = New-Object System.Threading.Mutex($false, $MutexName)
    if (-not $script:Mutex.WaitOne(0)) {
        Write-Host "ABORT: another safe deployment is already running." -ForegroundColor Red
        exit 2
    }
    $script:MutexHeld = $true

    Set-Location $RepoRoot

    # ---- 1. Preflight -------------------------------------------------------
    Write-Phase "Preflight"
    $node = (& node -v) 2>$null
    $npm  = (& npm -v) 2>$null
    $pm2v = (& pm2 -v) 2>$null
    Write-Step "node $node / npm $npm / pm2 $pm2v" "OK"

    $portfolio = Get-Pm2Portfolio
    if (-not $portfolio) { throw "PM2 process 'portfolio' not found." }
    Write-Step "pm2 portfolio process present (status $($portfolio['status']))" "OK"

    $dirty = (& git status --porcelain) | Where-Object { $_ }
    if ($dirty) {
        Write-Step "git working tree: DIRTY ($($dirty.Count) entries)" $(if ($AllowDirtyTree) { "allowed" } else { "ABORT" })
        if (-not $AllowDirtyTree) {
            throw "Working tree is dirty. Review the changes, then re-run with -AllowDirtyTree if intended."
        }
    } else {
        Write-Step "git working tree: clean" "OK"
    }

    $prodListening = Get-NetTCPConnection -State Listen -LocalPort $ProdPort -ErrorAction SilentlyContinue
    Write-Step "production port $ProdPort listening" $(if ($prodListening) { "OK" } else { "NOT LISTENING" })

    $publicBefore = Get-HttpStatus $PublicUrl
    Write-Step "public site before deployment: $publicBefore" $(if ($publicBefore -eq 200) { "OK" } else { "WARN" })

    # ---- 2/3. Determine active slot, select the inactive one -----------------
    Write-Phase "Determine release slots"
    $active = Get-ActiveSlot
    if (-not $active) { throw "Could not determine the active release slot from PM2." }

    switch ($active) {
        $SlotA      { $target = $SlotB }
        $SlotB      { $target = $SlotA }
        $LegacySlot { $target = $SlotA }
        default     { throw "Unexpected active slot '$active'." }
    }

    Write-Step "ACTIVE RELEASE : $active$(if ($active -eq $LegacySlot) { '   (legacy - first migration)' })"
    Write-Step "TARGET RELEASE : $target"

    # Hard safety check: never build into the directory production is reading.
    if ($target -eq $active) {
        throw "Refusing to deploy: target slot equals the active slot ($target)."
    }
    if ($target -notin @($SlotA, $SlotB)) {
        throw "Refusing to deploy: computed target '$target' is not a release slot."
    }

    # ---- 4. Clean the inactive slot only ------------------------------------
    Write-Phase "Clean inactive slot"
    $targetPath = Join-Path $RepoRoot $target
    if (Test-Path $targetPath) {
        Remove-Item -Recurse -Force $targetPath
        Write-Step "removed previous contents of $target" "OK"
    } else {
        Write-Step "$target did not exist" "OK"
    }
    Write-Step "untouched: $active (active) and $LegacySlot (development)" "OK"

    # ---- 5/6. Validation ----------------------------------------------------
    Write-Phase "Validate before building"
    & npm run qa:memory 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "qa:memory failed." }
    Write-Step "npm run qa:memory" "PASS"

    & npx tsc --noEmit 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "TypeScript check failed." }
    Write-Step "npx tsc --noEmit" "PASS"

    & npx eslint src 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "ESLint failed." }
    Write-Step "npx eslint src" "PASS"

    # ---- 7. Build the inactive slot -----------------------------------------
    Write-Phase "Build target slot ($target)"
    $env:PORTFOLIO_DIST_DIR = $target
    $buildStart = Get-Date
    & npm run build 2>&1 | Out-Null
    $buildCode = $LASTEXITCODE
    Remove-Item Env:PORTFOLIO_DIST_DIR -ErrorAction SilentlyContinue
    if ($buildCode -ne 0) { throw "Build into $target failed." }
    Write-Step "build completed in $([int]((Get-Date) - $buildStart).TotalSeconds)s" "PASS"

    # The live site must be unaffected: it is reading a different directory.
    $duringBuild = Get-HttpStatus $PublicUrl
    Write-Step "public site during/after build: $duringBuild" $(if ($duringBuild -eq 200) { "OK" } else { "WARN" })

    # ---- 8. Verify build output ---------------------------------------------
    Write-Phase "Verify build output"
    $buildId = Join-Path $targetPath "BUILD_ID"
    if (-not (Test-Path $buildId)) { throw "$target/BUILD_ID missing - build output incomplete." }
    Write-Step "BUILD_ID present ($(Get-Content $buildId -Raw).Trim())" "OK"
    foreach ($artefact in @("server", "static")) {
        $p = Join-Path $targetPath $artefact
        if (-not (Test-Path $p)) { throw "$target/$artefact missing." }
        Write-Step "$artefact/ present" "OK"
    }
    $chunkCount = (Get-ChildItem (Join-Path $targetPath "static") -Recurse -File -ErrorAction SilentlyContinue).Count
    Write-Step "static files: $chunkCount" $(if ($chunkCount -gt 0) { "OK" } else { "EMPTY" })
    if ($chunkCount -le 0) { throw "No static assets produced in $target." }

    # ---- 9/10. Smoke test on a temporary loopback port ----------------------
    Write-Phase "Smoke test new release"
    $smokePort = $null
    foreach ($p in $SmokePorts) {
        if (-not (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue)) { $smokePort = $p; break }
    }
    if (-not $smokePort) { throw "No free smoke port among $($SmokePorts -join ', ')." }
    Write-Step "temporary port: 127.0.0.1:$smokePort (loopback only)" "OK"

    $script:SmokeProcess = Start-SmokeServer -Slot $target -Port $smokePort
    Remove-Item Env:PORTFOLIO_DIST_DIR -ErrorAction SilentlyContinue

    $smokeBase = "http://127.0.0.1:$smokePort"
    $ready = $false
    for ($i = 1; $i -le 25; $i++) {
        Start-Sleep -Milliseconds 600
        if ((Get-HttpStatus "$smokeBase/" 8) -eq 200) { $ready = $true; break }
    }
    if (-not $ready) { throw "Smoke server did not become ready on port $smokePort." }
    Write-Step "smoke server ready" "OK"

    $smokeHtml = (Invoke-WebRequest -Uri "$smokeBase/" -UseBasicParsing -TimeoutSec 15).Content
    $smokeAssets = @{}
    $smokeAssets["css"]  = ([regex]::Match($smokeHtml, '/_next/static/[^"]*\.css')).Value
    $smokeAssets["js"]   = ([regex]::Match($smokeHtml, '/_next/static/[^"]*\.js')).Value
    $smokeAssets["font sans"] = ([regex]::Match($smokeHtml, '/_next/static/media/Geist_Variable[^"]*\.woff2')).Value
    $smokeAssets["font mono"] = ([regex]::Match($smokeHtml, '/_next/static/media/GeistMono_Variable[^"]*\.woff2')).Value
    $smokeAssets["portfolio mark"] = "/brand/logo-96.png"
    $smokeAssets["micro grain"] = "/textures/micro-grain.svg"

    $smokeFailed = @()
    foreach ($k in $smokeAssets.Keys) {
        $path = $smokeAssets[$k]
        if (-not $path) { $smokeFailed += "$k (not referenced)"; continue }
        $code = Get-HttpStatus "$smokeBase$path" 12
        Write-Step "$k -> $code" $(if ($code -eq 200) { "OK" } else { "FAIL" })
        if ($code -ne 200) { $smokeFailed += "$k=$code" }
    }
    # Section markers. Each built section is asserted here, so a release that
    # compiles but renders a section-less page cannot reach production.
    # id="products" alone is NOT sufficient: before Stage 06 the same id was
    # emitted by the navigation placeholder, so the heading is what actually
    # distinguishes the built section from the placeholder.
    if ($smokeHtml -notmatch 'id="systems"') { $smokeFailed += "#systems section missing from HTML" }
    else { Write-Step "#systems section present in rendered HTML" "OK" }

    if ($smokeHtml -notmatch 'id="products"') { $smokeFailed += "#products section missing from HTML" }
    else { Write-Step "#products section present in rendered HTML" "OK" }

    if ($smokeHtml -notmatch 'One product\. Every surface\.') { $smokeFailed += "Stage 06 heading missing from HTML" }
    else { Write-Step "Stage 06 heading present in rendered HTML" "OK" }

    if ($smokeHtml -notmatch 'id="ai-learning"') { $smokeFailed += "#ai-learning section missing from HTML" }
    else { Write-Step "#ai-learning section present in rendered HTML" "OK" }

    if ($smokeHtml -notmatch 'Learning paths that adapt\.') { $smokeFailed += "Stage 07 heading missing from HTML" }
    else { Write-Step "Stage 07 heading present in rendered HTML" "OK" }

    if ($smokeHtml -notmatch 'id="lab"') { $smokeFailed += "#lab section missing from HTML" }
    else { Write-Step "#lab section present in rendered HTML" "OK" }

    if ($smokeHtml -notmatch 'Small systems\. Serious engineering\.') { $smokeFailed += "Stage 08 heading missing from HTML" }
    else { Write-Step "Stage 08 heading present in rendered HTML" "OK" }

    if ($smokeFailed.Count -gt 0) { throw "Smoke test failed: $($smokeFailed -join '; ')" }

    Stop-SmokeServer
    Start-Sleep -Milliseconds 800
    $stillUp = Get-NetTCPConnection -State Listen -LocalPort $smokePort -ErrorAction SilentlyContinue
    Write-Step "smoke server stopped, port $smokePort released" $(if ($stillUp) { "STILL BOUND" } else { "OK" })

    # ---- 11. Switch production ----------------------------------------------
    Write-Phase "Switch production to $target"
    $script:PreviousSlot = $active
    $removed = Remove-ToolingEnv
    if ($removed.Count -gt 0) { Write-Step "stripped tooling variables before pm2: $($removed -join ', ')" "OK" }

    $switchStart = Get-Date
    Set-ProductionSlot -Slot $target
    $script:SwitchedToTarget = $true

    # Downtime is the window until the new process answers on 3100.
    $localUp = $false
    for ($i = 1; $i -le 40; $i++) {
        if ((Get-HttpStatus "http://127.0.0.1:$ProdPort/" 6) -eq 200) { $localUp = $true; break }
        Start-Sleep -Milliseconds 250
    }
    $downtimeMs = [int]((Get-Date) - $switchStart).TotalMilliseconds
    Write-Step "production answered on 127.0.0.1:$ProdPort after ${downtimeMs}ms" $(if ($localUp) { "OK" } else { "FAIL" })
    if (-not $localUp) { throw "New release did not start listening on $ProdPort." }

    $nowActive = Get-ActiveSlot
    Write-Step "PM2 PORTFOLIO_DIST_DIR now: $nowActive" $(if ($nowActive -eq $target) { "OK" } else { "MISMATCH" })

    # ---- 12. Public health check --------------------------------------------
    Write-Phase "Public health check"
    if ($FailAfterSwitchForTest) {
        Write-Step "-FailAfterSwitchForTest set: forcing health check failure" "TEST"
        $healthy = $false
    } else {
        $healthy = Test-PublicHealth -Attempts 10 -DelayMs 800
    }

    if (-not $healthy) {
        # ---- 13. Automatic rollback -----------------------------------------
        Write-Phase "Health check FAILED - rolling back to $($script:PreviousSlot)"
        if ($script:PreviousSlot -eq $LegacySlot) {
            Restore-LegacyProduction
        } else {
            Set-ProductionSlot -Slot $script:PreviousSlot
        }
        $rolledBack = $true

        $restored = $false
        for ($i = 1; $i -le 20; $i++) {
            if ((Get-HttpStatus "http://127.0.0.1:$ProdPort/" 6) -eq 200) { $restored = $true; break }
            Start-Sleep -Milliseconds 400
        }
        Write-Step "rollback: production listening again" $(if ($restored) { "OK" } else { "FAIL" })
        $publicAfter = Test-PublicHealth -Attempts 10 -DelayMs 800
        Write-Step "rollback: public site healthy" $(if ($publicAfter) { "OK" } else { "FAIL" })
        Write-Step "PM2 slot after rollback: $(Get-ActiveSlot)"

        # Persist the restored state so a reboot resurrects the working release.
        & pm2 save 2>&1 | Out-Null
        Write-Step "pm2 save (restored state persisted)" "OK"

        throw "DEPLOYMENT FAILED - ROLLED BACK to $($script:PreviousSlot)"
    }

    # ---- 14. Persist only after success -------------------------------------
    Write-Phase "Persist PM2 state"
    & pm2 save 2>&1 | Out-Null
    Write-Step "pm2 save" "OK"

    # ---- 15. Final verification ---------------------------------------------
    Write-Phase "Final verification"
    $final = Get-Pm2Portfolio
    Write-Step "pm2 status: $($final['status']), restarts $($final['restarts'])" "OK"
    Write-Step "active slot: $(Get-ActiveSlot)" "OK"
    Write-Step "previous slot retained for rollback: $($script:PreviousSlot)" "OK"
    Write-Step "public site: $(Get-HttpStatus $PublicUrl)" "OK"
    $deployOk = $true
}
catch {
    Write-Host ""
    if ($rolledBack) {
        Write-Host "DEPLOYMENT FAILED - ROLLED BACK" -ForegroundColor Red
    } else {
        Write-Host "DEPLOYMENT ABORTED" -ForegroundColor Red
        Write-Host "  production was not switched; the active release is untouched." -ForegroundColor Yellow
    }
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    [void]$script:Log.Add("ERROR: $($_.Exception.Message)")
}
finally {
    # Always clean up, including on Ctrl+C or an unexpected exception.
    Stop-SmokeServer
    Remove-Item Env:PORTFOLIO_DIST_DIR -ErrorAction SilentlyContinue

    $duration = [int]((Get-Date) - $started).TotalSeconds
    $summary = if ($deployOk) { "SUCCESS" } elseif ($rolledBack) { "FAILED-ROLLED-BACK" } else { "ABORTED" }

    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    $stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
    $logPath = Join-Path $LogDir "deploy-$stamp-$summary.log"
    @(
        "timestamp     : $((Get-Date).ToString('o'))"
        "result        : $summary"
        "previous slot : $($script:PreviousSlot)"
        "duration      : ${duration}s"
        ""
    ) + $script:Log | Set-Content -Path $logPath -Encoding utf8

    Write-Host ""
    Write-Host ("{0}  ({1}s)  log: {2}" -f $summary, $duration, (Resolve-Path $logPath).Path) `
        -ForegroundColor $(if ($deployOk) { "Green" } else { "Red" })

    if ($script:MutexHeld) { $script:Mutex.ReleaseMutex() }
    if ($script:Mutex) { $script:Mutex.Dispose() }
}

exit $(if ($deployOk) { 0 } else { 1 })
