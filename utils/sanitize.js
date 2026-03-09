// ---------------------------------------------------------------------------
// sanitize.js — Input sanitization utility
// Strips script tags, HTML entities, and common injection patterns from all
// incoming string values (query params, route params, request body).
// ---------------------------------------------------------------------------

/**
 * Sanitize a single string value:
 *  1. Remove <script>...</script> blocks
 *  2. Strip all remaining HTML tags
 *  3. Neutralize common injection characters: ' " ; -- ` $
 *  4. Trim whitespace
 */
function sanitizeString(value) {
    if (typeof value !== 'string') return value;

    return value
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')   // strip script blocks
        .replace(/<[^>]+>/g, '')                              // strip HTML tags
        .replace(/['";`\\$]/g, '')                            // remove injection chars
        .replace(/--/g, '')                                   // remove SQL comment syntax
        .trim();
}

/**
 * Recursively sanitize all string values in an object or array.
 */
function sanitizeObject(obj) {
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (obj && typeof obj === 'object') {
        const clean = {};
        for (const key of Object.keys(obj)) {
            clean[key] = sanitizeObject(obj[key]);
        }
        return clean;
    }
    return obj;
}

/**
 * Express middleware — sanitizes req.query, req.params, and req.body in-place.
 */
function sanitizeMiddleware(req, _res, next) {
    if (req.query)  req.query  = sanitizeObject(req.query);
    if (req.params) req.params = sanitizeObject(req.params);
    if (req.body)   req.body   = sanitizeObject(req.body);
    next();
}

module.exports = { sanitizeString, sanitizeObject, sanitizeMiddleware };
