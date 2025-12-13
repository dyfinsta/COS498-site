const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'myapp.db');
const db = new Database(dbPath);

// Minimal tables required for your project
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
`);

module.exports = {
  db,
  getUserByName: db.prepare("SELECT * FROM users WHERE username = ?"),
  createUser: db.prepare("INSERT INTO users (username, password) VALUES (?, ?)"),
  getAllComments: db.prepare("SELECT comments.*, users.username FROM comments JOIN users ON users.id = comments.user_id"),
  addComment: db.prepare("INSERT INTO comments (user_id, text, created_at) VALUES (?, ?, ?)")
};
