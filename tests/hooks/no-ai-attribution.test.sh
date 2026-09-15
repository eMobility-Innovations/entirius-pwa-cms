#!/usr/bin/env bash
# The guard must REJECT AI attribution, ACCEPT a clean message, and ACCEPT a
# real human co-author. Delete or neuter scripts/hooks/no-ai-attribution.sh and
# this goes red — which is the only thing that makes it a guard.
set -u
HOOK="$(cd "$(dirname "$0")/../.." && pwd)/scripts/hooks/no-ai-attribution.sh"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fail=0

accept() { printf '%s\n' "$2" > "$tmp/m"; bash "$HOOK" "$tmp/m" >/dev/null 2>&1 || { echo "FAIL: rejected $1"; fail=1; }; }
reject() { printf '%s\n' "$2" > "$tmp/m"; bash "$HOOK" "$tmp/m" >/dev/null 2>&1 && { echo "FAIL: accepted $1"; fail=1; }; }

accept "a clean message"       "$(printf 'feat: a thing\n\nA body that says what changed.')"
accept "a human co-author"     "$(printf 'feat: a thing\n\nCo-authored-by: A Colleague <person@example.com>')"
reject "the Claude trailer"    "$(printf 'feat: a thing\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>')"
reject "a lowercase trailer"   "$(printf 'feat: a thing\n\nco-authored-by: claude <x@y>')"
reject "the generated footer"  "$(printf 'feat: a thing\n\nGenerated with [Claude Code](https://claude.com/claude-code)')"
reject "the robot footer"      "$(printf 'feat: a thing\n\n🤖 Generated with Claude Code')"

[ "$fail" -eq 0 ] && echo "HOOK_GUARD_OK"
exit "$fail"
