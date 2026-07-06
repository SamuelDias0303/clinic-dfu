# Clinic DFU Agent Guide

This repository uses four external resources as local operating guidance:

- Graphify: generate and query a project knowledge graph before broad code spelunking.
- Awesome Design MD: keep product UI consistent through `DESIGN.md`.
- Get Shit Done: use a small spec-driven loop for larger changes.
- Everything Claude Code / ECC: prefer research-first work, tight context, verification, and security hygiene.

## Project Shape

- Frontend: Vite, React 19, TypeScript, Tailwind CSS v4.
- Auth/data: Firebase.
- Main app entry: `src/App.tsx`.
- Views live in `src/views`.
- Shared UI lives in `src/components`.
- Service modules live in `src/services`.

## Working Loop

For small fixes, inspect the nearby code, edit, and run `npm run lint` plus `npm run build`.

For larger features, use the local GSD-lite artifacts:

1. Update `.planning/STATE.md` with the current intent.
2. Keep the acceptance criteria in `.planning/REQUIREMENTS.md` current.
3. Break the work into phases in `.planning/ROADMAP.md`.
4. Implement one phase at a time.
5. Verify with TypeScript and a production build.

## Graphify

When Graphify is installed, build the repo graph with:

```powershell
npm run graphify
```

The output goes to `graphify-out/`. Use `graphify query "<question>"` for broad architecture questions after the graph exists.

## Design

Use `DESIGN.md` as the UI contract. The app should stay calm, clinical, data-dense, and operational. Avoid landing-page patterns inside the product.

## Verification

Before handing work back:

```powershell
npm run lint
npm run build
```

If a command cannot run locally, record the reason in the final note.
