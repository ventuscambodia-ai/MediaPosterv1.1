import fs from 'fs';
import path from 'path';

/**
 * Get file extension from filename
 */
export function getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
}

/**
 * Check if file is an image
 */
export function isImage(mimetype) {
    return mimetype.startsWith('image/');
}

/**
 * Check if file is a video
 */
export function isVideo(mimetype) {
    return mimetype.startsWith('video/');
}

/**
 * Delete uploaded files
 */
export function cleanupFiles(files) {
    if (!files || files.length === 0) return;

    files.forEach(file => {
        try {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        } catch (err) {
            console.error(`Failed to delete file ${file.path}:`, err.message);
        }
    });
}

/**
 * Validate media files
 */
export function validateMedia(files, config) {
    const errors = [];

    if (!files || files.length === 0) {
        errors.push('No media files provided');
        return errors;
    }

    const hasImages = files.some(f => isImage(f.mimetype));
    const hasVideos = files.some(f => isVideo(f.mimetype));

    // Cannot mix photos and videos
    if (hasImages && hasVideos) {
        errors.push('Cannot mix photos and videos in a single post');
        return errors;
    }

    // Check photo count
    if (hasImages && files.length > config.upload.maxPhotos) {
        errors.push(`Maximum ${config.upload.maxPhotos} photos allowed`);
    }

    // Check video count
    if (hasVideos && files.length > 1) {
        errors.push('Only one video per post is allowed');
    }

    // Validate file types and sizes
    files.forEach(file => {
        if (isImage(file.mimetype)) {
            if (!config.upload.allowedImageTypes.includes(file.mimetype)) {
                errors.push(`Unsupported image type: ${file.mimetype}`);
            }
            if (file.size > config.upload.maxPhotoSize) {
                errors.push(`Image ${file.originalname} exceeds maximum size of 10MB`);
            }
        } else if (isVideo(file.mimetype)) {
            if (!config.upload.allowedVideoTypes.includes(file.mimetype)) {
                errors.push(`Unsupported video type: ${file.mimetype}`);
            }
            if (file.size > config.upload.maxVideoSize) {
                errors.push(`Video ${file.originalname} exceeds maximum size of 100MB`);
            }
        } else {
            errors.push(`Unsupported file type: ${file.mimetype}`);
        }
    });

    return errors;
}
