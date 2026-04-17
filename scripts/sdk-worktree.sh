#!/usr/bin/env bash
#
# sdk-worktree.sh — manage SDK repos as bare-clone + git worktrees.
#
# Layout produced:
#   .git-bare/<sdk>.git/              bare clone, shared once
#   packages/<sdk>/                   worktree of the default branch
#   packages/<sdk>-<branch>/          additional worktrees (feature branches)
#
# Usage:
#   scripts/sdk-worktree.sh init <sdk-name> <git-url>
#   scripts/sdk-worktree.sh add  <sdk-name> <branch>
#   scripts/sdk-worktree.sh list <sdk-name>
#   scripts/sdk-worktree.sh convert <sdk-name>   # migrate a normal clone
#
# The script is idempotent: re-running `init` on an already-initialised
# sdk is a no-op (it just fetches new refs).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BARE_DIR="$ROOT_DIR/.git-bare"
WORKTREES_DIR="$ROOT_DIR/packages"

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RESET="\033[0m"

log()   { printf "${CYAN}>${RESET} %s\n" "$*"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}!${RESET} %s\n" "$*"; }
die()   { printf "${RED}✗${RESET} %s\n" "$*" >&2; exit 1; }

require_name() {
    [[ -n "${1:-}" ]] || die "sdk name is required (e.g. sdk-symfony)"
}

cmd_init() {
    local name="$1"; shift || true
    local url="${1:-}"
    require_name "$name"
    [[ -n "$url" ]] || die "git url required: $(basename "$0") init $name <url>"

    local bare="$BARE_DIR/${name}.git"
    local wt="$WORKTREES_DIR/$name"

    mkdir -p "$BARE_DIR" "$WORKTREES_DIR"

    if [[ -d "$bare" ]]; then
        log "bare clone already exists at $bare — fetching"
        git --git-dir="$bare" fetch --all --prune
    else
        log "cloning $url as bare into $bare"
        git clone --bare "$url" "$bare"
        git --git-dir="$bare" config --add remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
        git --git-dir="$bare" fetch --all --prune
    fi

    if [[ -d "$wt" ]]; then
        # Already a worktree? If yes, nothing to do.
        if git --git-dir="$bare" worktree list --porcelain | grep -q "worktree $wt"; then
            ok "worktree already registered at $wt"
            return 0
        fi
        die "$wt exists but is not registered as a worktree — run '$(basename "$0") convert $name' first"
    fi

    local default_branch
    default_branch="$(git --git-dir="$bare" symbolic-ref --short HEAD 2>/dev/null || echo main)"
    log "adding worktree for branch '$default_branch' at $wt"
    git --git-dir="$bare" worktree add "$wt" "$default_branch"
    ok "worktree ready at $wt"
}

cmd_add() {
    local name="$1"; shift || true
    local branch="${1:-}"
    require_name "$name"
    [[ -n "$branch" ]] || die "branch required: $(basename "$0") add $name <branch>"

    local bare="$BARE_DIR/${name}.git"
    [[ -d "$bare" ]] || die "no bare clone for $name — run 'init' first"

    local wt="$WORKTREES_DIR/${name}-${branch//\//-}"
    if [[ -d "$wt" ]]; then
        warn "worktree already exists at $wt"
        return 0
    fi

    # Create the branch locally if missing, tracking origin/<branch> if present.
    if git --git-dir="$bare" show-ref --verify --quiet "refs/heads/$branch"; then
        log "using existing local branch $branch"
        git --git-dir="$bare" worktree add "$wt" "$branch"
    elif git --git-dir="$bare" show-ref --verify --quiet "refs/remotes/origin/$branch"; then
        log "creating local tracking branch $branch from origin/$branch"
        git --git-dir="$bare" worktree add -b "$branch" "$wt" "origin/$branch"
    else
        log "branching $branch off HEAD (new feature branch)"
        git --git-dir="$bare" worktree add -b "$branch" "$wt"
    fi
    ok "worktree ready at $wt"
}

