# Clinic DFU Project Context

Clinic DFU is a white-label clinical operations app for managing patients, appointments, therapists, clinical records, and global backoffice clients.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- Firebase auth and data services
- lucide-react icons
- motion/react page transitions

## Current Product Areas

- Authentication and role selection
- Dashboard
- Agenda
- Patients
- Therapists
- Clinical records
- Global backoffice
- AI resources/backoffice enablement

## Architecture Notes

- Views are routed manually through `src/App.tsx`.
- Role-based navigation is handled in `src/components/Sidebar.tsx`.
- Firebase-facing logic is isolated in `src/services`.
- Shared app state for auth and theme is under `src/contexts`.

## Guardrails

- Preserve the existing visual language unless a change is explicitly design-led.
- Keep clinical workflows clear and auditable.
- Prefer small, verified increments over broad rewrites.
