import dotenv from 'dotenv';
dotenv.config();

const config = {
  // Server
  port: process.env.PORT || 3000,

  // Facebook
  facebook: {
    pageId: process.env.FACEBOOK_PAGE_ID,
    accessToken: process.env.FACEBOOK_ACCESS_TOKEN,
    graphApiUrl: 'https://graph.facebook.com/v19.0',
    graphVideoUrl: 'https://graph-video.facebook.com/v19.0',
  },

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },

  // Upload settings
  upload: {
    maxPhotos: 10,
    maxPhotoSize: 10 * 1024 * 1024, // 10MB
    maxVideoSize: 100 * 1024 * 1024, // 100MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
  },
};

// Validate required configuration
export function validateConfig() {
  const errors = [];

  if (!config.facebook.pageId) errors.push('FACEBOOK_PAGE_ID is required');
  if (!config.facebook.accessToken) errors.push('FACEBOOK_ACCESS_TOKEN is required');
  if (!config.telegram.botToken) errors.push('TELEGRAM_BOT_TOKEN is required');
  if (!config.telegram.chatId) errors.push('TELEGRAM_CHAT_ID is required');

  return errors;
}

export default config;
