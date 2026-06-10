# AFIT Chat — MVP Architecture & Structure Guide

## 1. Project Overview

AFIT Chat is a full-stack social/academic platform for the Air Force Institute of Technology (AFIT). It combines real-time chat (Socket.io), a social feed, educational modules with AI generation, games (Chess + TicTacToe), a library with PDF viewer, past question vault, lost & found, leaderboards, and push notifications.

**Stack:**
- **Frontend:** React 18 + Tailwind CSS + Socket.io Client
- **Backend:** Node.js + Express + Socket.io + MongoDB (Mongoose)
- **AI:** DeepSeek API (primary) + OpenRouter fallback
- **Hosting:** Vercel (frontend) + Render.com (backend) + MongoDB Atlas

---

## 2. Directory Structure

```
afit-chat/
├── client/                          # React frontend (Vercel)
│   ├── public/
│   ├── src/
│   │   ├── index.js                 # ReactDOM entry point
│   │   ├── index.css                # Global CSS + design tokens + animations
│   │   ├── App.js                   # Root component, routing, responsive layout
│   │   ├── components/
│   │   │   ├── BottomNav.js         # Mobile 5-tab bottom navigation
│   │   │   ├── Sidebar.js           # Desktop 244px left sidebar
│   │   │   ├── TopNav.js            # Mobile top header (logo/back arrow)
│   │   │   ├── MoreDrawer.js        # Mobile bottom sheet for secondary pages
│   │   │   ├── PostCard.jsx         # Instagram-style feed post card
│   │   │   ├── StoryBar.jsx         # Story ring row component
│   │   │   ├── PDFViewer.jsx        # In-app PDF viewer
│   │   │   ├── PastQuestionVault.jsx # Past questions browser
│   │   │   ├── SplashScreen.js      # App loading splash
│   │   │   ├── Navbar.js            # Legacy navbar
│   │   │   ├── GlobalAlert.js       # Global notification alerts
│   │   │   └── UI/                  # Reusable UI primitives
│   │   │       ├── index.js         # Barrel exports
│   │   │       ├── Button.js
│   │   │       ├── Card.js
│   │   │       ├── Input.js
│   │   │       ├── Textarea.js
│   │   │       ├── Modal.js
│   │   │       ├── Select.js
│   │   │       └── ChatBubble.js
│   │   ├── pages/                   # Route-level page components
│   │   │   ├── Feed.js              # Social feed (default landing page)
│   │   │   ├── Explore.js           # Discovery grid with search
│   │   │   ├── Profile.js           # User profile with tabs + edit
│   │   │   ├── EducationHub.js      # Module gallery + player + creation
│   │   │   ├── DirectChat.js        # DM conversations + chat view
│   │   │   ├── PublicChat.js        # Public chat room
│   │   │   ├── Groups.js            # Group chat list
│   │   │   ├── GroupChat.js         # Individual group chat
│   │   │   ├── Library.js           # PDF resource library
│   │   │   ├── QuizSimulator.jsx    # Past question exam mode
│   │   │   ├── GameLobby.js         # Game room lobby
│   │   │   ├── ChessGame.js         # Chess (PvP + AI)
│   │   │   ├── TicTacToe.js         # TicTacToe (PvP)
│   │   │   ├── GameArcade.jsx       # Educational arcade games
│   │   │   ├── LostAndFound.js      # Lost & found items grid
│   │   │   ├── LeaderboardPage.js   # Podium + ranked list
│   │   │   ├── Notifications.js     # Activity feed
│   │   │   ├── Dashboard.js         # Legacy dashboard
│   │   │   ├── Login.js             # Login page
│   │   │   ├── Register.js          # Registration page
│   │   │   ├── AnonymousChat.js     # Anonymous messaging
│   │   │   ├── AdminDashboard.js    # Admin panel
│   │   │   └── AdminPanel.js        # Secondary admin page
│   │   ├── context/
│   │   │   ├── AuthContext.js       # Auth state + JWT management
│   │   │   ├── OnlineUsersContext.js # Socket-based online presence
│   │   │   └── NotificationContext.js # Push + in-app notifications
│   │   ├── services/
│   │   │   ├── api.js               # Axios instance + all API calls
│   │   │   ├── socket.js            # Socket.io connection + events
│   │   │   └── notificationService.js # Push notification registration
│   │   ├── hooks/
│   │   │   └── usePushNotifications.js # Push notification React hook
│   │   └── games/
│   │       ├── components/          # Arcade game components
│   │       │   ├── VectorGame.jsx
│   │       │   ├── StructuralGame.jsx
│   │       │   ├── PacketGame.jsx
│   │       │   └── LogicGame.jsx
│   │       ├── engines/             # Game physics/mechanics
│   │       │   ├── VectorEngine.js
│   │       │   ├── StructuralEngine.js
│   │       │   ├── PacketEngine.js
│   │       │   └── LogicEngine.js
│   │       └── hooks/
│   │           └── useGameLoop.js   # Canvas game loop hook
│   ├── package.json                  # Dependencies + scripts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── .env.example
│   └── .env.production               # Production API URLs
│
├── server/                           # Express backend (Render)
│   ├── server.js                     # Entry point: Express + Socket.io + MongoDB
│   ├── .env                          # Environment variables (NOT committed)
│   ├── .env.example                  # Template for env vars
│   ├── package.json
│   ├── vercel.json                   # Vercel serverless config (if deployed)
│   ├── chessAI.js                    # Chess AI engine
│   ├── seedQuestions.js              # Database seeding script
│   ├── questionsDataPool_v3.json     # 1500+ past questions dataset
│   ├── config/
│   │   └── cloudinary.js             # Cloudinary media upload config
│   ├── middleware/
│   │   ├── auth.js                   # JWT authentication middleware
│   │   ├── admin.js                  # Admin role middleware
│   │   └── errorHandler.js           # Global error handler
│   ├── routes/                       # Express route definitions
│   │   ├── auth.js                   # POST /login, /register
│   │   ├── chat.js                   # Chat message endpoints
│   │   ├── posts.js                  # Social feed CRUD
│   │   ├── education.js              # Module CRUD + enrollment
│   │   ├── lessonRoute.js            # AI module generation endpoint
│   │   ├── library.js                # Resource upload/download
│   │   ├── pastQuestionFileRoute.js  # Past question file management
│   │   ├── questionRoute.js          # Quiz question bank
│   │   ├── group.js                  # Group chat CRUD
│   │   ├── game.js                   # Game state management
│   │   ├── lostAndFound.js           # Lost & found CRUD
│   │   ├── leaderboard.js            # Leaderboard queries
│   │   ├── notifications.js          # Notification CRUD
│   │   └── admin.js                  # Admin operations
│   ├── controllers/                  # Business logic
│   │   ├── authController.js         # Register/login logic
│   │   ├── chatController.js         # Message history
│   │   ├── educationController.js    # Module CRUD logic
│   │   ├── libraryController.js      # Resource management
│   │   ├── groupController.js        # Group chat logic
│   │   ├── gameController.js         # Game state logic
│   │   ├── lostAndFoundController.js
│   │   ├── leaderboardController.js
│   │   ├── NotificationController.js
│   │   └── postController.js (in routes/posts.js)
│   ├── models/                       # Mongoose schemas
│   │   ├── User.js                   # User accounts + points + wins
│   │   ├── Chat.js                   # Chat messages
│   │   ├── Conversation.js           # DM conversation tracking
│   │   ├── Post.js                   # Social feed posts
│   │   ├── Module.js                 # Education modules + stages
│   │   ├── Game.js                   # Chess/TTT game state
│   │   ├── Library.js                # Resource library entries
│   │   ├── LostAndFound.js           # Lost/found item reports
│   │   ├── Group.js                  # Group chat rooms
│   │   ├── Question.js               # Past question bank
│   │   ├── PastQuestionFile.js       # Past question file metadata
│   │   ├── Notification.js           # Notification records
│   │   └── PushSubscription.js       # Web push subscriptions
│   └── services/
│       └── aiContentService.js       # DeepSeek + OpenRouter AI calls
│
├── package.json                      # Root (workspace config)
├── VERCEL_DEPLOY.md                  # Deployment instructions
└── MVP_ARCHITECTURE.md               # This file
```

