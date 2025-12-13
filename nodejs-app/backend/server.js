const express = require('express');
const session = require('express-session');
const router = express.Router();
const hbs = require('hbs');
const path = require('path');
//module imports
const { validatePassword, hashPassword, comparePassword } = require('./modules/password-utils');

//database import
const {
  db,
  getUserByName,
  getUserByEmail,
  createUser,
  getAllComments,
  addComment,
  recordLoginAttempt,
  updateUserLockout,
  resetFailedLoginAttempts
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up Handlebars
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Register partials directory
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Register handlebars helpers
hbs.registerHelper('eq', function(a, b) {
    return a === b;
});

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

//home
app.get('/', (req, res) => {
  res.render('home', {
    user: {
      isLoggedIn: req.session.isLoggedIn || false,
      name: req.session.username || 'Guest',
      loginTime: req.session.loginTime || null,
      visitCount: req.session.visitCount || 0
    }
  });

  if (req.session.isLoggedIn) {
    req.session.visitCount = (req.session.visitCount || 0) + 1;
  }
});

//login
app.get('/login', (req, res) => {
  if (req.session.isLoggedIn) return res.redirect('/');
  res.render('login', { error: req.query.error });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.redirect('/login?error=missing');

  const user = getUserByName.get(username);
  if (!user) return res.redirect('/login?error=no_user');

  if (user.password !== password) {
    return res.redirect('/login?error=wrong_password');
  }

  req.session.regenerate(err => {
    if (err) return res.redirect('/login?error=1');

    req.session.isLoggedIn = true;
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.loginTime = new Date().toLocaleString();
    req.session.visitCount = 0;

    res.redirect('/');
  });
});

// Register
app.get('/register', (req, res) => {
  if (req.session.isLoggedIn) return res.redirect('/');
  res.render('register', { error: req.query.error });
});

app.post('/register', (req, res) => {
  const { username, password, confirm } = req.body;
  if (!username || !password || !confirm) {
    return res.redirect('/register?error=missing');
  }

  if (password !== confirm) {
    return res.redirect('/register?error=mismatch');
  }

  const exists = getUserByName.get(username);
  if (exists) return res.redirect('/register?error=taken');

  createUser.run(username, password);
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

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found'});
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
