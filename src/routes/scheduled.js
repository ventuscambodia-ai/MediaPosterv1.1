import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth, getCurrentUserId } from '../middleware/auth.js';
import { ScheduledPostModel } from '../database/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for scheduled post uploads
const scheduledUploadsDir = path.join(__dirname, '../../uploads/scheduled');
if (!fs.existsSync(scheduledUploadsDir)) {
    fs.mkdirSync(scheduledUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create user-specific folder
        const userId = getCurrentUserId(req);
        const userDir = path.join(scheduledUploadsDir, userId);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

/**
 * GET /api/scheduled - List user's scheduled posts
 */
router.get('/', requireAuth, (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        const posts = ScheduledPostModel.getAllForUser(userId);

        res.json({
            success: true,
            posts,
        });
    } catch (error) {
        console.error('Error fetching scheduled posts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch scheduled posts',
        });
    }
});

/**
 * POST /api/scheduled - Create a scheduled post
 */
router.post('/', requireAuth, upload.array('media', 10), async (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        const { platforms, caption, scheduledAt } = req.body;
        const files = req.files;

        // Validate inputs
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one media file is required',
            });
        }

        if (!platforms) {
            return res.status(400).json({
                success: false,
                error: 'At least one platform must be selected',
            });
        }

        if (!scheduledAt) {
            return res.status(400).json({
                success: false,
                error: 'Scheduled time is required',
            });
        }

        // Parse and validate scheduled time
        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid scheduled time format',
            });
        }

        if (scheduledDate <= new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Scheduled time must be in the future',
            });
        }

        // Parse platforms
        const platformList = typeof platforms === 'string'
            ? JSON.parse(platforms)
            : platforms;

        // Get absolute paths of uploaded files
        const mediaPaths = files.map(f => f.path);

        // Create scheduled post
        const postId = uuidv4();

        // Format as local datetime for SQLite: YYYY-MM-DD HH:MM:SS
        const localDateStr = scheduledDate.getFullYear() + '-' +
            String(scheduledDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(scheduledDate.getDate()).padStart(2, '0') + ' ' +
            String(scheduledDate.getHours()).padStart(2, '0') + ':' +
            String(scheduledDate.getMinutes()).padStart(2, '0') + ':' +
            String(scheduledDate.getSeconds()).padStart(2, '0');

        ScheduledPostModel.create(
            postId,
            userId,
            platformList,
            caption || '',
            mediaPaths,
            localDateStr
        );

        const newPost = ScheduledPostModel.findById(postId);

        res.status(201).json({
            success: true,
            message: 'Post scheduled successfully',
            post: newPost,
        });
    } catch (error) {
        console.error('Error creating scheduled post:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to schedule post',
        });
    }
});

/**
 * DELETE /api/scheduled/:id - Cancel a scheduled post
 */
router.delete('/:id', requireAuth, (req, res) => {
    try {
        const userId = getCurrentUserId(req);
        const postId = req.params.id;

        // Find the post
        const post = ScheduledPostModel.findById(postId);

        if (!post) {
            return res.status(404).json({
                success: false,
                error: 'Scheduled post not found',
            });
        }

        // Verify ownership
        if (post.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to delete this post',
            });
        }

        // Can only cancel pending posts
        if (post.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Cannot cancel post with status: ${post.status}`,
            });
        }

        // Delete media files
        if (post.media_paths && Array.isArray(post.media_paths)) {
            post.media_paths.forEach(filePath => {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                } catch (e) {
                    console.warn('Could not delete file:', filePath);
                }
            });
        }

        // Delete from database
        ScheduledPostModel.delete(postId);

        res.json({
            success: true,
            message: 'Scheduled post cancelled',
        });
    } catch (error) {
        console.error('Error cancelling scheduled post:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel scheduled post',
        });
    }
});

export default router;
