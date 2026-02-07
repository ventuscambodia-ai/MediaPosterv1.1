/**
 * Authentication middleware
 * Checks if user is logged in via session
 */
export function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
}

/**
 * Optional auth - attaches user to request if logged in
 */
export function optionalAuth(req, res, next) {
    // User info is already attached via session
    next();
}

/**
 * Get current user from session
 */
export function getCurrentUserId(req) {
    return req.session?.userId || null;
}

export default { requireAuth, optionalAuth, getCurrentUserId };
