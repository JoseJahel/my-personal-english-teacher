#Requires -Version 5.1
<#
.SYNOPSIS
  UserPromptSubmit hook: when the user asks for a deep project/git scan,
  fetch origin/main, refresh local main, and update the current branch to match.

.NOTES
  Trigger phrase (flexible match):
    "escanea el proyecto" + "historial de git"  (and/or "a fondo")
  Fail-open: any unexpected error exits 0 so the agent still runs.
  Invoked via ../run-deep-scan-git-sync.cmd — do not put ${CLAUDE_PROJECT_DIR}
  in the hook JSON command (PowerShell on Windows expands it to empty).
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-HookContext {
  param([string]$Message)
  $payload = @{
    hookSpecificOutput = @{
      hookEventName     = 'UserPromptSubmit'
      additionalContext = $Message
    }
  } | ConvertTo-Json -Compress -Depth 6
  Write-Output $payload
}

function Get-PromptText {
  param([string]$Raw)
  if ([string]::IsNullOrWhiteSpace($Raw)) { return '' }
  try {
    $json = $Raw | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return $Raw
  }
  # Grok camelCase and Claude snake_case
  foreach ($key in @('prompt', 'userPrompt', 'user_prompt', 'message', 'text')) {
    if ($null -ne $json.$key -and "$($json.$key)".Trim().Length -gt 0) {
      return [string]$json.$key
    }
  }
  if ($json.toolInput -and $json.toolInput.prompt) {
    return [string]$json.toolInput.prompt
  }
  return ''
}

function Test-IsDeepScanPrompt {
  param([string]$Prompt)
  $p = $Prompt.ToLowerInvariant()
  # Primary trigger (user's exact workflow phrase, flexible)
  $hasEscanea = $p -match 'escanea\s+el\s+proyecto'
  $hasHistorial = $p -match 'historial\s+de\s+git'
  $hasAFondo = $p -match 'a\s+fondo'
  if ($hasEscanea -and $hasHistorial) { return $true }
  if ($hasEscanea -and $hasAFondo) { return $true }
  # English aliases
  if ($p -match 'scan\s+(the\s+)?project' -and $p -match 'git\s+history') { return $true }
  if ($p -match 'deep\s+scan' -and ($p -match 'git' -or $p -match 'project')) { return $true }
  return $false
}

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & git @GitArgs 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  return [pscustomobject]@{
    Code   = $code
    Output = ($output | ForEach-Object { "$_" }) -join "`n"
  }
}

