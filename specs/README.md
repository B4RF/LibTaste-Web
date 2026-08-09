# Feature specifications

Feature specifications are the source of truth for user-visible behavior before implementation starts. Each feature gets
one directory named `NNNN-short-name` and one `spec.md` copied from [`_template/spec.md`](./_template/spec.md).

## When a specification is required

Every change under `apps/` must be covered by an `Approved` specification or by an `In Progress` specification whose
implementation has already started. This includes product code, tests, configuration, migrations, and generated
contracts; a direct implementation request alone is not sufficient authorization.

If a requested change is not covered, create or revise a `Draft` specification and wait for human approval before
editing `apps/`. Read-only investigation and specification work may proceed while the specification is a draft.

## Lifecycle

| Status        | Meaning                                                                    |
|---------------|----------------------------------------------------------------------------|
| `Draft`       | The problem and acceptance criteria are still being refined.               |
| `Approved`    | A human has approved implementation against this specification.            |
| `In Progress` | Tests or implementation are being changed.                                 |
| `Implemented` | Code is complete, but required verification has not all passed yet.        |
| `Verified`    | Every acceptance criterion is covered and all required checks have passed. |
| `Superseded`  | A later approved specification replaces this specification.                |

Only `Approved` specifications may start a new implementation. An interrupted `In Progress` specification may be
resumed. Changing requirements after work starts means returning the specification to `Draft` for another approval.
`Superseded` is terminal: do not implement or verify that specification; follow its `Superseded by` reference instead.

## Create a specification

Before allocating a new SPEC ID or copying the template, use the project-local `grilling` skill. Resolve the proposal
one decision at a time and obtain human confirmation that the shared understanding is complete. This prerequisite
applies to every completely new specification; it does not apply when revising an existing specification.

From the repository root:

```powershell
Copy-Item specs/_template specs/0001-short-feature-name -Recurse
```

Replace every placeholder, keep requirement and acceptance-criterion IDs stable, and set `Status: Approved` only after
the document represents the intended behavior. Validate it with:

```powershell
node scripts/validate-specs.mjs
```

The number identifies the specification; use the next unused four-digit number. The slug uses lowercase letters, digits,
and hyphens.

## Implement a specification

Ask Codex to implement the approved file, for example:

```text
Implement specs/0001-short-feature-name/spec.md.
```

The repository's `implement-spec` skill derives tests from the acceptance criteria, makes the smallest implementation,
runs the checks required by `AGENTS.md`, and records the evidence in the specification. A specification reaches
`Verified` only when every acceptance criterion has a test or an explicit automated/manual verification reference and
all applicable repository checks pass.

Keep the verification matrix current while implementing, derive tests from every acceptance criterion, and run
`node scripts/validate-specs.mjs` before declaring the specification `Verified`.

Specifications describe externally observable behavior and constraints, not a predetermined code diff. Use the
implementation notes for known boundaries or decisions, and leave design freedom where multiple solutions satisfy the
requirements.

## Conflicts and supersession

Before approving a new specification, compare it with every non-superseded specification that covers the same user
journey, interface, data, or non-functional requirement. Natural-language conflicts still require human or AI review;
the validator checks declared relationships, not semantic meaning.

- If the new draft intentionally replaces an entire existing specification, set its `Supersedes` field to the old
  `SPEC-NNNN`. Leave the old specification active while the replacement remains `Draft`.
- When the replacement is approved, set the old specification to `Superseded` and set its `Superseded by` field to the
  replacement in the same change. The validator requires these links to be reciprocal.
- A replacement must restate every still-applicable requirement from the old specification. Supersession applies to the
  whole document, not only the conflicting requirement.
- For a small change that should not replace the whole document, revise the existing specification: return it to
  `Draft`, make the requirement change, and obtain approval again.
- If related specifications can remain simultaneously valid, list them in `Related specifications and conflicts` and
  explain why their requirements are compatible. Do not use `Supersedes`.
- Update or remove tests that enforce only superseded behavior in the replacement's implementation change. Preserve
  tests for requirements carried forward.

## Current specifications

| ID                                                              | Feature                                     | Status   |
|-----------------------------------------------------------------|---------------------------------------------|----------|
| [SPEC-0001](./0001-web-foundation-authentication/spec.md)         | Web foundation and Steam authentication     | Draft    |
| [SPEC-0002](./0002-steam-library-management/spec.md)              | Steam profile and library management        | Draft    |
| [SPEC-0003](./0003-pairwise-comparisons/spec.md)                  | Pairwise game comparisons                   | Draft    |
| [SPEC-0004](./0004-game-leaderboards/spec.md)                     | Personal and global game leaderboards       | Draft    |
| [SPEC-0005](./0005-account-session-settings/spec.md)              | Account and session settings                | Draft    |
