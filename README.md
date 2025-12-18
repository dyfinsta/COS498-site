### COS498 Website

A forum application built with nodejs, express and socket io for COS 498 Server Side Web Development

## CORE FUNCTIONALITY
- **User Authentication**
  - User registration with password validation
  - Secure login/logout system
  - Session based authentication
  - Password recovery via security questions
  - Account lockout for too many failed login attempts

- **Comment System**
  - Create, edit and delete comments
  - Paginated comment feed
  - User avatars and profile integration
  - Author only edit and delete permissions

- **Real Time Chat**
  - Live messaging via socket io
  - Message persistence in database
  - Character limit of 500
  - Must be logged in to access

- **User Profile Managemnet**
  - Change passwrd, email and display name
  - Profile avatar customizable via image URL
  - Profile veiwing and editing
 
## Database Schema
// User table 
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    security_question TEXT,
    security_answer_hash TEXT,
    failed_attempts INTEGER DEFAULT 0,
    locked_until DATETIME NULL,
    profile_avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Sessions table
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// login attempts table
db.exec(`
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 0,
    failure_reason TEXT
  )
`);

// Comments
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL,
    parent_comment_id INTEGER,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited BOOLEAN DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    dislikes_count INTEGER DEFAULT 0,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
  )
`);

// Chat messages table
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

## Routes
- Chat Routes
  - GET /chat - Chat interface
  - GET /api/chat/messages - Fetch chat history
  - POST /api/chat/messages - Send message (API)
  - GET /api/chat/stats - Chat statistics

## Security Strengths
- Strong password policy
- Modern hashing with argon2
- Brute force mitigation
- Secure Sessions
 
## Current Limitations
- Server could probaly just stop working at any time
- Limited concurrent writes for SQLite
- File upload security
- Zero content filtering as demonstrated in the submission video

## Installation and Setup

### Prereqs
- Node.js v14 or higher
- npm

### Installation
```bash
# clone the repo
git clone https://github.com/dyfinsta/COS498-site
cd nodejs-app

npm install

docker compose build
docker compose up
