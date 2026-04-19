# Release Workflow

This is the canonical chain for getting work from a feature PR to a verified, released build. Ratified by the CEO on `FIS-61`; drafted under `FIS-62`. Future distribution tickets (including `FIS-41` D2) reference this doc rather than re-specifying roles. Discoverable from the repo-documentation roadmap at `FIS-23`.

## Roles

| Step | Owner | Prereq |
| --- | --- | --- |
| 1. Feature PR opened | Author (`@engineer` / `@cto`) | Work complete, tests green |
| 2. QA sign-off on the PR | `@testengineer` | PR passes CI gate |
| 3. Merge to `main` | `@engineer` or `@cto` | QA cleared step 2 |
| 4. Cut GitHub release (tag + artifact) | `@engineer` or `@cto` | Merge complete |
| 5. Verify release build | `@devops` | Release asset published |
| 6. Non-dev install dry-run | `@product-owner` with `@engineer` assist | Release verified |

### Step 3 clarification — default merger

**Engineer is the default merger for routine feature PRs.** CTO merges when any of the following apply:

- The PR touches CTO-owned areas (architecture, release tooling, infrastructure).
- The PR is itself a release PR.
- No Engineer is available.

This preserves CTO authority over release cuts without making them a bottleneck on every merge.

### Step 4 clarification — release cut

Either CTO or Engineer cuts the tag and publishes the artifact. Whoever cuts the release then hands verification to `@devops` (step 5). The cutter does not self-verify.

## When steps can be skipped

Not every change needs all six steps. The skip-paths below are the only sanctioned shortcuts — any other deviation should be called out in the PR description.

**Hotfixes.** For urgent production-blocking fixes, QA sign-off (step 2) may follow merge rather than precede it. Fast path: open the PR, tag `@testengineer` in the PR body, merge once the author has validated the fix, then circle back for QA sign-off on `main`. Hotfixes still require steps 4–6 if a release is cut.

**Non-release PRs.** Any PR that does not produce a user-facing release (internal refactors, infra-only changes, experiments) skips steps 4–6 entirely. No release cut, no verification, no install dry-run.

**Doc-only and CI-only PRs.** Changes confined to Markdown files, comments, or CI workflow definitions may skip QA sign-off (step 2) at the author's discretion. The author is still responsible for the CI gate passing. Steps 4–6 also do not apply (these are non-release by definition).

## References

- `FIS-23` — parent roadmap: organize repo documentation.
- `FIS-61` — canonization ticket and CEO ratification thread.
- `FIS-41` — distribution callsite (Milestone D) that references this doc for release roles.
