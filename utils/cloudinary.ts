import { supabase } from './supabaseClient';

/**
 * Uploads an image (File or Blob) directly to Cloudflare R2 via /api/r2-upload-url.
 */
export const uploadToCloudinary = async (file: File | Blob, filename?: string, folder = 'media'): Promise<string> => {
    const resolvedName = filename || (file instanceof File ? file.name : `upload_${Date.now()}.jpg`);
    const contentType = file.type || 'image/jpeg';

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Authentication required to upload media.');
    }

    const signRes = await fetch('/api/r2-upload-url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            filename: resolvedName,
            contentType,
            folder,
        }),
    });

    if (!signRes.ok) {
        const errData = await signRes.json().catch(() => ({}));
        throw new Error(errData?.error || `Failed to obtain R2 upload URL (HTTP ${signRes.status}).`);
    }

    const { uploadUrl, publicUrl } = await signRes.json();
    const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
    });

    if (!putRes.ok || !publicUrl) {
        throw new Error(`Cloudflare R2 upload failed (HTTP ${putRes.status}).`);
    }

    return publicUrl;
};
