---
name: women_medics_guidelines
description: "Use when: generating code, refactoring, or implementing features in the women_medics project. Always apply these preferences for Svelte, D3, and general code organization."
applyTo: "**"
---

# Women Medics Project Code Generation Preferences

## Svelte & D3 Code

- **Always use declarative style** over imperative.
  - Prefer reactive declarations (`$:`) and Svelte bindings.
  - For D3, use data-driven selections rather than direct DOM manipulation.
  - Example: Use `{#each data as item}` instead of imperative loop-based rendering.

## Comments & Clarity

- Apply comments liberally for code clarity.
  - Explain the "why" and complex logic, not just the "what".
  - Use inline comments for reactive variables and animation math to clarify intent.
  - Keep comments concise but complete.

## Variable Naming

- Prefer longer, accurate names over short abbreviations.
  - Use `drawProgress` instead of `dp` or `p`.
  - Use `markerTravelUpY` instead of `mty`.
  - Prioritize readability for future maintainers (including yourself).

## Code Organization

- Break code into smaller component chunks for clarity.
  - Keep components single-purpose where possible.
  - Extract helper logic into separate files when a component grows beyond ~150 lines.
  - Use prop drilling sparingly; consider context or stores for shared state.
  - Comment component responsibility at the top of the script block.

## Simplicity & Directness

- **Inline variables that serve only one purpose.** If a variable is used once or only to name a simple expression, inline it instead of adding another declaration.
- **Question intermediate abstractions.** Before adding a new variable, ask: "Does this genuinely clarify the code, or just add a layer?"
- **Prefer direct expressions over multiple steps** when the logic is simple enough to read in one line with a comment.
- **Trade-off rule:** Clarity beats brevity. If inlining makes logic harder to follow, keep the variable. If it makes it clearer, remove it.

## Learning While Building

- **Teach incrementally.** Prefer a step-by-step approach over delivering everything at once.
- **Make one change at a time when possible.** For code changes, explain the immediate goal, apply a small edit, then explain what changed before moving on.
- **Surface reasoning in sequence.** Start with the concrete behavior, then the smallest supporting concept, then the implementation detail.
- **Avoid information dumps.** Do not front-load a full architecture explanation when a smaller local explanation will let the user follow along.
- **Prefer guided refactoring.** When simplifying code, point out which line or variable is unnecessary, why it can be removed, and what the simpler version does.
- **Use the current code as the teaching anchor.** Explain ideas through the exact component or line being discussed instead of switching to abstract examples unless needed.

## When Suggesting Changes

- Always explain the rationale for refactorings or new patterns.
- Avoid over-engineering; prefer simple solutions that meet requirements.
- When defensive code (e.g., `Math.min/Math.max`) is used, include a brief comment explaining why.
- If refactoring reduces complexity (fewer variables, clearer intent), highlight what was removed and why it improved readability.
