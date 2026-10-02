export function stickerFilename(name: string | undefined): string {
    const base = name?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return `${base || 'sticker'}.png`;
}
export function downloadSticker(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.append(link);
    try {
        link.click();
    }
    finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
}