# --- main ---
try {
  $raw = [Console]::In.ReadToEnd()
  $prompt = Get-PromptText -Raw $raw

  if (-not (Test-IsDeepScanPrompt -Prompt $prompt)) {
    exit 0
  }

  $root = if ($env:GROK_WORKSPACE_ROOT) {
    $env:GROK_WORKSPACE_ROOT
  } elseif ($env:CLAUDE_PROJECT_DIR) {
    $env:CLAUDE_PROJECT_DIR
  } else {
    (Get-Location).Path
  }

  if (-not (Test-Path (Join-Path $root '.git'))) {
    Write-HookContext "Deep-scan git sync skipped: no .git in workspace ($root)."
    exit 0
  }

  Set-Location -LiteralPath $root

  $stateDir = Join-Path $root '.grok/hooks/state'
  if (-not (Test-Path $stateDir)) {
    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  }
  $stateFile = Join-Path $stateDir 'last-deep-scan-sync.txt'
  $log = New-Object System.Collections.Generic.List[string]
  $log.Add("=== deep-scan git sync $(Get-Date -Format o) ===")
  $log.Add("cwd=$root")

  $branchResult = Invoke-Git rev-parse --abbrev-ref HEAD
  if ($branchResult.Code -ne 0) {
    Write-HookContext "Deep-scan git sync failed: could not read current branch."
    exit 0
  }
  $branch = $branchResult.Output.Trim()
  $log.Add("branch=$branch")

  # Refuse to clobber uncommitted work
  $statusResult = Invoke-Git status --porcelain
  if ($statusResult.Code -ne 0) {
    Write-HookContext "Deep-scan git sync failed: git status error."
    exit 0
  }
  # Ignore hook runtime logs (gitignored) if they still show up in status
  $dirtyLines = @()
  if (-not [string]::IsNullOrWhiteSpace($statusResult.Output)) {
    $dirtyLines = @(
      $statusResult.Output -split "`n" |
        ForEach-Object { $_.TrimEnd() } |
        Where-Object {
          $_ -and
          ($_ -notmatch '\.grok[\\/]hooks[\\/]state') -and
          ($_ -notmatch 'last-deep-scan-sync\.txt')
        }
    )
  }
  if ($dirtyLines.Count -gt 0) {
    $msg = @(
      "Deep-scan git sync SKIPPED: working tree is dirty on '$branch'.",
      'Commit or stash local changes, then resend the scan prompt.',
      'Uncommitted files present; branch was NOT reset to main.'
    ) -join "`n"
    $log.Add('status=dirty-abort')
    $log.Add(($dirtyLines -join "`n"))
    $log -join "`n" | Set-Content -LiteralPath $stateFile -Encoding utf8
    Write-HookContext $msg
    exit 0
  }

  # Abort an in-progress merge/rebase that would block sync
  if (Test-Path (Join-Path $root '.git/MERGE_HEAD')) {
    $null = Invoke-Git merge --abort
    $log.Add('aborted-stale-merge=yes')
  }
  if (Test-Path (Join-Path $root '.git/rebase-merge')) {
    $null = Invoke-Git rebase --abort
    $log.Add('aborted-stale-rebase=yes')
  }

  $fetch = Invoke-Git fetch origin --prune
  $log.Add("fetch_exit=$($fetch.Code)")
  if ($fetch.Code -ne 0) {
    $msg = "Deep-scan git sync FAILED on fetch: $($fetch.Output)"
    $log.Add($msg)
    $log -join "`n" | Set-Content -LiteralPath $stateFile -Encoding utf8
    Write-HookContext $msg
    exit 0
  }

  # Ensure origin/main exists
  $hasMain = Invoke-Git rev-parse --verify origin/main
  if ($hasMain.Code -ne 0) {
    $msg = 'Deep-scan git sync FAILED: origin/main not found after fetch.'
    $log.Add($msg)
    $log -join "`n" | Set-Content -LiteralPath $stateFile -Encoding utf8
    Write-HookContext $msg
    exit 0
  }

  # Refresh local main to origin/main without checking it out (when not on main)
  if ($branch -eq 'main') {
    $pull = Invoke-Git pull --ff-only origin main
    $log.Add("main_pull_exit=$($pull.Code)")
    if ($pull.Code -ne 0) {
      # Fall back to hard reset only on clean main
      $resetMain = Invoke-Git reset --hard origin/main
      $log.Add("main_hard_reset_exit=$($resetMain.Code)")
    }
  } else {
    # Move local main pointer to origin/main
    $forceMain = Invoke-Git branch -f main origin/main
    $log.Add("main_force_update_exit=$($forceMain.Code)")
    if ($forceMain.Code -ne 0) {
      # Create main if missing
      $createMain = Invoke-Git branch main origin/main
      $log.Add("main_create_exit=$($createMain.Code)")
    }
  }

  $mainSha = (Invoke-Git rev-parse origin/main).Output.Trim()
  $log.Add("origin_main=$mainSha")

  # Align current branch to main's tree
  if ($branch -eq 'main') {
    $log.Add('branch_action=already-main-updated')
  } else {
    $headSha = (Invoke-Git rev-parse HEAD).Output.Trim()
    if ($headSha -eq $mainSha) {
      $log.Add('branch_action=already-equal-to-origin-main')
    } else {
      # Prefer a merge commit that brings main in; take main on conflicts.
      $merge = Invoke-Git merge origin/main --no-edit -X theirs -m "merge(main): auto-sync before deep project/git scan"
      $log.Add("merge_exit=$($merge.Code)")
      $log.Add("merge_out=$($merge.Output)")

      if ($merge.Code -ne 0) {
        # Resolve remaining conflicts to main and finish
        $unmerged = Invoke-Git diff --name-only --diff-filter=U
        if (-not [string]::IsNullOrWhiteSpace($unmerged.Output)) {
          foreach ($file in ($unmerged.Output -split "`n")) {
            $f = $file.Trim()
            if ($f.Length -eq 0) { continue }
            $null = Invoke-Git checkout --theirs -- $f
            $null = Invoke-Git add -- $f
          }
          $finish = Invoke-Git commit --no-edit -m "merge(main): auto-sync before deep project/git scan"
          $log.Add("conflict_finish_exit=$($finish.Code)")
        } else {
          # Last resort: hard align to main (user asked for branch = main state)
          $hard = Invoke-Git reset --hard origin/main
          $log.Add("hard_reset_exit=$($hard.Code)")
          $log.Add("hard_reset_out=$($hard.Output)")
        }
      }
    }
  }

  $finalSha = (Invoke-Git rev-parse HEAD).Output.Trim()
  $finalBranch = (Invoke-Git rev-parse --abbrev-ref HEAD).Output.Trim()
  $behindAhead = Invoke-Git rev-list --left-right --count HEAD...origin/main
  # Tree equality (PowerShell-safe: avoid ^{tree} brace expansion issues)
  $ht = (Invoke-Git rev-parse HEAD).Output.Trim()
  $mt = $mainSha
  $treeMatch = if ($ht -eq $mt) {
    'yes'
  } else {
    $treeHead = (& git log -1 --format=%T HEAD 2>$null)
    $treeMain = (& git log -1 --format=%T origin/main 2>$null)
    if ("$treeHead".Trim() -eq "$treeMain".Trim() -and "$treeHead".Trim().Length -gt 0) {
      'tree-yes'
    } else {
      'no'
    }
  }

  $lr = $behindAhead.Output.Trim() -replace '\s+', ' / '
  $summary = @"
Deep-scan git sync COMPLETED before analysis.
- Branch: $finalBranch @ $finalSha
- origin/main: $mainSha (local main refreshed)
- Branch is not behind main (ahead/behind vs origin/main: $lr)
- Content equal to main tip: $treeMatch (tree-yes/yes = same files as main; no = branch has extra commits, e.g. local hooks)

Continue the deep project + git history scan on this updated tree.
State log: .grok/hooks/state/last-deep-scan-sync.txt
"@

  $log.Add("final_branch=$finalBranch")
  $log.Add("final_sha=$finalSha")
  $log.Add("tree_match=$treeMatch")
  $log.Add('status=ok')
  $log -join "`n" | Set-Content -LiteralPath $stateFile -Encoding utf8
  Write-HookContext $summary.Trim()
  exit 0
} catch {
  $err = "Deep-scan git sync error (fail-open): $($_.Exception.Message)"
  try {
    Write-HookContext $err
  } catch {
    Write-Output $err
  }
  exit 0
}
