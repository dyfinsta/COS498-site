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
