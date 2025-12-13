// routes/auth.js
const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database/database.js');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');

/**
 * GET /register - Show registration form
 */
router.get('/register', (req, res) => {
  res.render('register');
});

/**
 * POST /register - Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.redirect('/register?error=' + encodeURIComponent('Username and password are required'));
    }
    
    // Validate password requirements
    const validation = validatePassword(password);
    if (!validation.valid) {
      const errorsText = validation.errors.join(', ');
      return res.redirect('/register?error=' + encodeURIComponent('Password does not meet requirements: ' + errorsText));
    }
    
    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.redirect('/register?error=' + encodeURIComponent('Username already exists. Please choose a different username.'));
    }
    
    // Hash the password before storing
    const passwordHash = await hashPassword(password);
    
    // Insert new user into database
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    const result = stmt.run(username, passwordHash);
    
    // Redirect to success page with username
    res.redirect(`/register-success?username=${encodeURIComponent(username)}&userId=${result.lastInsertRowid}`);
    
  } catch (error) {
    console.error('Registration error:', error);
    res.redirect('/error?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/register');
  }
});

/**
 * GET /login - Show login form
 */
router.get('/login', (req, res) => {
  res.render('login');
});

/**
 * POST /login - Authenticate user
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.redirect('/login?error=' + encodeURIComponent('Username and password are required'));
    }
    
    // Find user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      // Don't reveal if username exists (security best practice)
      return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
    }
    
    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
    }
    
    // Successful login - update last login time
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
      .run(user.id);
    
    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isLoggedIn = true;
    
    // Redirect to success page
    res.redirect(`/login-success?username=${encodeURIComponent(user.username)}`);
    
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/error?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/login');
  }
});

/**
 * GET /logout - Logout user (GET version for easy link access)
 */
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/error?message=' + encodeURIComponent('An error occurred while logging out.') + '&back=/');
    }
    res.redirect('/logged-out');
  });
});

/**
 * POST /logout - Logout user (POST version)
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/error?message=' + encodeURIComponent('An error occurred while logging out.') + '&back=/');
    }
    res.redirect('/logged-out');
  });
});

/**
 * GET /me - Get current user info (requires authentication)
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/error?message=' + encodeURIComponent('You must be logged in to view this page.') + '&back=/login');
  }
  
  const user = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ?')
    .get(req.session.userId);
  
  if (!user) {
    return res.redirect('/error?message=' + encodeURIComponent('User not found in database.') + '&back=/');
  }
  
  // Pass user data as query parameters to the profile page
  const params = new URLSearchParams({
    id: user.id,
    username: user.username,
    created_at: user.created_at || 'N/A',
    last_login: user.last_login || 'Never'
  });
  
  res.redirect(`/profile?${params.toString()}`);
});

router.get('/register-success', (req, res) => {
  res.render('register-success');
});

router.get('/login-success', (req, res) => {
  res.render('login-success');
});

router.get('/error', (req, res) => {
  res.render('error');
});

router.get('/logged-out', (req, res) => {
  res.render('logged-out');
});

router.get('/profile', (req, res) => {
  res.render('profile');
});

module.exports = router;