cmd_list() {
    local name="$1"
    require_name "$name"
    local bare="$BARE_DIR/${name}.git"
    [[ -d "$bare" ]] || die "no bare clone for $name"
    git --git-dir="$bare" worktree list
}

# Migrate an existing normal clone at packages/<name>/ into a worktree of
# a new bare clone, preserving uncommitted work as a stashed snapshot.
cmd_convert() {
    local name="$1"
    require_name "$name"

    local wt="$WORKTREES_DIR/$name"
    [[ -d "$wt/.git" ]] || die "$wt is not a git clone (or already a worktree)"

    # Inside a worktree .git is a FILE, not a directory; skip if so.
    if [[ ! -d "$wt/.git" ]]; then
        ok "$wt already looks like a worktree — nothing to do"
        return 0
    fi

    local url
    url="$(git -C "$wt" remote get-url origin 2>/dev/null || true)"
    [[ -n "$url" ]] || die "no 'origin' remote in $wt — cannot auto-convert"

    log "detected remote: $url"
    log "stashing uncommitted changes (if any)"
    (cd "$wt" && git stash push --include-untracked -m "pre-worktree-migration-$(date +%s)" || true)

    local current_branch
    current_branch="$(git -C "$wt" rev-parse --abbrev-ref HEAD)"
    log "current branch: $current_branch"

    # Preserve potentially unpushed commits by creating a patch bundle.
    local backup="$wt/../${name}-pre-worktree-backup.bundle"
    log "creating safety bundle at $backup"
    (cd "$wt" && git bundle create "$backup" --all 2>/dev/null || warn "bundle creation failed — proceeding")

    log "moving $wt aside"
    local stash_dir
    stash_dir="$(mktemp -d)/$name"
    mkdir -p "$(dirname "$stash_dir")"
    mv "$wt" "$stash_dir"

    cmd_init "$name" "$url"

    # Fetch from the local backup bundle if it has new commits.
    if [[ -f "$backup" ]]; then
        log "fetching backup bundle into bare clone"
        git --git-dir="$BARE_DIR/${name}.git" fetch "$backup" "+refs/*:refs/backup/*" 2>/dev/null || true
    fi

    # Restore the stashed changes by copying non-git content back on top.
    if [[ -d "$stash_dir" ]]; then
        log "restoring uncommitted files from backup"
        # Use rsync when available for a faster partial copy; fall back to cp.
        if command -v rsync >/dev/null 2>&1; then
            rsync -a --exclude='.git' "$stash_dir/" "$wt/"
        else
            (cd "$stash_dir" && tar --exclude='.git' -cf - .) | (cd "$wt" && tar -xf -)
        fi
    fi

    ok "conversion complete. Backup bundle kept at $backup (delete when safe)"
    warn "branch was '$current_branch' — checkout manually if needed: git -C $wt switch $current_branch"
}

usage() {
    cat <<EOF
sdk-worktree — manage SDK repos as bare-clone + git worktrees.

Commands:
  init <name> <url>       Create the bare clone and a worktree on the default branch.
  add  <name> <branch>    Add another worktree for <branch>.
  list <name>             List worktrees of <name>.
  convert <name>          Migrate an existing normal clone at packages/<name>/ to the worktree layout.

Layout:
  .git-bare/<name>.git    shared bare clone
  packages/<name>/        worktree of the default branch
  packages/<name>-<br>/   additional worktrees for feature branches
EOF
}

main() {
    local cmd="${1:-}"; shift || true
    case "$cmd" in
        init)     cmd_init    "$@" ;;
        add)      cmd_add     "$@" ;;
        list)     cmd_list    "$@" ;;
        convert)  cmd_convert "$@" ;;
        ""|help|-h|--help) usage ;;
        *) die "unknown command: $cmd" ;;
    esac
}

main "$@"
