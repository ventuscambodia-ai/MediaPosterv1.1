import axios from 'axios';
import fs from 'fs';

const TIKTOK_API_URL = 'https://open.tiktokapis.com/v2';

/**
 * Initialize video upload to TikTok
 */
async function initializeUpload(fileSize, config) {
    const response = await axios.post(
        `${TIKTOK_API_URL}/post/publish/video/init/`,
        {
            post_info: {
                title: '',
                privacy_level: 'SELF_ONLY', // Start as private, user can change on TikTok
                disable_duet: false,
                disable_comment: false,
                disable_stitch: false,
            },
            source_info: {
                source: 'FILE_UPLOAD',
                video_size: fileSize,
                chunk_size: fileSize,
                total_chunk_count: 1,
            },
        },
        {
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
            },
        }
    );

    return response.data;
}

/**
 * Upload video chunk to TikTok
 */
async function uploadVideoChunk(uploadUrl, filePath, fileSize) {
    const fileBuffer = fs.readFileSync(filePath);

    const response = await axios.put(uploadUrl, fileBuffer, {
        headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': fileSize,
            'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });

    return response.data;
}

/**
 * Post a video to TikTok
 */
async function postVideo(filePath, caption, config) {
    if (!config.accessToken || !config.openId) {
        throw new Error('TikTok credentials not configured');
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Step 1: Initialize upload
    const initResponse = await initializeUpload(fileSize, config);

    if (initResponse.error?.code) {
        throw new Error(initResponse.error.message || 'Failed to initialize TikTok upload');
    }

    const uploadUrl = initResponse.data.upload_url;
    const publishId = initResponse.data.publish_id;

    // Step 2: Upload video
    await uploadVideoChunk(uploadUrl, filePath, fileSize);

    // Return publish ID - video will be in drafts or pending
    return { publish_id: publishId };
}

/**
 * Main posting function for TikTok
 * @param {Object[]} files - Array of uploaded files
 * @param {string} caption - Post caption
 * @param {string} mediaType - 'photo' or 'video'
 * @param {Object} userSettings - User's platform credentials
 */
export async function postToTikTok(files, caption, mediaType, userSettings = {}) {
    try {
        // TikTok only supports video
        if (mediaType !== 'video') {
            return {
                success: false,
                platform: 'tiktok',
                error: 'TikTok only supports video uploads',
            };
        }

        const config = {
            accessToken: userSettings.tiktok_access_token,
            openId: userSettings.tiktok_open_id,
        };

        const result = await postVideo(files[0].path, caption, config);

        return {
            success: true,
            platform: 'tiktok',
            publishId: result.publish_id,
            message: 'Video uploaded to TikTok (check your drafts)',
        };
    } catch (error) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error('TikTok posting error:', errorMessage);

        return {
            success: false,
            platform: 'tiktok',
            error: errorMessage,
        };
    }
}

export default { postToTikTok };
