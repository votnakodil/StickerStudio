import { SAVED_PREVIEW_VERSION, type SavedTemplate } from '../api/stickerLibrary'

/** Publish upgraded cards only after their matching previews are durable. */
export async function upgradeSavedPreviews(
  templates: SavedTemplate[],
  render: (template: SavedTemplate, design: string) => Promise<string | undefined>,
  persist: (id: string, design: string, preview: string) => Promise<void>,
) {
  for (const template of templates) {
    const design = template.design
    if (!design || template.previewVersion === SAVED_PREVIEW_VERSION) continue
    const preview = await render(template, design)
    if (!preview) continue
    await persist(template.id, design, preview)
    template.preview = preview
    template.previewVersion = SAVED_PREVIEW_VERSION
  }
  return templates
}
