const express = require('express');
const router = express.Router();
const db = require('../database/database.js');
const { requireAuth } = require('../modules/auth-middleware');

// Display all comments with pagination
router.get('/comments', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const countStmt = db.prepare('SELECT COUNT(*) as total FROM comments');
    const { total } = countStmt.get();
    
    // Get comments for current page
    const stmt = db.prepare(`
      SELECT 
        c.id,
        c.author_id,
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
      LIMIT ? OFFSET ?
    `);
    
    const comments = stmt.all(limit, offset);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;
    
    res.render('comments', { 
      comments: comments,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        hasNext: hasNext,
        hasPrev: hasPrev,
        nextPage: hasNext ? page + 1 : null,
        prevPage: hasPrev ? page - 1 : null,
        total: total
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

// Comment edit form
router.get('/comment/:id/edit', requireAuth, (req, res) => {
  try {
    const commentId = req.params.id;
    
    // Get the comment and verif user
    const stmt = db.prepare(`
      SELECT c.*, u.display_name, u.username 
      FROM comments c
      INNER JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `);
    
    const comment = stmt.get(commentId);
    
    if (!comment) {
      return res.render('error', { message: 'Comment not found' });
    }
    
    if (comment.author_id !== req.session.userId) {
      return res.render('error', { 
        message: 'You can only edit your own comments' 
      });
    }
    
    res.render('edit-comment', { comment });
  } catch (error) {
    console.error('Error loading comment for edit:', error);
    res.render('error', { message: 'Error loading comment' });
  }
});

// Edit a comment
router.post('/comment/:id/edit', requireAuth, (req, res) => {
  try {
    const commentId = req.params.id;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      const stmt = db.prepare('SELECT * FROM comments WHERE id = ?');
      const comment = stmt.get(commentId);
      
      return res.render('edit-comment', { 
        comment,
        error: 'Comment content is required' 
      });
    }
    
    // Verify ownership before updating
    const checkStmt = db.prepare('SELECT author_id FROM comments WHERE id = ?');
    const comment = checkStmt.get(commentId);
    
    if (!comment) {
      return res.render('error', { message: 'Comment not found' });
    }
    
    if (comment.author_id !== req.session.userId) {
      return res.render('error', { 
        message: 'You can only edit your own comments' 
      });
    }
    
    // Update the comment
    const updateStmt = db.prepare(`
      UPDATE comments 
      SET content = ?, updated_at = CURRENT_TIMESTAMP, edited = 1
      WHERE id = ? AND author_id = ?
    `);
    
    const result = updateStmt.run(content.trim(), commentId, req.session.userId);
    
    if (result.changes === 0) {
      return res.render('error', { message: 'Failed to update comment' });
    }
    
    res.redirect('/comments');
  } catch (error) {
    console.error('Error updating comment:', error);
    res.render('error', { message: 'Error updating comment' });
  }
});

// Delete comment
router.post('/comment/:id/delete', requireAuth, (req, res) => {
  try {
    const commentId = req.params.id;
    
    // Verify user before deleting
    const checkStmt = db.prepare('SELECT author_id FROM comments WHERE id = ?');
    const comment = checkStmt.get(commentId);
    
    if (!comment) {
      return res.render('error', { message: 'Comment not found' });
    }
    
    if (comment.author_id !== req.session.userId) {
      return res.render('error', { 
        message: 'You can only delete your own comments' 
      });
    }
    
    const deleteStmt = db.prepare('DELETE FROM comments WHERE id = ? AND author_id = ?');
    const result = deleteStmt.run(commentId, req.session.userId);
    
    if (result.changes === 0) {
      return res.render('error', { message: 'Failed to delete comment' });
    }
    
    res.redirect('/comments');
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.render('error', { message: 'Error deleting comment' });
  }
});

module.exports = router;