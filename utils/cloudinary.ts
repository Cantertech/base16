import { supabase } from './supabaseClient';

/**
 * Uploads an image (File or Blob) to Cloudflare R2 via /api/r2-upload-url,
 * with automatic fallback to Cloudinary if R2 is not configured in the current environment.
 */
export const uploadToCloudinary = async (file: File | Blob, filename?: string, folder = 'media'): Promise<string> => {
    const resolvedName = filename || (file instanceof File ? file.name : `upload_${Date.now()}.jpg`);
    const contentType = file.type || 'image/jpeg';

    // 1. Try Cloudflare R2 direct upload (zero egress fees)
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
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

            if (signRes.ok) {
                const { uploadUrl, publicUrl } = await signRes.json();
                const putRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': contentType },
                    body: file,
                });
                if (putRes.ok && publicUrl) {
                    return publicUrl;
                }
            }
        }
    } catch (r2Err) {
        console.warn('R2 upload unavailable, falling back to Cloudinary:', r2Err);
    }

    // 2. Fallback to Cloudinary (e.g. local Vite dev without /api/ routes)
    const cloudName = 'dcojlfyrp';
    const uploadPreset = 'metly_uploads';

    const formData = new FormData();
    if (filename && !(file instanceof File)) {
        formData.append('file', file, filename);
    } else {
        formData.append('file', file);
    }
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
            method: 'POST',
            body: formData,
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Image upload failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
};
