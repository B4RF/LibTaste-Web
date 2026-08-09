# AGENTS.md

## Project

LibTaste allows to rank Steam games intuitively by pair-wise comparisons.  
Users can rank their steam library and will simultaneously create a global ranking.  
The users taste can be determined by their ranking to suggest new games.

## Before every session

1. `ARCHITECTURE.md` (especially for NFRs)
2. The package's own README before editing inside it
3. `docs/adr/` before making a fundamental decision again — there may already be an ADR covering it

## Spec-driven changes

- Follow the complete specification workflow in `specs/README.md`.
- Before creating a completely new specification, use the project-local `grilling` skill and obtain human confirmation
  of the shared understanding.
- Never modify `src/` unless the change is covered by an `Approved` specification or resumes an implementation already
  marked `In Progress`. Otherwise, prepare a `Draft` and wait for human approval.
- Use the project-local `implement-spec` skill for implementation and verification. Never implement a `Draft` or
  `Superseded` specification.

## After every completed task

- [ ] Add an entry to `CHANGELOG.md` — skip this for refactorings
- [ ] Update `README.md` of impacted packages whose structure or behavior changed
- [ ] Write an ADR in `docs/adr/` if the task made or reversed an architectural decision
