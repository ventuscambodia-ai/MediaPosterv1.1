import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/mediaposter.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

/**
 * Initialize database schema
 */
export function initializeDatabase() {
    console.log('📦 Initializing database...');

    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // User platform settings
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_settings (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            platform TEXT NOT NULL,
            settings_json TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, platform)
        )
    `);

    // Post templates
    db.exec(`
        CREATE TABLE IF NOT EXISTS post_templates (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            platforms TEXT NOT NULL,
            caption_template TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Scheduled posts
    db.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_posts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            platforms TEXT NOT NULL,
            caption TEXT,
            media_paths TEXT NOT NULL,
            scheduled_at DATETIME NOT NULL,
            status TEXT DEFAULT 'pending',
            result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Create indexes for performance
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
        CREATE INDEX IF NOT EXISTS idx_post_templates_user_id ON post_templates(user_id);
        CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON scheduled_posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
        CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at);
    `);

    console.log('✅ Database initialized successfully');
}

/**
 * User operations
 */
export const UserModel = {
    create(id, email, passwordHash) {
        const stmt = db.prepare(`
            INSERT INTO users (id, email, password_hash)
            VALUES (?, ?, ?)
        `);
        return stmt.run(id, email, passwordHash);
    },

    findByEmail(email) {
        const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
        return stmt.get(email);
    },

    findById(id) {
        const stmt = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?');
        return stmt.get(id);
    },
};

/**
 * User Settings operations
 */
export const SettingsModel = {
    // Get all settings for a user
    getAllForUser(userId) {
        const stmt = db.prepare('SELECT platform, settings_json FROM user_settings WHERE user_id = ?');
        const rows = stmt.all(userId);

        const settings = {};
        rows.forEach(row => {
            settings[row.platform] = JSON.parse(row.settings_json);
        });
        return settings;
    },

    // Get settings for a specific platform
    getForPlatform(userId, platform) {
        const stmt = db.prepare('SELECT settings_json FROM user_settings WHERE user_id = ? AND platform = ?');
        const row = stmt.get(userId, platform);
        return row ? JSON.parse(row.settings_json) : null;
    },

    // Upsert settings for a platform
    upsert(id, userId, platform, settingsObj) {
        const settingsJson = JSON.stringify(settingsObj);
        const stmt = db.prepare(`
            INSERT INTO user_settings (id, user_id, platform, settings_json)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, platform) DO UPDATE SET
                settings_json = excluded.settings_json,
                updated_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(id, userId, platform, settingsJson);
    },

    // Delete settings for a platform
    delete(userId, platform) {
        const stmt = db.prepare('DELETE FROM user_settings WHERE user_id = ? AND platform = ?');
        return stmt.run(userId, platform);
    },
};

/**
 * Post Templates operations
 */
export const TemplateModel = {
    create(id, userId, name, platforms, captionTemplate) {
        const stmt = db.prepare(`
            INSERT INTO post_templates (id, user_id, name, platforms, caption_template)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(id, userId, name, JSON.stringify(platforms), captionTemplate);
    },

    getAllForUser(userId) {
        const stmt = db.prepare('SELECT * FROM post_templates WHERE user_id = ?');
        const rows = stmt.all(userId);
        return rows.map(row => ({
            ...row,
            platforms: JSON.parse(row.platforms),
        }));
    },

    findById(id) {
        const stmt = db.prepare('SELECT * FROM post_templates WHERE id = ?');
        const row = stmt.get(id);
        if (row) {
            row.platforms = JSON.parse(row.platforms);
        }
        return row;
    },

    update(id, name, platforms, captionTemplate) {
        const stmt = db.prepare(`
            UPDATE post_templates
            SET name = ?, platforms = ?, caption_template = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(name, JSON.stringify(platforms), captionTemplate, id);
    },

    delete(id) {
        const stmt = db.prepare('DELETE FROM post_templates WHERE id = ?');
        return stmt.run(id);
    },
};

/**
 * Scheduled Posts operations
 */
export const ScheduledPostModel = {
    create(id, userId, platforms, caption, mediaPaths, scheduledAt) {
        const stmt = db.prepare(`
            INSERT INTO scheduled_posts (id, user_id, platforms, caption, media_paths, scheduled_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(id, userId, JSON.stringify(platforms), caption, JSON.stringify(mediaPaths), scheduledAt);
    },

    getAllForUser(userId) {
        const stmt = db.prepare(`
            SELECT * FROM scheduled_posts 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `);
        const rows = stmt.all(userId);
        return rows.map(row => ({
            ...row,
            platforms: JSON.parse(row.platforms),
            media_paths: JSON.parse(row.media_paths),
            result: row.result ? JSON.parse(row.result) : null,
        }));
    },

    getPending() {
        const stmt = db.prepare(`
            SELECT * FROM scheduled_posts 
            WHERE status = 'pending' AND scheduled_at <= datetime('now', 'localtime')
            ORDER BY scheduled_at ASC
        `);
        const rows = stmt.all();
        return rows.map(row => ({
            ...row,
            platforms: JSON.parse(row.platforms),
            media_paths: JSON.parse(row.media_paths),
        }));
    },

    findById(id) {
        const stmt = db.prepare('SELECT * FROM scheduled_posts WHERE id = ?');
        const row = stmt.get(id);
        if (row) {
            row.platforms = JSON.parse(row.platforms);
            row.media_paths = JSON.parse(row.media_paths);
            row.result = row.result ? JSON.parse(row.result) : null;
        }
        return row;
    },

    updateStatus(id, status, result = null) {
        const stmt = db.prepare(`
            UPDATE scheduled_posts
            SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(status, result ? JSON.stringify(result) : null, id);
    },

    delete(id) {
        const stmt = db.prepare('DELETE FROM scheduled_posts WHERE id = ?');
        return stmt.run(id);
    },

    deleteByUser(id, userId) {
        const stmt = db.prepare('DELETE FROM scheduled_posts WHERE id = ? AND user_id = ?');
        return stmt.run(id, userId);
    },
};

export default db;
