const express = require('express');
const path = require('path');
const hbs = require('hbs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

const users = [];
const comments = [];

app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

function getUser(req) {
  return req.cookies.user || null;
}

app.get('/', (req, res) => {
  const user = getUser(req);
  res.render('home', { user });
});

// Register form
app.get('/register', (req, res) => {
  res.render('register');
});

// Handle registration
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const existing = users.find((u) => u.username === username);

  if (existing) {
    return res.render('register', { error: 'Username already exists!' });
  }

  users.push({ username, password });
  res.redirect('/login');
});

// Login form
app.get('/login', (req, res) => {
  res.render('login');
});

// Handle login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username && u.password === password);

  if (!user) {
    return res.render('login', { error: 'Invalid username or password!' });
  }

  //cookies
  res.cookie('user', username, { httpOnly: false });
  res.redirect('/comments');
});

// Logout
app.post('/logout', (req, res) => {
  res.clearCookie('user');
  res.redirect('/');
});

// View comments
app.get('/comments', (req, res) => {
  const user = getUser(req);
  res.render('comments', { comments, user });
});

// New comment form
app.get('/comment/new', (req, res) => {
  const user = getUser(req);
  if (!user) return res.redirect('/login');
  res.render('new-comment', { user });
});

// Submit new comment
app.post('/comment', (req, res) => {
  const user = getUser(req);
  if (!user) return res.redirect('/login');

  comments.push({ author: user, text: req.body.comment, createdAt: new Date() });
  res.redirect('/comments');
});

// Start server
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

