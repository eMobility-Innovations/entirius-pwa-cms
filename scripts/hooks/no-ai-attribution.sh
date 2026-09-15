#!/usr/bin/env bash
# AGENTS.md: commit messages carry no Claude/Anthropic attribution — no
# Co-Authored-By trailer, no "Generated with Claude Code" footer. This is the
# enforcement, because the rule was stated in AGENTS.md and still broken three
# times in a row before a human noticed.
#
# It deliberately matches only Claude/Anthropic attribution. A real human
# Co-authored-by trailer is legitimate and must keep working.
set -u
msg="${1:?path to the commit message file expected}"

if grep -inE '^[[:space:]]*co-authored-by:[[:space:]]*(claude|anthropic)|generated with \[?claude code|^[[:space:]]*🤖' "$msg"; then
  echo
  echo "AGENTS.md forbids AI attribution in commit messages. Remove the line(s) above."
  exit 1
fi
