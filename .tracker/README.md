# Issue Tracker

Lightweight file-based tracker. Issues live in `.tracker/issues/` as Markdown files with YAML
frontmatter. `KNOWN_ISSUES.md` at the repo root is generated from them - do not hand-edit it.

## Lifecycle

```
discover -> create -> work -> verify -> close -> regenerate
```

1. **Discover** - identify the bug, debt, or enhancement.
2. **Create** - run `pnpm issue:new` to generate an issue file from the template.
3. **Work** - fill in Summary, Expected, Actual, Repro, Notes, and Fix Plan. Set `status:
in-progress` by hand when you begin.
4. **Verify** - after the fix lands, check off each item in `## Verification`. All boxes must be
   checked before closing.
5. **Close** - run `pnpm issue:close` to stamp the frontmatter and fill `## Resolution`.
6. **Regenerate** - run `pnpm issue:generate` to update `KNOWN_ISSUES.md`. CI runs
   `pnpm issue:check` to fail if the file is stale.

## Commands

### Create a new issue

```
pnpm issue:new --title "Short description" [options]
```

| Flag           | Values                                                                | Default  |
| -------------- | --------------------------------------------------------------------- | -------- |
| `--type`       | `bug` `debt` `enhancement`                                            | `bug`    |
| `--severity`   | `high` `medium` `low`                                                 | `medium` |
| `--area`       | `ui` `data` `worker` `build` `solver` `formats` `embed` `lab` `bench` | `ui`     |
| `--regression` | _(flag, no value)_                                                    | false    |

The ID is auto-assigned (`BUG-001`, `DEBT-001`, `ENH-001`, ...).

### Close an issue

```
pnpm issue:close --id BUG-001 [options]
```

| Flag           | Notes                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------- |
| `--fixed-by`   | Defaults to `git config user.name`                                                            |
| `--fixed-at`   | Defaults to today (`YYYY-MM-DD`)                                                              |
| `--branch`     | Defaults to current branch                                                                    |
| `--pr`         | PR number or URL, optional                                                                    |
| `--commit`     | Commit SHA, optional                                                                          |
| `--resolution` | One-line summary; if omitted and `## Resolution` is already filled, the existing text is kept |

### Regenerate KNOWN_ISSUES.md

```
pnpm issue:generate   # write the file
pnpm issue:check      # verify it is up to date (used by CI)
```

## Issue body sections

| Section        | What to write                                                             |
| -------------- | ------------------------------------------------------------------------- |
| **Summary**    | One paragraph describing the root cause and impact.                       |
| **Expected**   | What correct behaviour looks like.                                        |
| **Actual**     | What actually happens.                                                    |
| **Repro**      | Numbered steps to reproduce. Include mocks or test snippets where useful. |
| **Notes**      | Source references, related files/lines, constraints on the fix.           |
| **Fix Plan**   | Bullet list of the concrete changes needed before closing.                |
| **Resolution** | Filled at close time. Describe what changed, not just that it was fixed.  |

## Verification checklist

All three boxes must be checked before running `issue:close`.

- **test added or updated** - a unit or integration test covers the fixed behaviour.
- **manual verification completed** - the fix was confirmed to work end-to-end (tests pass, no
  regressions observed).
- **docs updated if needed** - ADRs, Architecture.md, or other docs reflect the change if the fix
  touched a design decision or public contract.

The person who authored the fix is responsible for checking these off.

## Valid frontmatter statuses

| Status        | Meaning                                            |
| ------------- | -------------------------------------------------- |
| `open`        | Not yet started.                                   |
| `in-progress` | Actively being worked on.                          |
| `blocked`     | Waiting on something external.                     |
| `fixed`       | Resolved - set by `issue:close`.                   |
| `deferred`    | Won't fix in the near term; tracked for awareness. |
