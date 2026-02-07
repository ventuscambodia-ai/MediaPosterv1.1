import { ScheduledPostModel, SettingsModel } from '../database/database.js';
import { postToAllPlatforms } from './uploader.js';
import fs from 'fs';
import path from 'path';

// Scheduler interval in milliseconds (1 minute)
const SCHEDULER_INTERVAL = 60 * 1000;

let schedulerTimer = null;

/**
 * Process a single scheduled post
 */
async function processScheduledPost(post) {
    console.log(`📤 Processing scheduled post: ${post.id}`);

    try {
        // Update status to processing
        ScheduledPostModel.updateStatus(post.id, 'processing');

        // Get user settings
        const allSettings = SettingsModel.getAllForUser(post.user_id);

        // Flatten settings for uploader
        const userSettings = {};
        Object.keys(allSettings).forEach(platform => {
            const platformSettings = allSettings[platform];
            Object.keys(platformSettings).forEach(key => {
                userSettings[`${platform}_${key}`] = platformSettings[key];
            });
        });

        // Prepare files array (media_paths contains absolute paths)
        const files = post.media_paths.map(filePath => ({
            path: filePath,
            mimetype: getMimeType(filePath),
            originalname: path.basename(filePath),
        }));

        // Execute the post
        const results = await postToAllPlatforms({
            platforms: post.platforms,
            files,
            caption: post.caption,
            userSettings,
        });

        // Check results
        const allSuccess = results.every(r => r.success);
        const status = allSuccess ? 'completed' : 'partial';

        ScheduledPostModel.updateStatus(post.id, status, results);
        console.log(`✅ Scheduled post ${post.id} completed with status: ${status}`);

        return { success: true, results };
    } catch (error) {
        console.error(`❌ Scheduled post ${post.id} failed:`, error.message);

        ScheduledPostModel.updateStatus(post.id, 'failed', {
            error: error.message,
        });

        return { success: false, error: error.message };
    }
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.webm': 'video/webm',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Run the scheduler tick - check for pending posts
 */
async function runSchedulerTick() {
    try {
        const pendingPosts = ScheduledPostModel.getPending();

        if (pendingPosts.length > 0) {
            console.log(`⏰ Found ${pendingPosts.length} pending scheduled post(s)`);

            for (const post of pendingPosts) {
                await processScheduledPost(post);
            }
        }
    } catch (error) {
        console.error('❌ Scheduler error:', error.message);
    }
}

/**
 * Start the scheduler
 */
export function startScheduler() {
    if (schedulerTimer) {
        console.log('⚠️ Scheduler already running');
        return;
    }

    console.log('⏰ Starting post scheduler (checking every minute)...');

    // Run immediately on start
    runSchedulerTick();

    // Then run every interval
    schedulerTimer = setInterval(runSchedulerTick, SCHEDULER_INTERVAL);
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
        console.log('⏰ Scheduler stopped');
    }
}

export default { startScheduler, stopScheduler };
