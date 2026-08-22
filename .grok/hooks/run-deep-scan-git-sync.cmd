@echo off
REM Launch the deep-scan hook without ${VAR} in the Grok command string.
REM On Windows, Grok runs hooks through PowerShell, which expands
REM ${CLAUDE_PROJECT_DIR} as an empty session variable and then calls
REM -File "/.grok/hooks/bin/deep-scan-git-sync.ps1".
REM %~dp0 is this folder even when the workspace path has spaces.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0bin\deep-scan-git-sync.ps1"
exit /b %ERRORLEVEL%
