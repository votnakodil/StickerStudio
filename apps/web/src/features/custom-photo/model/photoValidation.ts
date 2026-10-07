export function validatePhoto(file: { size: number; type: string }): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a PNG, JPG, or WebP image.'
  if (!file.size) return 'This image is empty. Choose another photo.'
  if (file.size > 20 * 1024 * 1024) return 'Choose an image smaller than 20 MB.'
  return null
}
