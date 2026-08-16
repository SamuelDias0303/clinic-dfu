<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6e6942c1-83c7-4dc4-9bec-e8beb1027c92

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## AI Resources

This repo includes local integrations for:

- Graphify: run `npm run graphify` after installing the official `graphifyy` CLI.
- Awesome Design MD: see [DESIGN.md](DESIGN.md).
- Get Shit Done: see `.planning/`.
- Everything Claude Code / ECC: see [AGENTS.md](AGENTS.md).

Details are documented in [docs/AI_RESOURCES.md](docs/AI_RESOURCES.md).

## Documentacao Operacional

- Guia passo a passo para administradores, gestores, recepcao e terapeutas: [docs/GUIA_OPERACIONAL.md](docs/GUIA_OPERACIONAL.md).
- Modelo de whitelabel e tenancy: [docs/WHITELABEL_MODEL.md](docs/WHITELABEL_MODEL.md).
- Fluxo de autenticacao e tenant: [docs/AUTH_TENANT_FLOW.md](docs/AUTH_TENANT_FLOW.md).
- Backoffice de whitelabel: [docs/WHITELABEL_BACKOFFICE.md](docs/WHITELABEL_BACKOFFICE.md).
- Services tenant-aware: [docs/TENANT_AWARE_SERVICES.md](docs/TENANT_AWARE_SERVICES.md).
- Modulo de captacao e conteudo de site: [docs/MODULO_CAPTACAO.md](docs/MODULO_CAPTACAO.md).
- Acesso ADMIN_GLOBAL e custom claims: [docs/ACESSO_ADMIN_GLOBAL.md](docs/ACESSO_ADMIN_GLOBAL.md).
- Telas com escopo por whitelabel: [docs/TENANT_AWARE_SCREENS.md](docs/TENANT_AWARE_SCREENS.md).
- Migracao para whitelabel: [docs/WHITELABEL_MIGRATION.md](docs/WHITELABEL_MIGRATION.md).
- Matriz de seguranca: [docs/WHITELABEL_SECURITY_MATRIX.md](docs/WHITELABEL_SECURITY_MATRIX.md).
