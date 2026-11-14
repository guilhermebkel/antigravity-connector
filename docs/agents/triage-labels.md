# Triage labels

| Role | Label | Meaning |
| --- | --- | --- |
| needs-triage | `needs-triage` | Maintainer needs to evaluate this issue |
| needs-info | `needs-info` | Waiting on someone for more information |
| ready-for-agent | `ready-for-agent` | Fully specified, ready for an unattended agent |
| ready-for-human | `ready-for-human` | Requires the owner (for example, a step that needs the Google login) |
| wontfix | `wontfix` | Will not be actioned |

## Other labels

| Label | Meaning |
| --- | --- |
| `task` | An issue written as a spec (see `issue-tracker.md`). |
| `bug`, `enhancement` | Type labels from the bug and idea forms. |
| `documentation` | The project brief and the roadmap. |
| `area:harness`, `area:protocol`, `area:agy`, `area:core`, `area:server`, `area:api`, `area:mcp`, `area:ops`, `area:docs` | Which part of the project the issue touches. |

A triaged issue has exactly one of `ready-for-agent`, `ready-for-human`, `needs-info`, `wontfix`, plus one `area:` label. `needs-triage` is removed when that happens.
