# Architecture

## Dependency direction

`app → pages → features → shared` is the allowed direction. A layer may also use lower layers directly. `packages/editor` owns Fabric editing behavior; `packages/theme` owns color tokens.

- `app`: application providers and route transitions.
- `pages`: route-level composition and layout, with one folder per page.
- `features`: product functionality, with colocated `components`, `model`, `api` and feature-specific `lib` as needed.
- `shared`: reusable UI, hooks, assets and general utilities. It must not import feature or page code.

## Public APIs

Use a feature's `index.ts` when importing it from another feature or a page. Within the same feature, direct imports are allowed. Avoid adding public exports for implementation details.

The editor package has an explicit public entry point in `src/index.ts`. Its internal modules use direct relative imports, rather than importing their own public entry point. Runtime cycles are checked automatically.

## Ownership and naming

Components use PascalCase; hooks use `useSomething`. A component and its CSS module share a folder. Page names describe the route (`EditorPage`, `LibraryPage`, `LoginPage`). Assets used by several features live in `shared/assets`. Feature-specific helpers stay in that feature.

Keep general UI reusable. Move network calls, cancellation and operation state into the feature's model hook; keep presentation and event wiring in the component. Do not create empty architectural folders before they have an owner and content.

## Motion and colors

Common motion values live in `shared/lib/motion`. Components use theme variables or exports from `@sticker-studio/theme`. `check:colors` detects hardcoded color literals in application and engine sources.

## Tests and checks

`npm run check` is the local and CI gate. Editor regression tests cover undo/redo, layer ordering and PNG export. VK fixture tests cover one bot initialization per session, authorization response shape, failure classification and preparing a pack without sending an image. Validation tests cover pack names and allowed sticker references.

## Temporary VK backend

The VK backend deliberately remains in `scripts/` during test operation. Its adapter is isolated in `features/vk-workspace/api`. Moving the backend to a separately deployed server is a later task; this reorganization does not change its session storage or deployment.