---

## 3. How the Frontend Works

### 3.1 Entry Point (`client/src/index.js`)
Renders `<App />` into the DOM. Wraps with `AuthProvider` (from `AuthContext`).

### 3.2 Root Component (`client/src/App.js`)
The central orchestrator. It:

- **Forces dark mode** (always `darkMode: true`, no toggle).
- **Renders routes** inside `<Router>`, `<OnlineUsersProvider>`, `<NotificationProvider>`.
- **Uses `AppLayout`** which is responsive:
  - **Mobile (<768px):** Shows `<TopNav />` + content + `<BottomNav />`.
  - **Desktop (≥768px):** Shows `<Sidebar />` + content (offset by `--sidebar-width`). Bottom nav and top nav are hidden.
  - A `<MoreDrawer />` bottom sheet is available on mobile for secondary pages.
- **PrivateRoute** wraps authenticated pages. If user is not logged in, redirects to `/login`.
- **`/feed` is the default landing page** after login (`Navigate` from `/` and from `/login`).

### 3.3 Navigation System

**Mobile Bottom Nav (BottomNav.js):**
- 5 fixed tabs: Home (`/feed`), Explore (`/explore`), Create (`+` button → navigates to `/feed`), Learn (`/education`), Profile (`/profile`)
- A 6th "More" button opens the `<MoreDrawer />` bottom sheet
- Active tab shown with `--accent` color

