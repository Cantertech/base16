export const uploadToCloudinary = async (file: File | Blob, filename?: string): Promise<string> => {
    const cloudName = 'dcojlfyrp';
    const uploadPreset = 'metly_uploads';

    const formData = new FormData();
    if (filename && !(file instanceof File)) {
        formData.append('file', file, filename);
    } else {
        formData.append('file', file);
    }
    formData.append('upload_preset', uploadPreset);

    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData,
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Cloudinary Error Details:', errorData);
            throw new Error(`Image upload failed: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
};
