export type VkPack = {
    id: string;
    name: string;
    stickerCount: number | null;
    needsStickerURL: boolean;
    installed: boolean;
};
export type VkFailureKind = 'auth_required' | 'retryable' | 'unknown';
export class VkServiceError extends Error {
    readonly kind: VkFailureKind;
    constructor(kind: VkFailureKind, message: string) {
        super(message);
        this.kind = kind;
    }
}
type PacksResponse = {
    packs: VkPack[];
};
type SendResponse = {
    kind: 'confirmed';
    confirmed: true;
    stickerCount: number | null;
};
async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`/api/vk/${path}`, { credentials: 'same-origin', cache: 'no-store', ...init });
    }
    catch {
        throw new VkServiceError(path === 'upload' || path === 'create-pack' || path === 'prepare-pack' ? 'unknown' : 'retryable', 'Could not reach the local VK service.');
    }
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const payload = result && typeof result === 'object' ? result as {
            kind?: string;
            error?: string;
        } : {};
        const kind: VkFailureKind = payload.kind === 'unknown' || payload.kind === 'auth_required'
            ? payload.kind : response.status === 401 ? 'auth_required' : 'retryable';
        throw new VkServiceError(kind, payload.error ?? `VK service returned HTTP ${response.status}.`);
    }
    return result as T;
}
export const vkWorkspace = {
    async authorize(email: string, password: string, signal?: AbortSignal): Promise<{ email: string }> {
        const result = await request<unknown>('authorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            signal,
        });
        const account = result && typeof result === 'object'
            ? result as { authenticated?: unknown; email?: unknown } : null;
        if (account?.authenticated !== true || typeof account.email !== 'string' || !account.email) {
            throw new VkServiceError('retryable', 'VK Workspace did not confirm authorization.');
        }
        return { email: account.email };
    },
    async connect(email: string, password: string, signal?: AbortSignal): Promise<VkPack[]> {
        const result = await request<PacksResponse>('login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            signal,
        });
        return result.packs;
    },
    async getPacks(): Promise<VkPack[]> {
        return (await request<PacksResponse>('session')).packs;
    },
    async refreshPacks(signal?: AbortSignal): Promise<VkPack[]> {
        return (await request<PacksResponse>('refresh-packs', { method: 'POST', signal })).packs;
    },
    async checkPackName(name: string, signal?: AbortSignal): Promise<{ name: string; slug: string; available: boolean }> {
        return request('check-name', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }), signal,
        });
    },
    async preparePack(name: string, signal?: AbortSignal): Promise<{ name: string; slug: string }> {
        const result = await request<{ ready?: boolean; name: string; slug: string }>('prepare-pack', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }), signal,
        });
        if (result?.ready !== true || typeof result.name !== 'string' || typeof result.slug !== 'string') {
            throw new VkServiceError('unknown', 'Stickers Bot did not confirm that it is ready for an image.');
        }
        return result;
    },
    async createPack(name: string, blob: Blob, filename: string, signal?: AbortSignal): Promise<{ pack: VkPack; url: string }> {
        return request('create-pack', {
            method: 'POST', headers: {
                'Content-Type': 'application/octet-stream',
                'X-Pack-Name': encodeURIComponent(name),
                'X-File-Name': encodeURIComponent(filename),
            }, body: blob, signal,
        });
    },
    async sendSticker(blob: Blob, packId: string, options: {
        filename: string;
        stickerReference?: string;
    }): Promise<SendResponse> {
        const result = await request<SendResponse>('upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'X-Pack-Id': packId,
                'X-File-Name': encodeURIComponent(options.filename),
                ...(options.stickerReference ? { 'X-Sticker-Reference': options.stickerReference } : {}),
            },
            body: blob,
        });
        if (result?.kind !== 'confirmed' || result.confirmed !== true) {
            throw new VkServiceError('unknown', 'VK Workspace did not confirm the upload.');
        }
        return result;
    },
};
