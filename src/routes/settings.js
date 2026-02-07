import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SettingsModel } from '../database/database.js';
import { requireAuth, getCurrentUserId } from '../middleware/auth.js';

const router = express.Router();

// Platform configuration structure
const platformFields = {
    facebook: ['page_id', 'access_token'],
    telegram: ['bot_token', 'chat_id'],
    tiktok: ['access_token', 'open_id'],
    instagram: ['account_id', 'access_token'],
    youtube: ['client_id', 'client_secret', 'refresh_token'],
};

/**
 * GET /api/settings
 * Get current user's settings
 */
router.get('/', requireAuth, (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        const settings = SettingsModel.getAllForUser(userId);

        // Convert to flat format for frontend compatibility
        const flatSettings = {};
        Object.keys(platformFields).forEach(platform => {
            const platformSettings = settings[platform] || {};
            platformFields[platform].forEach(field => {
                const key = `${platform}_${field}`;
                flatSettings[key] = platformSettings[field] || '';
            });
        });

        res.json(flatSettings);
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).json({ success: false, error: 'Failed to load settings' });
    }
});

/**
 * POST /api/settings
 * Save user's settings
 */
router.post('/', requireAuth, (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        const newSettings = req.body;

        // Group settings by platform
        const platformSettings = {};
        Object.keys(platformFields).forEach(platform => {
            platformSettings[platform] = {};
            platformFields[platform].forEach(field => {
                const key = `${platform}_${field}`;
                if (newSettings[key] !== undefined) {
                    platformSettings[platform][field] = newSettings[key];
                }
            });
        });

        // Save each platform's settings
        Object.keys(platformSettings).forEach(platform => {
            const settings = platformSettings[platform];
            // Only save if at least one field has a value
            const hasValue = Object.values(settings).some(v => v && v.length > 0);
            if (hasValue) {
                SettingsModel.upsert(uuidv4(), userId, platform, settings);
            }
        });

        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ success: false, error: 'Failed to save settings' });
    }
});

/**
 * Get settings for posting (internal use)
 */
export function getSettings(userId) {
    if (!userId) {
        return {};
    }

    const settings = SettingsModel.getAllForUser(userId);

    // Convert to flat format for service compatibility
    const flatSettings = {};
    Object.keys(platformFields).forEach(platform => {
        const platformSettings = settings[platform] || {};
        platformFields[platform].forEach(field => {
            const key = `${platform}_${field}`;
            flatSettings[key] = platformSettings[field] || '';
        });
    });

    return flatSettings;
}

/**
 * Check if a platform is configured for a user
 */
export function isPlatformConfigured(userId, platform) {
    const settings = SettingsModel.getForPlatform(userId, platform);
    if (!settings) return false;

    // Check if required fields are present
    const requiredFields = platformFields[platform] || [];
    return requiredFields.every(field => settings[field] && settings[field].length > 0);
}

export default router;
