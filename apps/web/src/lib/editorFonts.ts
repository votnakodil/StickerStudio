let loading: Promise<unknown> | undefined

/** Load the exact faces before Fabric measures and caches their glyph widths. */
export function loadEditorFonts() {
  loading ??= Promise.all([400, 500, 600, 700, 900].flatMap((weight) =>
    ['normal', 'italic'].map((style) => document.fonts.load(`${style} ${weight} 16px "SF Pro Text"`, 'АБВABC')),
  ))
  return loading
}
