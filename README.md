# Sticker Studio

React application for editing stickers, saving PNG files and exporting to VK Workspace.

## Requirements and development

Use Node.js 24 and npm. From the repository root:

```sh
npm ci
npm run dev
```

For VK Workspace integration, start the temporary local backend in a second terminal:

```sh
npm run dev:vk
```

Vite proxies `/api/vk/*` to `127.0.0.1:4177`. The temporary backend keeps the authorized session in memory; restarting it requires signing in again.

## Repository structure

```text
apps/web/src/
  app/                 Application providers and routes
  pages/               Route composition, one directory per page
  features/
    auth/              Sign-in UI and authentication adapters
    editor/            Canvas UI, editor state and export actions
    library/           Sticker gallery, saved library and persistence
    vk-workspace/      Pack selection, preparation and upload
  shared/              Reusable UI, hooks, motion utilities and assets
  styles/              Global styles and fonts
packages/
  editor/              Fabric-based editing engine and regression tests
  theme/               Shared color tokens
scripts/               Temporary VK backend, diagnostic UI and project checks
```

See [architecture rules](docs/architecture.md) and [VK prototype documentation](scripts/README.md).

## Verification

```sh
npm run check
```

This checks module boundaries, strict TypeScript, lint, regression tests, color tokens and the production build. Individual checks are available as `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:architecture` and `npm run build`.

The same command runs in GitHub Actions. Automated VK tests use local fixtures and do not send messages to real accounts.