**Desktop Sidebar (Sidebar.js):**
- Fixed left sidebar, 244px wide (`--sidebar-width`)
- Logo "AFIT" at top
- Main nav: Home, Explore, Learn, Profile
- Secondary nav: Messages, Library, Games, Quiz, Leaderboard, Lost & Found, Notifications
- Bottom: Admin link (if admin role), user card with avatar + logout

**More Drawer (MoreDrawer.js):**
- Mobile bottom sheet with 3-column icon grid
- All secondary pages: Messages, Public Chat, Groups, Anonymous Chat, Library, Games, Quiz, Leaderboard, Lost & Found, Notifications
- Admin Panel if admin role

**Top Nav (TopNav.js):**
- Shows "AFIT" logo on root routes
- Shows back arrow on deep routes

### 3.4 State Management (Contexts)

| Context | File | Purpose |
|---------|------|---------|
| `AuthContext` | `context/AuthContext.js` | JWT token, user object, login/logout/register functions. Persists token in `localStorage`. Auto-restores session on reload. |
| `OnlineUsersContext` | `context/OnlineUsersContext.js` | Real-time online user IDs from Socket.io. Used for green dots on avatars. |
| `NotificationContext` | `context/NotificationContext.js` | In-app notification state + unread counts. |
| `ThemeContext` | `App.js` | Always returns `{ darkMode: true }`. Kept for backward compatibility. |

### 3.5 API Layer (`client/src/services/api.js`)

Creates an Axios instance with:
- **Base URL** from `process.env.REACT_APP_API_URL`
- **Auth interceptor**: Attaches JWT token from `localStorage` to every request as `Authorization: Bearer <token>`
- **Error interceptor**: Handles 401 (redirect to login), 503/504 (custom error messages for server waking up vs actual server errors)

**All API call groups:**

| Export | Base path | Key methods |
|--------|-----------|-------------|
| `authAPI` | `/auth` | `login`, `register` |
| `postsAPI` | `/posts` | `getPosts`, `createPost`, `likePost`, `comment` |
| `chatAPI` | `/chat` | `getMessages`, `sendMessage` |
| `educationAPI` | `/education` + `/lessons` | `getPublicModules`, `generateModule` (POST `/lessons/generate`), `createModule`, `enroll`, `getStats` |
| `libraryAPI` | `/library` | `getResources`, `uploadResource`, `deleteResource` |
| `groupAPI` | `/groups` | `getGroups`, `createGroup`, `getMessages`, `sendMessage` |
| `lostAndFoundAPI` | `/lost-and-found` | `getItems`, `reportItem`, `claimItem` |
| `gameAPI` | `/games` | Game state CRUD |
| `leaderboardAPI` | `/leaderboard` | `getLeaderboard`, `getRanking` |
| `notificationAPI` | `/notifications` | `getNotifications`, `markRead` |
| `questionAPI` | `/questions` | `getQuestionsByCourse` |
| `pastQuestionFileAPI` | `/past-questions` | File upload/download |
| `adminAPI` | `/admin` | Admin operations |

