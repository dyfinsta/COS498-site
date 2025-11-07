const express = require('express');
const session = require('express-session');
const hbs = require('hbs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const users = [];
const comments = [];

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up Handlebars
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register partials directory
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Session middleware configuration - Add this block
app.use(session({
    secret: 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 
    }
}));

// API Routes
// Note: We don't include '/api' in our routes because nginx strips it when forwarding
// nginx receives: http://localhost/api/users
// nginx forwards to: http://backend-nodejs:3000/users (without /api)
app.get('/', (req, res) => {
  let user = {
    name: 'Guest',
    isLoggedIn: false,
    loginTime: null,
    visitCount: 0,
  };

  if (req.session.isLoggedIn) {
    user = {
      name: req.session.username,
      isLoggedIn: true,
      loginTime: req.session.loginTime,
      visitCount: req.session.visitCount || 0,
    };
    req.session.visitCount = (req.session.visitCount || 0) + 1;
  }

  res.render('home', { user });
});

app.get('/login', (req, res) => {
    if (req.session.isLoggedIn) return res.redirect('/');
    res.render('login', { 
        error: req.query.error,
        user: {
            isLoggedIn: false,
            name: 'Guest'
        }
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.redirect('/login?error=1');
    }

    const user = users.find(u => u.username === username && u.password === password);
    if (!user) {
      console.log('⚠️ Login failed: Invalid credentials');
      return res.redirect('/login?error=1');
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error('Error regenerating session:', err);
        return res.redirect('/login?error=1');
      }

      req.session.isLoggedIn = true;
      req.session.username = username;
      req.session.loginTime = new Date().toLocaleString();
      req.session.visitCount = 0;

      console.log(`User ${username} logged in`);
      res.redirect('/');
    });
});

app.get('/register', (req, res) => {
    if (req.session.isLoggedIn) return res.redirect('/');
    res.render('register', { 
        error: req.query.error,
        user: {
            isLoggedIn: false,
            name: 'Guest'
        }
    });
});

app.post('/register', (req, res) => {
  const { username, password, confirm } = req.body;

  if (!username || !password || !confirm || password !== confirm) {
    console.log('⚠️ Registration failed: Missing or mismatched fields');
    return res.redirect('/register?error=1');
  }

  if (users.find(user => user.username === username)) {
    console.log('⚠️ Registration failed: Username already taken');
    return res.redirect('/register?error=1');
  }

  users.push({ username, password });
  console.log(`Registered new user: ${username}`);
  res.redirect('/login');
});

app.get('/comments', (req, res) => {
    res.render('comments', {
      title: 'Forum',
      comments: comments,
      user: {
        isLoggedIn: req.session.isLoggedIn,
        name: req.session.username
      }
    });
});

app.get('/comment/new', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/login');
    }
    res.render('new-comment', {
      title: 'Submit Comment',
      user: {
        isLoggedIn: req.session.isLoggedIn,
        name: req.session.username
      }
    });
});

app.post('/comment', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/login');
    }

    const { text } = req.body;
    if (!text) {
        return res.redirect('/comment/new');
    }

    comments.push({
        author: req.session.username,
        text: text,
        createdAt: new Date()
    });

    res.redirect('/comments');
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log('Error destroying session:', err);
    res.redirect('/');
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found'});
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
