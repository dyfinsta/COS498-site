// server.js
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('./sqlite-session-store');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const commentRoutes = require('./routes/comments');
const chatRoutes = require('./routes/chat');
const hbs = require('hbs');
const { requireAuth } = require('./modules/auth-middleware');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Set up Handlebars
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
hbs.registerPartials(path.join(__dirname, 'views/partials'));

hbs.registerHelper('formatDate', function(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString() + ' at ' + d.toLocaleTimeString();
});

hbs.registerHelper('substring', function(str, start, length) {
  if (!str) return '';
  return str.substring(start, start + length);
});

hbs.registerHelper('eq', function(a,b){
  return a === b;
});

// Session configuration with SQLite store (from Chapter 10)
const sessionStore = new SQLiteStore({
  db: path.join(__dirname, 'data', 'sessions.db'),
  table: 'sessions'
});

const sessionMiddleware = session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000
    }
});

app.use(sessionMiddleware);

app.use((req, res, next) => {
  res.locals.user = {
    isLoggedIn: req.session && req.session.userId,
    userId: req.session?.userId,
    username: req.session?.username,
    displayName: req.session?.displayName
  };
  next();
});

app.get('/', (req, res) => {
  res.render('home', { title: 'The Forum' });
});

// Routes
app.use('/', authRoutes);
app.use('/', commentRoutes);
// app.use('/', chatRoutes);

// Socket setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Share session
io.engine.use(sessionMiddleware);

// Socket connection handlr
io.on('connection', (socket) => {
  const session = socket.request.session;

  //check auth
  if (!session.isLoggedIn){
    socket.emit('error', { message: 'Authentication required'});
    socket.disconnect();
    return;
  }

  const userId = session.userId;
  const username = session.username;
  const displayName = session.displayName;

  console.log(`User ${displayName} (${username}) connected to chat`);

  //join chat
  socket.join('chat');

  socket.to('chat').emit('userJoined', {
    displayName: displayName,
    message: `${displayName} joined chat`
  });

  //new messages
  socket.on('sendMessage', async (data) => {
    try {
      const db = require('./database/database');

      const stmt = db.prepare(`
        INSERT INTO chat_messages (user_id, message)
        VALUES (?, ?)
      `);
      
      const result = stmt.run(userId, data.message);
      
      // Get user profile info for the message
      const userStmt = db.prepare(`
        SELECT display_name, profile_avatar_url FROM users WHERE id = ?
      `);
      const userInfo = userStmt.get(userId);
      
      // Broadcast message to all users in the chat room
      const messageData = {
        id: result.lastInsertRowid,
        message: data.message,
        displayName: userInfo.display_name,
        profileAvatarUrl: userInfo.profile_avatar_url,
        timestamp: new Date().toISOString(),
        userId: userId
      };
      
      // Send to all users in the chat room (including sender)
      io.to('general-chat').emit('newMessage', messageData);
      
    } catch (error) {
      console.error('Error saving chat message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User ${displayName} disconnected from chat`);
    
    // Notify others that user left
    socket.to('general-chat').emit('userLeft', {
      displayName: displayName,
      message: `${displayName} left the chat`
    });
  });
});

// Protected route example (doing this manually by sending)
app.get('/api/protected', requireAuth, (req, res) => {
  res.send(
    `Protected route that needs authentication. User: ${req.session.username} ID: ${req.session.userId}`
  );
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  sessionStore.close();
  process.exit(0);
});
