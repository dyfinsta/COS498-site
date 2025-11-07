const express = require('express');
const session = require('express-session');
const hbs = require('hbs');
const path = require('path');
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

// Session middleware configuration - Add this block
app.use(session({
    secret: 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// API Routes
// Note: We don't include '/api' in our routes because nginx strips it when forwarding
// nginx receives: http://localhost/api/users
// nginx forwards to: http://backend-nodejs:3000/users (without /api)
app.get('/', (req, res) => {
  console.log("Trying rto render hmoe");
    res.render('home',{
      title: 'The Forum'
    })
});

app.get('/login', (req, res) => {
    res.render('login',{
      title: 'Forum Login'
    })
});

app.post('/login', (req, res) => {
    
});

app.get('/register', (req, res) => {
    res.render('register',{
      title: 'Forum Register'
    })
});

app.post('/register', (req, res) => {
    
});

app.get('/comments', (req, res) => {
    res.render('comments',{
      title: 'Forum'
    })
});

app.post('/comments', (req, res) => {
    
});

app.get('/new-comment', (req, res) => {
    res.render('new-comment',{
      title: 'Submit Comment'
    })
});

app.post('/new-comment', (req, res) => {
    
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found'});
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