### 3.6 Socket.io (`client/src/services/socket.js`)

Creates a Socket.io connection to `process.env.REACT_APP_SOCKET_URL`.

**Exported functions:**
- `connectSocket(userId)` — Connect + authenticate
- `joinRoom(chatId)` — Join a chat room
- `leaveRoom(chatId)` — Leave a chat room
- `sendMessageSocket(data)` — Emit a new message
- `socket` — The raw socket instance for custom listeners

**Key events:**
- `receiveMessage` — New message in a joined room
- `messageDeleted` — Message deletion notification
- `onlineUsersList` — Updated online user list
- `userConnected` — A user came online
- `gameStarted`, `moveMade`, `gameEnded` — Chess/TTT events
- `tttUpdateBoard`, `tttGameOver` — TicTacToe events

### 3.7 Design System (`client/src/index.css`)

All global styles are CSS custom properties (no CSS-in-JS):

```
--bg-primary:  #000000    (main background)
--bg-secondary:#121212    (cards, inputs, nav)
--bg-tertiary: #1C1C1C    (hover, secondary surfaces)
--text-primary:#F5F5F5    (headings)
--text-secondary:#A8A8A8  (captions)
--text-tertiary:#737373    (placeholders)
--accent:      #0095F6    (buttons, links, active)
--border:      #262626    (dividers)
--danger:      #ED4956    (errors, delete)
--success:     #00D26A    (online dot, success)
```

**CSS classes defined:**
- `.story-ring` — Gradient-bordered circle for stories
- `.chat-bubble-me` / `.chat-bubble-them` — Chat bubble styles
- `.skeleton` — Loading shimmer animation
- `.toast` — Toast notification popup
- `.btn-press` — Button press scale animation
- Animations: `slideDown`, `slideUp`, `fadeIn`, `scaleIn`, `heartPop`, `storySpin`, `shimmer`

**Tailwind overrides:**
- `.bg-white` → `--bg-primary`
- `.text-gray-900` through `.text-gray-400` → `--text-primary` / `--text-secondary`
- `.shadow-*` → `none` (Instagram uses 1px borders, not shadows)
- `.rounded-*` → custom radius values

---

## 4. How the Backend Works

### 4.1 Entry Point (`server/server.js`)

1. Loads `.env` (dotenv)
2. Creates Express app + HTTP server + Socket.io
3. Configures CORS (allow Vercel domain + localhost)
4. Mounts all route groups at their prefixes (see Route Table below)
5. Connects to MongoDB; auto-seeds 1500+ questions if DB is empty
6. Sets up Socket.io event handlers for chat, games, online presence
7. Starts listening on `process.env.PORT || 10000`

### 4.2 Route Table

| Prefix | Router File | Key Endpoints |
|--------|-------------|---------------|
| `/api/auth` | `routes/auth.js` | `POST /login`, `POST /register`, `GET /me` |
| `/api/chat` | `routes/chat.js` | `GET /:chatId` (message history with pagination) |
| `/api/posts` | `routes/posts.js` | `GET /`, `POST /`, `PUT /:id/like`, `POST /:id/comment` |
| `/api/education` | `routes/education.js` | `GET /public`, `GET /:id`, `POST /`, `POST /generate`, `PUT /:id/enroll`, `GET /my`, `GET /enrolled`, `GET /stats` |
| `/api/lessons` | `routes/lessonRoute.js` | `POST /generate` (AI generation with retry logic) |
| `/api/library` | `routes/library.js` | `GET /`, `POST /` (with file upload), `DELETE /:id` |
| `/api/past-questions` | `routes/pastQuestionFileRoute.js` | File upload/download for past questions |
| `/api/questions` | `routes/questionRoute.js` | `GET /course/:courseCode` (quiz questions) |
| `/api/groups` | `routes/group.js` | `GET /`, `POST /`, group message CRUD |
| `/api/games` | `routes/game.js` | Game state read/write |
| `/api/lost-and-found` | `routes/lostAndFound.js` | `GET /`, `POST /`, `PUT /:id/claim` |
| `/api/leaderboard` | `routes/leaderboard.js` | `GET /` (top users sorted by points) |
| `/api/notifications` | `routes/notifications.js` | `GET /`, `PUT /read-all` |
| `/api/admin` | `routes/admin.js` | Admin-only operations |
| `/api/health` | (inline in server.js) | `GET /api/health` → `{ status: 'ok' }` |

