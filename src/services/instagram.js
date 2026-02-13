import axios from 'axios';

const GRAPH_API_URL = 'https://graph.facebook.com/v19.0';

/**
 * Wait for a media container to finish processing
 * Instagram requires polling for video/carousel containers
 */
async function waitForMediaReady(containerId, accessToken, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const response = await axios.get(
            `${GRAPH_API_URL}/${containerId}`,
            {
                params: {
                    fields: 'status_code,status',
                    access_token: accessToken,
                },
            }
        );

        const statusCode = response.data.status_code;

        if (statusCode === 'FINISHED') {
            return true;
        }

        if (statusCode === 'ERROR') {
            throw new Error(`Media processing failed: ${response.data.status || 'Unknown error'}`);
        }

        // Wait 5 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Media processing timed out');
}

/**
 * Publish a media container to Instagram
 */
async function publishMedia(containerId, config) {
    const response = await axios.post(
        `${GRAPH_API_URL}/${config.accountId}/media_publish`,
        {
            creation_id: containerId,
            access_token: config.accessToken,
        }
    );

    return response.data;
}

/**
 * Post a single photo to Instagram
 * Instagram requires a publicly accessible image URL
 */
async function postSinglePhoto(publicUrl, caption, config) {
    // Step 1: Create media container
    const containerResponse = await axios.post(
        `${GRAPH_API_URL}/${config.accountId}/media`,
        {
            image_url: publicUrl,
            caption: caption || '',
            access_token: config.accessToken,
        }
    );

    const containerId = containerResponse.data.id;

    // Step 2: Publish the container
    return await publishMedia(containerId, config);
}

/**
 * Post a video (Reel) to Instagram
 * Instagram requires a publicly accessible video URL
 */
async function postVideo(publicUrl, caption, config) {
    // Step 1: Create video container
    const containerResponse = await axios.post(
        `${GRAPH_API_URL}/${config.accountId}/media`,
        {
            video_url: publicUrl,
            caption: caption || '',
            media_type: 'REELS',
            access_token: config.accessToken,
        }
    );

    const containerId = containerResponse.data.id;

    // Step 2: Wait for video processing to finish
    await waitForMediaReady(containerId, config.accessToken);

    // Step 3: Publish the container
    return await publishMedia(containerId, config);
}

/**
 * Post multiple photos as a carousel to Instagram
 */
async function postCarousel(publicUrls, caption, config) {
    // Step 1: Create individual item containers (no caption on items)
    const itemIds = [];
    for (const url of publicUrls) {
        const response = await axios.post(
            `${GRAPH_API_URL}/${config.accountId}/media`,
            {
                image_url: url,
                is_carousel_item: true,
                access_token: config.accessToken,
            }
        );
        itemIds.push(response.data.id);
    }

    // Step 2: Create carousel container
    const carouselResponse = await axios.post(
        `${GRAPH_API_URL}/${config.accountId}/media`,
        {
            media_type: 'CAROUSEL',
            children: itemIds.join(','),
            caption: caption || '',
            access_token: config.accessToken,
        }
    );

    const carouselId = carouselResponse.data.id;

    // Step 3: Wait for carousel processing
    await waitForMediaReady(carouselId, config.accessToken);

    // Step 4: Publish the carousel
    return await publishMedia(carouselId, config);
}

/**
 * Build a public URL for a locally uploaded file.
 * Requires PUBLIC_URL env var or a deployed server.
 */
function getPublicUrl(filePath) {
    const baseUrl = process.env.PUBLIC_URL;
    if (!baseUrl) {
        throw new Error(
            'Instagram requires PUBLIC_URL environment variable to be set. ' +
            'Set it to your server\'s public URL (e.g., https://your-app.railway.app) ' +
            'or use ngrok for local testing.'
        );
    }

    // Extract filename from file path
    const filename = filePath.split('/').pop().split('\\').pop();
    return `${baseUrl.replace(/\/$/, '')}/uploads/${filename}`;
}

/**
 * Main posting function for Instagram
 * @param {Object[]} files - Array of uploaded files
 * @param {string} caption - Post caption
 * @param {string} mediaType - 'photo' or 'video'
 * @param {Object} userSettings - User's platform credentials
 */
export async function postToInstagram(files, caption, mediaType, userSettings = {}) {
    try {
        const config = {
            accountId: userSettings.instagram_account_id,
            accessToken: userSettings.instagram_access_token,
        };

        if (!config.accountId || !config.accessToken) {
            throw new Error('Instagram credentials not configured');
        }

        let result;

        if (mediaType === 'video') {
            const publicUrl = getPublicUrl(files[0].path);
            result = await postVideo(publicUrl, caption, config);
        } else if (files.length === 1) {
            const publicUrl = getPublicUrl(files[0].path);
            result = await postSinglePhoto(publicUrl, caption, config);
        } else {
            const publicUrls = files.map(f => getPublicUrl(f.path));
            result = await postCarousel(publicUrls, caption, config);
        }

        return {
            success: true,
            platform: 'instagram',
            postId: result.id,
            message: 'Successfully posted to Instagram',
        };
    } catch (error) {
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error('Instagram posting error:', errorMessage);
        if (error.response?.data) console.error('Full error details:', JSON.stringify(error.response.data, null, 2));

        return {
            success: false,
            platform: 'instagram',
            error: errorMessage,
        };
    }
}

export default { postToInstagram };
