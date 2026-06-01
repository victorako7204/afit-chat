# AFIT Chat

A full-stack campus communication and learning platform for the Air Force Institute of Technology (AFIT), Nigeria. Features real-time chat, academic tools, AI-powered module generation, quiz simulator, games, and a digital library.

## Tech Stack

**Frontend:** React 18, React Router v6, Tailwind CSS, Socket.io-client, Axios, Framer Motion, KaTeX, react-pdf

**Backend:** Node.js, Express, Socket.io, Mongoose ODM, JWT auth, Nodemailer

**Database:** MongoDB (MongoDB Atlas)

**AI:** DeepSeek API (primary) with multi-model OpenRouter fallback chain

**Deployment:** Frontend → Vercel (SPA), Backend → Render.com, Database → MongoDB Atlas

## Features

### Communication
- **Public Chat** — real-time campus-wide message board
- **Direct Messages** — private one-on-one conversation with read receipts
- **Group Chat** — create/join groups by invite code, admin controls, lock/unlock
- **Anonymous Chat** — post anonymously to the community

### Social
- **Feed** — campus feed with posts, likes, comments, anonymous posting
- **Lost & Found** — report and claim lost items
- **User Profiles** — bio, skills, department, points ranking
- **Leaderboard** — competitive ranking by points and game wins

### Academic Tools
- **Education Hub** — browse AI-generated learning modules by subject
- **AI Module Generator** — enter a topic, get a structured lesson with LaTeX math and quiz questions (powered by DeepSeek + OpenRouter fallback)
- **Quiz Simulator** — past questions from PHY102 and MTH102 with instant scoring and LaTeX rendering
- **Digital Library** — upload and browse PDF textbooks/resources with built-in PDF viewer
- **Past Questions Vault** — upload and browse past question PDFs/images with filter by course code

### Games
- **Chess** — play against friends or AI with Stockfish-level engine
- **Tic-Tac-Toe** — multiplayer room-based matches
- **Educational Arcade** — 4 mini-games teaching logic, networking, and data structures

### Admin
- User management (suspend, restrict, change roles)
- Content moderation
- Announcement broadcasts

## Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB (local or Atlas)
- npm

### Clone & Install

```bash
git clone https://github.com/victorako7204/afit-chat.git
cd afit-chat

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Environment Variables

Create `server/.env`:

```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/afit-chat
JWT_SECRET=<your-secret>

# AI Generation (at least one required)
DEEPSEEK_API_KEY=sk-<your-key>
OPENROUTER_API_KEY=sk-or-<your-key>

# Optional: File uploads via Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Optional: Forgot-password email (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<app-password>
SMTP_FROM=noreply@afit-chat.com
CLIENT_URL=http://localhost:3000

# Optional: Push notifications (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

### Run Locally

```bash
# Terminal 1 — Backend (port 10000)
cd server && npm run dev

# Terminal 2 — Frontend (port 3000)
cd client && npm start
```

### Seed the Question Bank

```bash
cd server
MONGO_URI=mongodb://localhost:27017/afit-chat node seedQuestions.js
```

## Project Structure

```
afit-chat/
├── client/                    # React frontend
│   └── src/
│       ├── pages/             # 21 route-level page components
│       ├── components/        # 8 shared components (Navbar, TopNav, BottomNav,
│       │   ├── UI/            #   Sidebar, PDFViewer, PastQuestionVault, etc.)
│       │   └── ...            # Reusable UI primitives (Button, Card, Modal, etc.)
│       ├── context/           # AuthContext, NotificationContext, OnlineUsersContext
│       ├── services/          # api.js (Axios), socket.js, notificationService.js
│       ├── games/             # Educational arcade games
│       └── hooks/             # Custom React hooks
├── server/                    # Express + Socket.io backend
│   ├── routes/                # 14 route modules
│   ├── controllers/           # 9 controller modules
│   ├── models/                # 13 Mongoose schemas
│   ├── middleware/            # auth, admin, errorHandler
│   ├── services/              # aiContentService (DeepSeek + OpenRouter)
│   └── uploads/               # Local file storage
├── vercel.json                # Vercel frontend deployment config
└── VERCEL_DEPLOY.md           # Deployment guide
```

## API Overview

All endpoints are mounted under `/api`:

| Prefix | Purpose |
|--------|---------|
| `/api/auth` | Register, login, profile, forgot/reset password |
| `/api/chat` | Messages, conversations, anonymous chat |
| `/api/posts` | Campus feed posts and interactions |
| `/api/education` | Learning modules CRUD and enrollment |
| `/api/lessons` | AI module generation |
| `/api/library` | Book/resource library uploads |
| `/api/past-questions` | Past question file upload and listing |
| `/api/questions` | Quiz question bank (PHY102/MTH102) |
| `/api/groups` | Group chat management |
| `/api/games` | Game state, leaderboard, notifications |
| `/api/leaderboard` | Points ranking |
| `/api/lost-and-found` | Lost item reports |
| `/api/notifications` | Push notifications, announcements |
| `/api/admin` | User moderation and role management |

Real-time events via Socket.io handle chat messaging, game moves, online presence, and leaderboard updates.

## Deployment

### Frontend (Vercel)
```bash
vercel --prod
```

### Backend (Render.com)
1. Push to GitHub
2. Create a new Web Service on Render
3. Set build command: `cd server && npm install`
4. Set start command: `node server/server.js`
5. Add environment variables from `.env`
6. Ensure WebSocket support is enabled

### Database (MongoDB Atlas)
1. Create a free cluster
2. Whitelist Render's IP or allow all (`0.0.0.0/0`)
3. Copy the connection string to `MONGO_URI`