### 4.3 Authentication Flow

1. User registers or logs in via `POST /api/auth/register` or `/login`
2. Server returns a JWT token (signed with `JWT_SECRET`)
3. Frontend stores token in `localStorage`
4. Axios interceptor attaches token to every request: `Authorization: Bearer <token>`
5. Backend `middleware/auth.js` verifies the token and attaches `req.user`
6. `middleware/admin.js` additionally checks for admin role

### 4.4 Database Models (MongoDB/Mongoose)

| Model | Collection | Key Fields |
|-------|-----------|------------|
| `User` | `users` | `name, email, password (bcrypt), department, role, points, totalWins, status, skills[]` |
| `Chat` | `chats` | `senderId, senderName, message, chatId, chatType, replyTo*` |
| `Conversation` | `conversations` | `participants[], lastMessage*, unreadCount{}` |
| `Post` | `posts` | `authorId, content, image, likes[], comments[], department, isAnonymous` |
| `Module` | `modules` | `title, subject, description, stages[{heading, content, quiz[]}], creator, enrolledUsers[], views, isPublic, isVerified` |
| `Game` | `games` | `whitePlayer, blackPlayer, gameType, fen/board, currentTurn, status, winner` |
| `Library` | `libraries` | `title, description, department, fileUrl, uploadedBy` |
| `LostAndFound` | `lostandfounds` | `itemName, category, location, date, status, image, reportedBy` |
| `Group` | `groups` | `name, description, members[], admin` |
| `Question` | `questions` | `courseCode, question, options[], correctAnswer, year, semester` |
| `Notification` | `notifications` | `userId, type, message, read, relatedId` |
| `PushSubscription` | `pushsubscriptions` | `userId, endpoint, keys` |

### 4.5 AI Module Generation (`server/routes/lessonRoute.js` + `server/services/aiContentService.js`)

**Flow:**
1. Frontend sends `POST /api/lessons/generate` with `{ topic }`
2. Server checks if BOTH `DEEPSEEK_API_KEY` and `OPENROUTER_API_KEY` are missing → if so, returns 503
3. Checks for existing cached module by title/tags
4. Calls `generateEducationalContent()` which:
   a. Tries **DeepSeek API** (`callDeepSeek()`)
   b. If DeepSeek fails, tries **OpenRouter** with 4 fallback models (`callOpenRouter()`)
   c. Cleans response (removes markdown code blocks)
   d. Validates JSON structure (title, modules[], quiz[])
5. If AI succeeds: creates a `Module` document, returns it
6. If all 3 retry attempts fail: tries to find similar existing modules; if none, returns 503
7. Each attempt logs to console for debugging

---

## 5. Environment Variables

### 5.1 Server (`server/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URI` | ✅ Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ Yes | JWT signing secret (min 32 chars) |
| `DEEPSEEK_API_KEY` | ✅ Yes | Primary AI for module generation |
| `OPENROUTER_API_KEY` | 🟡 Recommended | Fallback AI when DeepSeek fails |
| `CLOUDINARY_CLOUD_NAME` | 🟡 For uploads | Cloudinary media hosting |
| `CLOUDINARY_API_KEY` | 🟡 For uploads | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | 🟡 For uploads | Cloudinary API secret |
| `VAPID_PUBLIC_KEY` | 🟡 For push | Web push public key |
| `VAPID_PRIVATE_KEY` | 🟡 For push | Web push private key |
| `PORT` | Default: 10000 | Server port |
| `NODE_ENV` | Default: production | Environment mode |
| `CLIENT_URL` | For CORS | Frontend URL |

### 5.2 Client (`.env.production`)

| Variable | Purpose |
|----------|---------|
| `REACT_APP_API_URL` | Backend API base URL (e.g., `https://afit-chat-server.onrender.com/api`) |
| `REACT_APP_SOCKET_URL` | Backend socket URL (e.g., `https://afit-chat-server.onrender.com`) |

