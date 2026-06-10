# AGENTS.md

Guidelines for AI coding agents working in this repository.

## Project Overview

AFIT Chat is a monorepo with two independent npm projects (no shared root package.json):
- `client/` — React 18 frontend (Create React App, Tailwind CSS, dark-mode-only Instagram-style UI)
- `server/` — Express 4 + Socket.io + Mongoose backend

No TypeScript, no Prettier, no enforced linter. Plain JavaScript (JSX) throughout.

## Build & Run Commands

```bash
# Client
cd client
npm install
npm start              # Dev server on port 3000
npm run build          # Production build

# Server
cd server
npm install
npm run dev            # Nodemon auto-reload on port 5000
npm start              # Production start
```

## Test Commands

```bash
# Server tests (Jest + mongodb-memory-server, no external DB needed)
cd server
npm test                                         # Single run
npm run test:watch                               # Watch mode
npm test -- --testPathPattern=auth               # Run specific test file
npm test -- --testPathPattern=chat               # Run chat tests
npm test -- --testPathPattern=posts              # Run posts tests
npm test -- --forceExit --detectOpenHandles      # Force exit if hangs

# Client tests (CRA Jest — no test files currently exist)
cd client
npm test
```

## Lint

No standalone lint script exists. Client uses default CRA ESLint config (`react-app`).
Run via `cd client && npx eslint src/` if needed.

## Code Structure

```
client/src/
  components/       # Reusable UI (PascalCase files, .js or .jsx)
    UI/             # Primitives: Button, Card, Input, Modal, etc. (barrel export via index.js)
  pages/            # Route-level components (PascalCase)
  context/          # React Context providers (PascalCase + Context suffix)
  services/         # API client (api.js) and Socket.io (socket.js) — camelCase
  hooks/            # Custom hooks (useXxx naming)
  games/            # Arcade game components, engines, hooks

server/
  controllers/      # Route handlers (camelCase + Controller suffix)
  middleware/        # Auth, admin, error handler
  models/           # Mongoose schemas (PascalCase)
  routes/           # Express routers (camelCase)
  services/         # Business logic (chatService.js, aiContentService.js)
  socket/           # Socket.io event handlers
  tests/            # Jest test files (*.test.js)
  utils/            # Logger, helpers
```

## Import Ordering

**Client (ES Modules):**
1. React / react-router-dom
2. Third-party libraries (lucide-react, date-fns, framer-motion)
3. Context/hooks (../context/..., ../hooks/...)
4. Services (../services/api, ../services/socket)
5. Components (../components/...)

**Server (CommonJS require):**
1. Node.js built-ins (crypto, path, fs)
2. Third-party packages (express, mongoose, jsonwebtoken, zod)
3. Local models (../models/...)
4. Local middleware/services/utils

## Naming Conventions

| Thing | Convention | Examples |
|-------|-----------|----------|
| Client components | PascalCase | `PostCard.jsx`, `DirectChat.js` |
| Client hooks | camelCase + `use` prefix | `useInfiniteScroll.js`, `useAuth()` |
| Client context | PascalCase + Context suffix | `AuthContext.js`, `NotificationContext.js` |
| Client services | camelCase | `api.js`, `socket.js` |
| Server controllers | camelCase + Controller suffix | `authController.js`, `chatController.js` |
| Server models | PascalCase | `User.js`, `Chat.js`, `Conversation.js` |
| Server routes | camelCase | `auth.js`, `chat.js` |
| Variables/functions | camelCase | `fetchPosts`, `handleLike`, `setIsLoading` |
| Boolean state | `is`/`show`/`has` prefix | `isLoading`, `showCreateModal`, `hasMore` |
| Event handlers | `handle` + PascalCase | `handleSubmit`, `handleSendMessage` |
| API groups | camelCase + API suffix | `authAPI`, `postsAPI`, `chatAPI` |
| Constants (env-derived) | UPPER_SNAKE_CASE | `ACCESS_TOKEN_EXPIRY`, `DEEPSEEK_API_KEY` |
| Error codes | UPPER_SNAKE_CASE | `TOKEN_EXPIRED`, `VALIDATION_ERROR` |

## File Extensions

Mixed `.js` and `.jsx` for React components — no strict rule. Server uses `.js` exclusively.

## Error Handling

**Server response format:**
```js
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { code: 'UPPER_SNAKE_CASE', message: 'Human-readable' } }
```

- Controllers wrap logic in try/catch, call `next(error)` for global handler
- Zod validates request bodies before processing
- Auth middleware returns specific codes: `NO_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `ACCOUNT_LOCKED`
- Global error handler (`middleware/errorHandler.js`) maps Mongoose errors to 400/500

**Client error handling:**
- Axios interceptor auto-refreshes expired tokens (queue prevents concurrent refreshes)
- 503/504 responses auto-retry up to 3 times with backoff
- Optimistic UI updates roll back on API failure
- Component catch blocks set user-facing error state

## Testing Patterns

- Server uses `mongodb-memory-server` for isolated in-memory database
- `beforeAll` connects, `afterAll` disconnects, `beforeEach` cleans collections
- Helper factories: `createTestUser()`, `createPost()`
- No client-side tests exist yet
- No integration or E2E tests

## Key Architectural Notes

- Auth uses httpOnly cookies (access + refresh tokens) with rotation — NOT localStorage JWT
- Dark mode only — all colors via CSS custom properties (`--bg-primary`, `--accent`, etc.)
- Mobile-first (375px viewport); desktop adds 244px sidebar
- Socket.io events: `newMessage`, `newMessageNotification`, `typing`, `messagesRead`, `messageDeleted`, `messageEdited`
- Chat room IDs: `dm:{user1}:{user2}` for DMs, `group:{groupId}` for groups, `anonymous-chat` for anonymous
- Push notifications via web-push with VAPID keys
- AI content generation via DeepSeek/OpenRouter APIs with retry logic
