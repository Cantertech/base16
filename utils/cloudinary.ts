export const uploadToCloudinary = async (file: File) => {
    // Hardcoded credentials to ensure they are used
    const cloudName = 'dcojlfyrp';
    const uploadPreset = 'metly_uploads';

    console.log('Using Cloudinary Config:', { cloudName, uploadPreset });

    const formData = new FormData();
    formData.append('file', file);
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
