// modules/auth-middleware.js
const loginTracker = require('./login-tracker');

/*
 Middleware to check if user is authenticated
 Returns 401 if not authenticated
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Authentication Required</title></head>
      <body>
        <h1>Authentication Required</h1>
        <p>You must be logged in to access this page.</p>
        <p><a href="/login">Login here</a></p>
        <p><a href="/">← Back to Home</a></p>
      </body>
      </html>
    `);
  }
}

/**
 Middleware to check username+IP-based login lockout
 Should be used before login route handlers
 Note: This requires the username to be in req.body.username
 */
function checkLoginLockout(req, res, next) {
  const ipAddress = getClientIP(req);
  const username = req.body?.username;
  
  // If no username provided, skip lockout check
  if (!username) {
    return next();
  }
  
  const lockoutStatus = loginTracker.checkLockout(ipAddress, username);
  
  if (lockoutStatus.locked) {
    const minutesRemaining = Math.ceil(lockoutStatus.remainingTime / (60 * 1000));
    req.session.error = `Too many failed attempts. Please try again in ${minutesRemaining} minute(s).`;
    return res.redirect('/login');
  }
  
  next();
}

/**
 Helper function to get client IP address
 Handles proxies and various connection types
 */
function getClientIP(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress || 
         'unknown';
}

module.exports = {
  requireAuth,
  checkLoginLockout,
  getClientIP
};
