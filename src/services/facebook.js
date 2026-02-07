import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0';
const GRAPH_VIDEO_URL = 'https://graph-video.facebook.com/v19.0';

/**
 * Post a single photo to Facebook Page
 */
async function postSinglePhoto(filePath, caption, config) {
    const form = new FormData();
    form.append('source', fs.createReadStream(filePath));
    if (caption) form.append('message', caption);
    form.append('access_token', config.accessToken);

    const response = await axios.post(
        `${GRAPH_API_URL}/${config.pageId}/photos`,
        form,
        { headers: form.getHeaders() }
    );

    return response.data;
}

/**
 * Upload a photo without publishing (for multi-photo posts)
 */
async function uploadUnpublishedPhoto(filePath, config) {
    const form = new FormData();
    form.append('source', fs.createReadStream(filePath));
    form.append('published', 'false');
    form.append('access_token', config.accessToken);

    const response = await axios.post(
        `${GRAPH_API_URL}/${config.pageId}/photos`,
        form,
        { headers: form.getHeaders() }
    );

    return response.data.id; // Returns media_fbid
}

/**
 * Post multiple photos as an album to Facebook Page
 */
async function postMultiplePhotos(files, caption, config) {
    // Upload each photo as unpublished
    const mediaIds = await Promise.all(
        files.map(file => uploadUnpublishedPhoto(file.path, config))
    );

    // Create the post with attached media
    const attachedMedia = mediaIds.map(id => ({ media_fbid: id }));

    const response = await axios.post(
        `${GRAPH_API_URL}/${config.pageId}/feed`,
        {
            message: caption || '',
            attached_media: attachedMedia,
            access_token: config.accessToken,
        }
    );

    return response.data;
}

/**
 * Post a video to Facebook Page
 */
async function postVideo(filePath, caption, config) {
    const form = new FormData();
    form.append('source', fs.createReadStream(filePath));
    if (caption) form.append('description', caption);
    form.append('access_token', config.accessToken);

    const response = await axios.post(
        `${GRAPH_VIDEO_URL}/${config.pageId}/videos`,
        form,
        {
            headers: form.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        }
    );

    return response.data;
}

/**
 * Main posting function for Facebook
 * @param {Object[]} files - Array of uploaded files
 * @param {string} caption - Post caption
 * @param {string} mediaType - 'photo' or 'video'
 * @param {Object} userSettings - User's platform credentials
 */
export async function postToFacebook(files, caption, mediaType, userSettings = {}) {
    try {
        const config = {
            pageId: userSettings.facebook_page_id,
            accessToken: userSettings.facebook_access_token,
        };

        if (!config.pageId || !config.accessToken) {
            throw new Error('Facebook credentials not configured');
        }

        let result;

        if (mediaType === 'video') {
            result = await postVideo(files[0].path, caption, config);
        } else if (files.length === 1) {
            result = await postSinglePhoto(files[0].path, caption, config);
        } else {
            result = await postMultiplePhotos(files, caption, config);
        }

        return {
            success: true,
            platform: 'facebook',
            postId: result.id || result.post_id,
            message: 'Successfully posted to Facebook',
        };
    } catch (error) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error('Facebook posting error:', errorMessage);

        return {
            success: false,
            platform: 'facebook',
            error: errorMessage,
        };
    }
}

export default { postToFacebook };
