// routes/auth.js
const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database/database.js');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');
const loginTracker = require('../modules/login-tracker');
const { checkLoginLockout, getClientIP, requireAuth } = require('../modules/auth-middleware');

//GET /register
router.get('/register', (req, res) => {
  const error = req.session.error;
  req.session.error = null; // Clear the error after reading it
  res.render('register', { error });
});

//POST //register
router.post('/register', async (req, res) => {
  try {
    const { username, email, display_name, password, security_question, security_answer } = req.body;
    
    // Validate required fields
    if (!username || !email || !display_name || !password || !security_question || !security_answer) {
      req.session.error = 'All fields are required';
      return res.redirect('/register');
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      req.session.error = passwordValidation.errors.join(', ');
      return res.redirect('/register');
    }
    
    // Check if username or email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existingUser) {
      req.session.error = 'Username or email already exists';
      return res.redirect('/register');
    }
    
    // Hash password and security answer
    const passwordHash = await hashPassword(password);
    const securityAnswerHash = await hashPassword(security_answer.toLowerCase().trim());
    
    // Insert new user
    const stmt = db.prepare(`
      INSERT INTO users (username, email, display_name, password_hash, security_question, security_answer_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(username, email, display_name, passwordHash, security_question, securityAnswerHash);
    
    if (result.changes > 0) {
      res.redirect('/register-success');
    } else {
      req.session.error = 'Registration failed. Please try again.';
      res.redirect('/register');
    }
  } catch (error) {
    console.error('Registration error:', error);
    req.session.error = 'Registration failed. Please try again.';
    res.redirect('/register');
  }
});

//GET /login
router.get('/login', (req, res) => {
  const error = req.session.error;
  req.session.error = null; // Clear the error after reading it
  res.render('login', { error });
});

//POST /login
router.post('/login', checkLoginLockout, async (req, res) => {
  try {
    const { username, password } = req.body;
    const ipAddress = getClientIP(req);
    
    // Validate input
    if (!username || !password) {
      // Record failed attempt if username is provided
      if (username) {
        loginTracker.recordAttempt(ipAddress, username, false);
      }
      req.session.error = 'Username and password are required';
      return res.redirect('/login');
    }
    
    // Find user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      // Record failed attempt (user doesn't exist)
      loginTracker.recordAttempt(ipAddress, username, false);
      req.session.error = 'Invalid username or password';
      return res.redirect('/login');
    }
    
    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    
    if (!passwordMatch) {
      // Record failed attempt
      loginTracker.recordAttempt(ipAddress, username, false);
      req.session.error = 'Invalid username or password';
      return res.redirect('/login');
    }
    
    // Successful login
    loginTracker.recordAttempt(ipAddress, username, true);
    
    // Update last login time
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
      .run(user.id);
    
    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isLoggedIn = true;
    
    // Redirect to success page
    res.redirect('/login-success');
    
  } catch (error) {
    console.error('Login error:', error);
    req.session.error = 'An error occurred during login';
    res.redirect('/login');
  }
});

//GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/error?message=' + encodeURIComponent('An error occurred while logging out.') + '&back=/');
    }
    res.redirect('/logged-out');
  });
});

//POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/error?message=' + encodeURIComponent('An error occurred while logging out.') + '&back=/');
    }
    res.redirect('/logged-out');
  });
});

//GET /me
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

//GET /profile
router.get('/profile', requireAuth, (req, res) => {
  try {
    const stmt = db.prepare('SELECT username, email, display_name, profile_avatar_url, created_at, last_login FROM users WHERE id = ?');
    const userProfile = stmt.get(req.session.userId);
    
    if (!userProfile) {
      return res.render('error', { message: 'User not found' });
    }
    
    if (!req.session.displayName && userProfile.display_name) {
      req.session.displayName = userProfile.display_name;
    }
    
    res.render('profile', { 
      profile: userProfile,
      title: 'User Profile'
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.render('error', { message: 'Error loading profile' });
  }
});

// POST /profile/change-password
router.post('/profile/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    
    if (!current_password || !new_password || !confirm_password) {
      req.session.error = 'All password fields are required';
      return res.redirect('/profile');
    }

    if (new_password !== confirm_password) {
      req.session.error = 'New passwords do not match';
      return res.redirect('/profile');
    }

    // Get current user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    
    // Verify current password
    const passwordMatch = await comparePassword(current_password, user.password_hash);
    if (!passwordMatch) {
      req.session.error = 'Current password is incorrect';
      return res.redirect('/profile');
    }

    // Validate new password
    const validation = validatePassword(new_password);
    if (!validation.valid) {
      req.session.error = validation.errors.join(', ');
      return res.redirect('/profile');
    }

    // Hash and update password
    const newPasswordHash = await hashPassword(new_password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(newPasswordHash, req.session.userId);

    // Invalidate all sessions
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.session.userId);
    
    req.session.destroy((err) => {
      res.redirect('/login?message=Password changed successfully. Please log in again.');
    });

  } catch (error) {
    console.error('Change password error:', error);
    req.session.error = 'Error changing password';
    res.redirect('/profile');
  }
});

// POST /profile/change-email
router.post('/profile/change-email', requireAuth, async (req, res) => {
  try {
    const { current_password, new_email } = req.body;
    
    if (!current_password || !new_email) {
      req.session.error = 'Password and new email are required';
      return res.redirect('/profile');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      req.session.error = 'Please enter a valid email address';
      return res.redirect('/profile');
    }

    // Get current user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    
    // Verify current password
    const passwordMatch = await comparePassword(current_password, user.password_hash);
    if (!passwordMatch) {
      req.session.error = 'Current password is incorrect';
      return res.redirect('/profile');
    }

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(new_email, req.session.userId);
    if (existingUser) {
      req.session.error = 'Email address already in use';
      return res.redirect('/profile');
    }

    // Update email
    db.prepare('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(new_email, req.session.userId);
    
    req.session.success = 'Email address updated successfully';
    res.redirect('/profile');

  } catch (error) {
    console.error('Change email error:', error);
    req.session.error = 'Error changing email';
    res.redirect('/profile');
  }
});

// POST /profile/change-display-name
router.post('/profile/change-display-name', requireAuth, (req, res) => {
  try {
    const { new_display_name } = req.body;
    
    if (!new_display_name || new_display_name.trim().length < 2) {
      req.session.error = 'Display name must be at least 2 characters';
      return res.redirect('/profile');
    }

    if (new_display_name.length > 50) {
      req.session.error = 'Display name must be less than 50 characters';
      return res.redirect('/profile');
    }

    // Validate display name
    if (!/^[a-zA-Z0-9\s\-_.!?]+$/.test(new_display_name)) {
      req.session.error = 'Display name contains invalid characters';
      return res.redirect('/profile');
    }

    // Update display name
    db.prepare('UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(new_display_name.trim(), req.session.userId);
    
    req.session.success = 'Display name updated successfully';
    res.redirect('/profile');

  } catch (error) {
    console.error('Change display name error:', error);
    req.session.error = 'Error changing display name';
    res.redirect('/profile');
  }
});


// POST /profile/change-avatar
router.post('/profile/change-avatar', requireAuth, (req, res) => {
  try {
    const { profile_avatar_url } = req.body;
    
    let avatarUrl = '';
    if (profile_avatar_url && profile_avatar_url.trim()) {
      try {
        new URL(profile_avatar_url);
        avatarUrl = profile_avatar_url.trim().substring(0, 500);
      } catch (e) {
        req.session.error = 'Invalid image URL format';
        return res.redirect('/profile');
      }
    }

    // Update profile picture
    db.prepare('UPDATE users SET profile_avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(avatarUrl, req.session.userId);
    
    req.session.success = 'Profile picture updated successfully';
    res.redirect('/profile');

  } catch (error) {
    console.error('Change avatar error:', error);
    req.session.error = 'Error updating profile picture';
    res.redirect('/profile');
  }
});

// GET /forgot-password
router.get('/forgot-password', (req, res) => {
  const error = req.session.error;
  req.session.error = null;
  res.render('forgot-pass', { error });
});

// POST /forgot-password
router.post('/forgot-password', (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      req.session.error = 'Username is required';
      return res.redirect('/forgot-password');
    }
    
    const user = db.prepare('SELECT id, username, security_question FROM users WHERE username = ?').get(username);
    
    if (!user || !user.security_question) {
      req.session.error = 'Username not found or no security question set';
      return res.redirect('/forgot-password');
    }
    
    // Store user ID temporarily in session for verification
    req.session.resetUserId = user.id;
    
    res.render('security-question', { 
      username: user.username,
      security_question: user.security_question 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    req.session.error = 'An error occurred. Please try again.';
    res.redirect('/forgot-password');
  }
});

// POST /verify-security
router.post('/verify-security', async (req, res) => {
  try {
    const { security_answer, new_password, confirm_password } = req.body;
    const userId = req.session.resetUserId;
    
    if (!userId) {
      req.session.error = 'Session expired. Please start over.';
      return res.redirect('/forgot-password');
    }
    
    if (!security_answer || !new_password || !confirm_password) {
      req.session.error = 'All fields are required';
      return res.redirect('/forgot-password');
    }
    
    if (new_password !== confirm_password) {
      req.session.error = 'Passwords do not match';
      return res.redirect('/forgot-password');
    }
    
    // Validate new password
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      req.session.error = passwordValidation.errors.join(', ');
      return res.redirect('/forgot-password');
    }
    
    // Get user security answer hash
    const user = db.prepare('SELECT security_answer_hash, username FROM users WHERE id = ?').get(userId);
    
    if (!user) {
      req.session.error = 'User not found';
      return res.redirect('/forgot-password');
    }
    
    // Verify security answer
    const answerMatch = await comparePassword(security_answer.toLowerCase().trim(), user.security_answer_hash);
    
    if (!answerMatch) {
      req.session.error = 'Security answer is incorrect';
      return res.redirect('/forgot-password');
    }
    
    // Update password
    const newPasswordHash = await hashPassword(new_password);
    const updateStmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    updateStmt.run(newPasswordHash, userId);
    
    // Clear reset session
    req.session.resetUserId = null;
    
    res.render('password-reset-success', { username: user.username });
  } catch (error) {
    console.error('Security verification error:', error);
    req.session.error = 'An error occurred. Please try again.';
    res.redirect('/forgot-password');
  }
});

module.exports = router;

