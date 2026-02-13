# Git

Clone repos, branch, commit, diff, and manage full Git workflows via bash.

## Setup

Configure identity before committing (required for new VMs):
```
bash: git config --global user.name "Agent"
bash: git config --global user.email "agent@localhost"
```

## Core Commands

### Clone and Initialize
```
bash: git clone https://github.com/user/repo.git project
bash: git clone --depth 1 https://github.com/user/repo.git project   # shallow clone, faster
bash: git init new-project
```

### Branching
```
bash: git branch                          # list local branches
bash: git branch feature-x               # create branch
bash: git checkout -b feature-x          # create and switch
bash: git switch feature-x               # switch to existing branch
bash: git branch -d feature-x            # delete merged branch
```

### Status and Diff
```
bash: git status                          # working tree status
bash: git diff                            # unstaged changes
bash: git diff --staged                   # staged changes
bash: git diff main..feature-x           # diff between branches
bash: git diff --stat                     # summary of changes
bash: git diff HEAD~3..HEAD              # last 3 commits
```

### Staging and Committing
```
bash: git add file.py                     # stage specific file
bash: git add src/                        # stage directory
bash: git add -A                          # stage all changes
bash: git commit -m "feat: add user auth"
bash: git commit -am "fix: handle null input"   # stage tracked + commit
```

### History
```
bash: git log --oneline -20              # last 20 commits, compact
bash: git log --oneline --graph          # visual branch history
bash: git log -p -1                      # last commit with full diff
bash: git log --author="name" --since="2 weeks ago"
bash: git show HEAD                      # details of last commit
bash: git blame file.py                  # line-by-line authorship
```

### Remote Operations
```
bash: git remote -v                      # list remotes
bash: git fetch origin                   # fetch without merge
bash: git pull origin main               # fetch + merge
bash: git push origin feature-x          # push branch
bash: git push -u origin feature-x       # push and set upstream
```

### Merging and Rebasing
```
bash: git merge feature-x               # merge into current branch
bash: git rebase main                    # rebase current onto main
bash: git merge --abort                  # cancel conflicted merge
```

### Stash
```
bash: git stash                          # save uncommitted work
bash: git stash list                     # list stashes
bash: git stash pop                      # restore and remove latest
bash: git stash apply stash@{1}          # restore without removing
```

## Workflows

### Feature Branch Workflow
```
bash: git checkout main && git pull origin main
bash: git checkout -b feat/new-feature
# ... make changes ...
bash: git add -A && git commit -m "feat: implement new feature"
bash: git push -u origin feat/new-feature
```

### Fix a Merge Conflict
1. `bash: git merge main` -- see conflicts
2. `read_file` on conflicted files -- find `<<<<<<<` markers
3. `edit_file` to resolve each conflict by removing markers and keeping correct code
4. `bash: git add <resolved-files> && git commit -m "merge: resolve conflicts with main"`

### Review a PR or Branch
```
bash: git fetch origin pull/42/head:pr-42 && git checkout pr-42
bash: git log --oneline main..pr-42      # commits in the PR
bash: git diff main..pr-42 --stat        # files changed
bash: git diff main..pr-42              # full diff
```

## Tips

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Check `git status` before and after operations to confirm state
- Use `git log --oneline -5` to verify commits landed correctly
- Use `read_file` + `edit_file` to resolve merge conflicts precisely
