# Clinic DFU DESIGN.md

Inspired by the Awesome DESIGN.md pattern, adapted for this clinical operations product.

## Visual Theme

Clinic DFU is a quiet, operational healthcare SaaS interface. It should feel precise, trustworthy, and easy to scan during repeated daily work. Prefer restrained surfaces, clear hierarchy, and compact controls over decorative marketing composition.

## Color Palette

| Token | Value | Role |
| --- | --- | --- |
| Primary Blue | `#0066ff` | Primary actions, active navigation, key focus states |
| Slate 950 | `#020617` | Dark-mode page background and high-contrast text |
| Slate 900 | `#0f172a` | Dark surfaces and primary text |
| Slate 50 | `#f8fafc` | Light-mode page background |
| White | `#ffffff` | Main cards, tables, modal surfaces |
| Emerald 600 | `#059669` | Positive status and active clinical state |
| Rose 600 | `#e11d48` | Destructive actions and urgent status |
| Amber 500 | `#f59e0b` | Warnings, pending work, attention states |

## Typography

- Use Inter or the configured system sans stack.
- Page titles: 20-24px, bold, tight but readable.
- Section headings: 14-16px, semibold or bold.
- Table labels and metadata: 10-12px, uppercase only for compact labels.
- Body text: 13-14px, medium weight where scanning matters.
- Do not scale type with viewport width.

## Layout

- Keep product screens as dense but calm workspaces.
- Use full-width page layouts with constrained inner content.
- Use cards for repeated entities, modals, stats, and bounded tools.
- Do not nest cards inside cards.
- Keep border radius at 8px for controls and 12px only for large app shells already using that convention.
- Preserve stable dimensions for nav items, toolbar buttons, tables, stats, and status chips.

## Components

- Buttons: icon plus label for primary commands; icon-only for obvious tools with `title`.
- Navigation: left sidebar, active item highlighted with primary tint and a thin active rail.
- Tables: compact row height, sticky mental model, clear empty states.
- Forms: labels above controls, strong focus state, validation close to fields.
- Status: use color sparingly and pair it with readable text.
- Modals: centered, focused on a single decision or form.

## Motion

Use small opacity/translate transitions for page entry and modal appearance. Avoid large decorative animation in operational screens.

## Responsive Behavior

- Sidebar collapses behind a mobile overlay.
- Tables may scroll horizontally on narrow screens.
- Primary actions must remain reachable without overlapping content.
- Text inside buttons and chips must fit on mobile widths.

## Do

- Keep clinical data legible.
- Prefer predictable controls.
- Make loading, empty, and error states explicit.
- Use lucide icons when an icon exists.
- Keep Portuguese product copy short and direct.

## Do Not

- Do not add landing-page heroes to internal app screens.
- Do not use decorative gradient blobs or one-note color palettes.
- Do not hide critical clinical status behind icons alone.
- Do not introduce a new component library without a specific need.
