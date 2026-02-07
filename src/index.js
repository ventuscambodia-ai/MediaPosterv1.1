import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import session from 'express-session';
import SqliteStore from 'better-sqlite3-session-store';
import sqlite3 from 'better-sqlite3';
import postRoutes from './routes/post.js';
import settingsRoutes from './routes/settings.js';
import authRoutes from './routes/auth.js';
import scheduledRoutes from './routes/scheduled.js';
import { initializeDatabase } from './database/database.js';
import { startScheduler } from './services/scheduler.js';

dotenv.config();

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
initializeDatabase();

const app = express();

// Trust proxy (required for Railway, Render, etc. - they use reverse proxies)
app.set('trust proxy', 1);

// Session store using SQLite (persists across server restarts)
const SessionStore = SqliteStore(session);
const sessionDb = new sqlite3(path.join(__dirname, '../sessions.db'));

// Session configuration
const sessionSecret = process.env.SESSION_SECRET || 'media-poster-dev-secret-change-in-production';
const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;

app.use(session({
    store: new SessionStore({
        client: sessionDb,
        expired: {
            clear: true,
            intervalMs: 900000 // Clear expired sessions every 15 min
        }
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProduction, // true on Railway (HTTPS)
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax' // Same domain, so 'lax' is fine
    },
    name: 'mediaposter.sid'
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/post', postRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/scheduled', scheduledRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve auth page
app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/auth.html'));
});

// Catch-all: serve main app (for SPA routing)
app.get('*', (req, res) => {
    // If API route not found, return 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('\n🚀 Media Poster is running!');
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log('\n📋 Features:');
    console.log('   • Multi-user authentication');
    console.log('   • Per-user platform settings');
    console.log('   • Post templates');
    console.log('   • Scheduled posts');
    console.log('\n📱 Supported Platforms:');
    console.log('   • Facebook (photos & videos)');
    console.log('   • Telegram (photos & videos)');
    console.log('   • TikTok (videos only)');
    console.log('   • Instagram (coming soon)');
    console.log('   • YouTube (coming soon)');
    console.log('\n💡 Create an account to get started!\n');

    // Start the post scheduler
    startScheduler();
});
