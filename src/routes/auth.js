import express from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../database/database.js';

const router = express.Router();

const SALT_ROUNDS = 10;

/**
 * POST /api/auth/register
 * Create a new user account
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        // Check if user already exists
        const existingUser = UserModel.findByEmail(email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'An account with this email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const userId = uuidv4();
        UserModel.create(userId, email.toLowerCase(), passwordHash);

        // Create session
        req.session.userId = userId;
        req.session.email = email.toLowerCase();

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            user: {
                id: userId,
                email: email.toLowerCase()
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create account'
        });
    }
});

/**
 * POST /api/auth/login
 * Authenticate user
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        // Find user
        const user = UserModel.findByEmail(email.toLowerCase());
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Create session
        req.session.userId = user.id;
        req.session.email = user.email;

        res.json({
            success: true,
            message: 'Logged in successfully',
            user: {
                id: user.id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to login'
        });
    }
});

/**
 * POST /api/auth/logout
 * Destroy session
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to logout'
            });
        }

        res.clearCookie('connect.sid');
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            error: 'Not authenticated',
            authenticated: false
        });
    }

    const user = UserModel.findById(req.session.userId);
    if (!user) {
        return res.status(401).json({
            success: false,
            error: 'User not found',
            authenticated: false
        });
    }

    res.json({
        success: true,
        authenticated: true,
        user: {
            id: user.id,
            email: user.email
        }
    });
});

export default router;
