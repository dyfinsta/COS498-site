const express = require('express');
const router = express.Router();
const db = require('../database/database.js');
const { requireAuth } = require('../modules/auth-middleware');

// Display all comments
router.get('/comments', (req, res) => {
  try {
    // Join comments with users to display user info on comments
    const stmt = db.prepare(`
      SELECT 
        c.id,
        c.content,
        c.created_at,
        c.updated_at,
        c.edited,
        c.likes_count,
        c.dislikes_count,
        u.display_name,
        u.profile_avatar_url,
        u.username
      FROM comments c
      INNER JOIN users u ON c.author_id = u.id
      ORDER BY c.created_at DESC
    `);
    
    const comments = stmt.all();
    
    res.render('comments', { 
      comments: comments,
      user: {
        isLoggedIn: req.session && req.session.userId,
        username: req.session?.username,
        displayName: req.session?.displayName
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.render('error', { message: 'Error loading comments' });
  }
});

// Comment create form
router.get('/comment/new', requireAuth, (req, res) => {
  res.render('new-comment');
});

// Create new comment
router.post('/comment/new', requireAuth, (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.render('new-comment', { 
        error: 'Comment content is required' 
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO comments (author_id, content)
      VALUES (?, ?)
    `);
    
    stmt.run(req.session.userId, content.trim());
    
    res.redirect('/comments');
  } catch (error) {
    console.error('Error creating comment:', error);
    res.render('new-comment', { 
      error: 'Error creating comment. Please try again.' 
    });
  }
});

module.exports = router;