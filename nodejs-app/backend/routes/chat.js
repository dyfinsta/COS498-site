// routes/chat.js
const express = require('express');
const router = express.Router();
const db = require('../database/database.js');
const { requireAuth } = require('../modules/auth-middleware');

// GET /chat
router.get('/chat', requireAuth, (req, res) => {
  res.render('chat', { 
    title: 'Live Chat',
    user: {
      isLoggedIn: true,
      userId: req.session.userId,
      username: req.session.username,
      displayName: req.session.displayName
    }
  });
});

// API: GET /api/chat/messages
router.get('/api/chat/messages', requireAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const stmt = db.prepare(`
      SELECT 
        cm.id,
        cm.message,
        cm.created_at,
        u.display_name,
        u.profile_avatar_url,
        u.id as user_id
      FROM chat_messages cm
      INNER JOIN users u ON cm.user_id = u.id
      ORDER BY cm.created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const messages = stmt.all(limit, offset);
    
    // Reverse to show oldest first
    messages.reverse();
    
    res.json({
      success: true,
      messages: messages,
      hasMore: messages.length === limit
    });
    
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// API: POST /api/chat/messages
router.post('/api/chat/messages', requireAuth, (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }
    
    if (message.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Message too long (max 500 characters)'
      });
    }
    
    // Store message in database
    const stmt = db.prepare(`
      INSERT INTO chat_messages (user_id, message)
      VALUES (?, ?)
    `);
    
    const result = stmt.run(req.session.userId, message.trim());
    
    // Get the complete message with user info
    const messageStmt = db.prepare(`
      SELECT 
        cm.id,
        cm.message,
        cm.created_at,
        u.display_name,
        u.profile_avatar_url,
        u.id as user_id
      FROM chat_messages cm
      INNER JOIN users u ON cm.user_id = u.id
      WHERE cm.id = ?
    `);
    
    const messageData = messageStmt.get(result.lastInsertRowid);
    
    res.json({
      success: true,
      message: messageData
    });
    
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// API: GET /api/chat/stats
router.get('/api/chat/stats', requireAuth, (req, res) => {
  try {
    const totalMessagesStmt = db.prepare('SELECT COUNT(*) as total FROM chat_messages');
    const totalMessages = totalMessagesStmt.get().total;
    
    const todayMessagesStmt = db.prepare(`
      SELECT COUNT(*) as today FROM chat_messages 
      WHERE DATE(created_at) = DATE('now')
    `);
    const todayMessages = todayMessagesStmt.get().today;
    
    res.json({
      success: true,
      stats: {
        totalMessages,
        todayMessages
      }
    });
    
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;