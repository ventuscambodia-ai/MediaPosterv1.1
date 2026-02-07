import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { postToAllPlatforms } from '../services/uploader.js';
import { validateMedia, cleanupFiles } from '../utils/mediaHelper.js';
import { getSettings, isPlatformConfigured } from './settings.js';
import { requireAuth, getCurrentUserId } from '../middleware/auth.js';

const router = express.Router();

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload config
const uploadConfig = {
    maxPhotos: 10,
    maxPhotoSize: 10 * 1024 * 1024, // 10MB
    maxVideoSize: 100 * 1024 * 1024, // 100MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: uploadConfig.maxVideoSize,
        files: uploadConfig.maxPhotos,
    },
});

/**
 * POST /api/post
 * Post content to multiple platforms
 */
router.post('/', requireAuth, upload.array('media', uploadConfig.maxPhotos), async (req, res) => {
    const files = req.files;
    const userId = getCurrentUserId(req);

    try {
        // Validate files
        const config = { upload: uploadConfig };
        const validationErrors = validateMedia(files, config);
        if (validationErrors.length > 0) {
            cleanupFiles(files);
            return res.status(400).json({
                success: false,
                errors: validationErrors,
            });
        }

        // Get platforms from request
        const platformsRaw = req.body.platforms;
        const platforms = Array.isArray(platformsRaw)
            ? platformsRaw
            : platformsRaw?.split(',').map(p => p.trim()) || [];

        if (platforms.length === 0) {
            cleanupFiles(files);
            return res.status(400).json({
                success: false,
                errors: ['At least one platform must be selected'],
            });
        }

        // Get caption
        const caption = req.body.caption || '';

        // Get user's settings for posting
        const userSettings = getSettings(userId);

        // Post to all selected platforms
        const results = await postToAllPlatforms({
            platforms,
            files,
            caption,
            userSettings,  // Pass user-specific settings
        });

        // Cleanup uploaded files
        cleanupFiles(files);

        // Check overall success
        const allSuccess = results.every(r => r.success);
        const anySuccess = results.some(r => r.success);

        res.status(anySuccess ? 200 : 500).json({
            success: allSuccess,
            partialSuccess: anySuccess && !allSuccess,
            results,
        });

    } catch (error) {
        console.error('Post error:', error);
        cleanupFiles(files);

        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/post/status
 * Check configuration status for all platforms
 */
router.get('/status', requireAuth, (req, res) => {
    const userId = getCurrentUserId(req);
    const settings = getSettings(userId);

    const status = {
        facebook: {
            configured: !!(settings.facebook_page_id && settings.facebook_access_token),
        },
        telegram: {
            configured: !!(settings.telegram_bot_token && settings.telegram_chat_id),
        },
        tiktok: {
            configured: !!(settings.tiktok_access_token && settings.tiktok_open_id),
        },
        instagram: {
            configured: !!(settings.instagram_account_id && settings.instagram_access_token),
        },
        youtube: {
            configured: !!(settings.youtube_client_id && settings.youtube_client_secret && settings.youtube_refresh_token),
        },
    };

    res.json(status);
});

export default router;
