const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

// Enable foreign key constraints
db.pragma('foreign_keys = ON');

//create tables
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Profile customization fields
    profile_color TEXT DEFAULT '#000000',
    profile_icon TEXT,
    profile_bio TEXT,
    
    -- Account lockout fields
    lockout_until DATETIME,
    failed_login_attempts INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
`);

module.exports = {
  db,
  
  //user queries
  getUserByName: db.prepare("SELECT * FROM users WHERE username = ?"),
  getUserByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  createUser: db.prepare("INSERT INTO users (username, email, display_name, password) VALUES (?, ?, ?, ?)"),
  
  //comment queries
  getAllComments: db.prepare(`
    SELECT comments.*, users.display_name as author, comments.created_at as createdAt
    FROM comments 
    JOIN users ON users.id = comments.user_id 
    ORDER BY comments.created_at DESC
  `),
  addComment: db.prepare("INSERT INTO comments (user_id, text) VALUES (?, ?)"),
  
  //login tracking
  recordLoginAttempt: db.prepare("INSERT INTO login_attempts (username, ip_address, success) VALUES (?, ?, ?)"),
  
  //lockout management
  updateUserLockout: db.prepare("UPDATE users SET lockout_until = ?, failed_login_attempts = ? WHERE id = ?"),
  resetFailedLoginAttempts: db.prepare("UPDATE users SET failed_login_attempts = 0 WHERE id = ?")
};