import { postToFacebook } from './facebook.js';
import { postToTelegram } from './telegram.js';
import { postToTikTok } from './tiktok.js';
import { isVideo } from '../utils/mediaHelper.js';

/**
 * Post content to multiple platforms simultaneously
 * @param {Object} options - Posting options
 * @param {string[]} options.platforms - Array of platform names
 * @param {Object[]} options.files - Array of uploaded files
 * @param {string} options.caption - Caption/message for the post
 * @param {Object} options.userSettings - User's platform credentials
 * @returns {Promise<Object[]>} Array of results per platform
 */
export async function postToAllPlatforms({ platforms, files, caption, userSettings = {} }) {
    const mediaType = isVideo(files[0].mimetype) ? 'video' : 'photo';
    const results = [];

    // Create posting promises for each selected platform
    const postingPromises = platforms.map(async (platform) => {
        switch (platform.toLowerCase()) {
            case 'facebook':
                return postToFacebook(files, caption, mediaType, userSettings);
            case 'telegram':
                return postToTelegram(files, caption, mediaType, userSettings);
            case 'tiktok':
                return postToTikTok(files, caption, mediaType, userSettings);
            case 'instagram':
                return {
                    success: false,
                    platform: 'instagram',
                    error: 'Instagram integration coming soon',
                };
            case 'youtube':
                return {
                    success: false,
                    platform: 'youtube',
                    error: 'YouTube integration coming soon',
                };
            default:
                return {
                    success: false,
                    platform,
                    error: `Unknown platform: ${platform}`,
                };
        }
    });

    // Execute all posts concurrently
    const postResults = await Promise.allSettled(postingPromises);

    postResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            results.push(result.value);
        } else {
            results.push({
                success: false,
                platform: platforms[index],
                error: result.reason?.message || 'Unknown error',
            });
        }
    });

    return results;
}

export default { postToAllPlatforms };
