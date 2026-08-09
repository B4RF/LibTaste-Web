---
name: implement-spec
description: Implement or resume an approved Design Evolution feature specification, deriving tests from its requirements, making the minimum code and documentation changes, running all applicable repository checks, and recording verification evidence. Use when asked to implement, execute, complete, or verify a spec under specs/.
---

# Implement a feature specification

Treat the requested `specs/NNNN-short-name/spec.md` as the behavioral source of truth. Continue to obey `AGENTS.md`,
`ARCHITECTURE.md`, package guides, and accepted ADRs.

## Establish readiness

1. Read the complete requested specification, every non-superseded specification covering the same behavior or
   interface, and run `node scripts/validate-specs.mjs`.
2. If its status is `Draft`, help resolve ambiguity but do not change tests or product code.
3. If its status is `Superseded`, do not implement it; follow its `Superseded by` references and report the redirect.
4. Start new implementation only from `Approved`. Resume `In Progress` work after inspecting the existing diff and
   evidence. Treat changed requirements as a return to `Draft` requiring approval.
5. Resolve contradictions with active specifications, architecture, or accepted ADRs before implementation. Do not
   guess which conflicting behavior wins. Require an intentional revision or a valid reciprocal supersession.
6. For a replacement, confirm that it restates every requirement carried forward from the superseded specification.
7. Change the status to `In Progress` and update its date when implementation begins.

## Drive work from evidence

1. Map every acceptance criterion and independently verifiable NFR to a test or explicit verification method in the
   verification matrix.
2. Add or change the smallest test that demonstrates each missing behavior. Confirm new tests fail for the intended
   reason when practical; never weaken an existing test merely to obtain a pass.
3. Implement the minimum behavior that makes the tests pass. Preserve package boundaries and avoid editing generated
   artifacts by hand.
4. Re-run focused tests while iterating. Keep IDs in the specification stable so tests and evidence remain traceable.
5. Update tests that enforce superseded behavior while preserving coverage for requirements carried forward.
6. Update impacted package documentation and the repository records required by `AGENTS.md`.

## Verify and close

1. Set status to `Implemented` after code and documentation are complete.
2. Run the spec validator plus every applicable command in `AGENTS.md`. Include contract regeneration checks when API
   DTOs change and web lint/build whenever `apps/web` changes.
3. Record exact test paths or other evidence, commands, results, and the verification date in the specification.
4. Leave status as `Implemented` and report failures if any required check does not pass.
5. Set status to `Verified` only when the matrix has no pending entries, all completion boxes are checked, and every
   required command passes.

Do not silently expand scope. Record useful follow-up work separately instead of adding unapproved behavior.