Both are set in Vercel's dashboard as Environment Variables (not in `.env` files for production).

---

## 6. Data Flow Patterns

### 6.1 Chat (Real-time)
```
User types → Frontend emits 'sendMessage' via Socket.io
→ Server receives, validates user status, saves to MongoDB
→ Server emits 'receiveMessage' to all sockets in the chatId room
→ All connected clients update their message list
```

### 6.2 Social Feed
```
Feed loads → GET /api/posts → returns paginated posts
User taps like → PUT /api/posts/:id/like → server toggles like array
User creates post → POST /api/posts → saves to MongoDB, updates feed
```

### 6.3 Module Generation
```
User enters topic + taps "Generate" → POST /api/lessons/generate
→ Server checks API keys → calls aiContentService
→ DeepSeek API → parse JSON → validate structure
→ Save as Module document → return to frontend
→ Frontend opens module player with generated content
```

### 6.4 Chess/TicTacToe (Real-time Gameplay)
```
Room created → Socket.io 'createRoom' → join code
Opponent joins → Socket.io 'joinGameRoomByCode' → game starts
Each move → Socket.io 'makeMove'/'tttMakeMove' → server validates →
saves to MongoDB → emits 'moveMade'/'tttUpdateBoard' to game room
```

---

## 7. Frontend Dependencies (from `package.json`)

| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `axios` | HTTP client for API calls |
| `socket.io-client` | Real-time bidirectional communication |
| `lucide-react` | Icon library (all icons used) |
| `react-markdown` + `remark-math` + `rehype-katex` | Renders LaTeX math in module content |
| `katex` | LaTeX rendering engine |
| `date-fns` | Date formatting (e.g., `format(new Date(), 'MMM d')`) |
| `framer-motion` | Animation library (used in some pages) |
| `react-chessboard` | Chess board UI component |
| `chess.js` | Chess game logic/move validation |
| `react-pdf` | PDF viewing in browser |
| `canvas-confetti` | Celebration effects (games) |
| `tailwindcss` | Utility-first CSS framework |
| `react-scripts` | Build toolchain (CRA) |

## 8. Backend Dependencies (from `package.json`)

| Package | Purpose |
|---------|---------|
| `express` | HTTP server framework |
| `socket.io` | WebSocket server for real-time features |
| `mongoose` | MongoDB ODM (schemas + queries) |
| `jsonwebtoken` | JWT authentication |
| `bcryptjs` | Password hashing |
| `cors` | Cross-Origin Resource Sharing |
| `dotenv` | Environment variable loading |
| `multer` + `multer-storage-cloudinary` | File upload handling |
| `cloudinary` | Cloud media storage SDK |
| `nodemailer` | Email sending |
| `web-push` | Push notification sending |
| `chess.js` | Server-side chess validation |

## 9. Key Architectural Decisions

1. **No page reloads** — All navigation is client-side (React Router). Chat, games, and notifications use Socket.io for real-time updates without polling.

2. **JWT stored in localStorage** — Not httpOnly cookies, because the client and server are on different domains (Vercel + Render). Token is sent via `Authorization` header.

3. **MongoDB for everything** — Single database. Chat messages, game states, modules, posts all use MongoDB. No separate Redis/cache layer (MVP simplicity).

4. **Render free tier spins down** — After 15 minutes of inactivity, the server sleeps. The first request after sleep gets a 503 from Render's proxy. The frontend detects this (empty 503 body) and shows "Server is waking up..." with auto-retry.

5. **No TypeScript** — Entire codebase is plain JavaScript (JSX for React). This keeps compilation fast and reduces complexity for an MVP.

6. **Dark mode only** — No light/dark toggle. The entire UI is built for Instagram-style dark theme using CSS custom properties.

7. **Mobile-first with desktop sidebar** — The primary UI target is mobile (375px viewport). Desktop adds a 244px sidebar but otherwise maintains the same layout structure.

## 10. Deployment URLs

- **Frontend:** https://afit-chat.vercel.app
- **Backend:** https://afit-chat-server.onrender.com
- **Health check:** https://afit-chat-server.onrender.com/api/health
