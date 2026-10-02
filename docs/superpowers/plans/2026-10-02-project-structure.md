# Project Structure Implementation Plan

> Execute inline with superpowers:executing-plans and verify each completed module.

**Goal:** Apply the structural review while keeping the temporary VK backend in scripts.

**Architecture:** Pages compose feature modules. Features own their components, API adapters and models; shared UI depends only on shared utilities and theme tokens. The editor package retains its public API while implementation is split by responsibility.

**Tech Stack:** React, TypeScript, Vite, Fabric, Zustand, Motion, npm workspaces.

**Spec:** User-approved structure review in this conversation, excluding moving the VK backend.

## Global Constraints

- Preserve existing UI behavior, animation values and uncommitted user changes.
- Keep scripts/add-sticker.mjs, scripts/sticker-test-server.mjs and their running sessions in place.
- Do not commit, push or add inline code comments.
- Use existing project colors and naming conventions.

## Review Focus

- Undo/redo must restore text frames, strokes, image settings and background.
- Export must remain a 1024px PNG regardless of viewport zoom.
- Shared UI must not depend on feature modules.
- Route imports and CSS/asset paths must resolve after moves.
- VK preparation and upload must retain cancellation and duplicate-upload safeguards.

## Tasks

- [x] 1. Add focused editor regression tests and record baseline results.
- [x] 2. Split editor into types, canvas, text, images, stroke, layers, history and export; preserve public exports and test again.
- [x] 3. Move app routing/providers, pages, features and shared UI; configure @/ imports and remove the empty UI workspace.
- [x] 4. Consolidate motion utilities, extract feature operation hooks and rename EditorLab to EditorPage.
- [x] 5. Enable strict TypeScript and resolve actual type errors without blanket suppression.
- [x] 6. Add test/check scripts and CI, update architecture/development docs and remove unused template styles.
- [x] 7. Run full checks and inspect editor, library, login and export in the browser.

## Verification results

- `npm run check`: passed architecture checks, strict type checks, lint, 14 regression tests, color checks and production build.
- Architecture check: 83 application source files and 21 editor modules; no forbidden layer imports or editor runtime cycles.
- Browser: editor loaded its image and text layers; export opened; email/password flow reached pack selection; 65th name character was blocked; preparing a pack sent no image; Upload completed with an actual PNG export and success closed the sheet; library tabs and login page rendered without console errors.
- Browser integration used an isolated local fixture. Real VK backend processes and their authorized sessions were not restarted.
- GitHub Actions workflow added; remote CI has not been run from this task.
- Vite still reports the main bundle above its 500 kB advisory threshold. Bundle optimization is separate from this structural reorganization.
