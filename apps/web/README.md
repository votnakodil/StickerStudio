# Sticker Studio web application

Run commands from the repository root; see [development instructions](../../README.md).

The application uses React, TypeScript, Vite, Zustand, Fabric and Motion. CSS modules live beside their components. Global styles and fonts are in `src/styles`; colors come from `@sticker-studio/theme`.

Pages compose feature modules through each feature's `index.ts`. A feature owns its UI (`components`), operations and state (`model`), and external adapters (`api`). Shared components contain no editor, library or VK business logic.

`@/` resolves to `src/`. Route composition and providers live in `src/app`. The editor engine is accessed through `@sticker-studio/editor`.
