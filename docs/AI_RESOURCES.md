# AI Resources

This repo integrates guidance from four external projects as local, actionable resources.

| Resource | Local implementation | Upstream |
| --- | --- | --- |
| Graphify | `scripts/graphify.ps1`, `npm run graphify`, `AGENTS.md` graph-first guidance | https://github.com/safishamsi/graphify |
| Awesome Design MD | Root `DESIGN.md` tailored to Clinic DFU | https://github.com/voltagent/awesome-design-md |
| Get Shit Done | `.planning/` project context, requirements, roadmap, and state | https://github.com/gsd-build/get-shit-done |
| Everything Claude Code / ECC | `AGENTS.md` research-first, context, verification, and security guidance | https://github.com/affaan-m/everything-claude-code |

## Graphify

Graphify is a Python CLI distributed as `graphifyy`. This repo does not vendor the package. Install it once with one of:

```powershell
py -3 -m pip install --user graphifyy
pipx install graphifyy
uv tool install graphifyy
```

Then run:

```powershell
npm run graphify
```

Output is written to `graphify-out/`, which is ignored by git because it is generated.

## GSD-Lite Flow

Use the `.planning/` files for larger work:

- `PROJECT.md`: product and architecture context.
- `REQUIREMENTS.md`: acceptance criteria and guardrails.
- `ROADMAP.md`: phases and execution order.
- `STATE.md`: current progress and decisions.

## UI Contract

`DESIGN.md` is the source of truth for future UI changes. It adapts the DESIGN.md concept to a clinical SaaS product instead of copying a third-party brand.

## Agent Guidance

`AGENTS.md` gives Codex, Claude Code, and similar tools a local operating contract for this repo: inspect first, keep context tight, verify before delivery, and use the generated graph when available.
