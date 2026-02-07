import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';

// Bot instance cache by token
const botCache = new Map();

/**
 * Get or create bot instance for a specific token
 */
function getBot(botToken) {
    if (!botCache.has(botToken)) {
        const bot = new TelegramBot(botToken, { polling: false });
        botCache.set(botToken, bot);
    }
    return botCache.get(botToken);
}

/**
 * Post a single photo to Telegram
 */
async function postSinglePhoto(filePath, caption, config) {
    const bot = getBot(config.botToken);
    const photoStream = fs.createReadStream(filePath);

    const result = await bot.sendPhoto(config.chatId, photoStream, {
        caption: caption || '',
        parse_mode: 'HTML',
    });

    return result;
}

/**
 * Post multiple photos as a media group to Telegram
 */
async function postMultiplePhotos(files, caption, config) {
    const bot = getBot(config.botToken);

    const media = files.map((file, index) => ({
        type: 'photo',
        media: `attach://photo${index}`,
        ...(index === 0 && caption ? { caption, parse_mode: 'HTML' } : {}),
    }));

    const fileOptions = {};
    files.forEach((file, index) => {
        fileOptions[`photo${index}`] = fs.createReadStream(file.path);
    });

    const result = await bot.sendMediaGroup(config.chatId, media, {
        fileOptions,
    });

    return result;
}

/**
 * Post a video to Telegram
 */
async function postVideo(filePath, caption, config) {
    const bot = getBot(config.botToken);
    const videoStream = fs.createReadStream(filePath);

    const result = await bot.sendVideo(config.chatId, videoStream, {
        caption: caption || '',
        parse_mode: 'HTML',
        supports_streaming: true,
    });

    return result;
}

/**
 * Main posting function for Telegram
 * @param {Object[]} files - Array of uploaded files
 * @param {string} caption - Post caption
 * @param {string} mediaType - 'photo' or 'video'
 * @param {Object} userSettings - User's platform credentials
 */
export async function postToTelegram(files, caption, mediaType, userSettings = {}) {
    try {
        const config = {
            botToken: userSettings.telegram_bot_token,
            chatId: userSettings.telegram_chat_id,
        };

        if (!config.botToken || !config.chatId) {
            throw new Error('Telegram credentials not configured');
        }

        let result;

        if (mediaType === 'video') {
            result = await postVideo(files[0].path, caption, config);
        } else if (files.length === 1) {
            result = await postSinglePhoto(files[0].path, caption, config);
        } else {
            result = await postMultiplePhotos(files, caption, config);
        }

        const messageId = Array.isArray(result) ? result[0].message_id : result.message_id;

        return {
            success: true,
            platform: 'telegram',
            messageId,
            message: 'Successfully posted to Telegram',
        };
    } catch (error) {
        console.error('Telegram posting error:', error.message);

        return {
            success: false,
            platform: 'telegram',
            error: error.message,
        };
    }
}

export default { postToTelegram };
