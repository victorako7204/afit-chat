# AFIT Chat — Page-by-Page Code Reference

This file documents every page in the app with its full code and explanation of how it works.

---

## Table of Contents

| # | Page | Route | Purpose |
|---|------|-------|---------|
| 1 | Login | `/login` | User authentication |
| 2 | Register | `/register` | New user signup |
| 3 | Feed | `/feed` | Social feed (default landing page) |
| 4 | Explore | `/explore` | Discovery grid |
| 5 | Profile | `/profile`, `/profile/:id` | User profiles |
| 6 | EducationHub | `/education` | Module gallery + player |
| 7 | DirectChat | `/direct-chat` | DM conversations |
| 8 | PublicChat | `/public-chat` | Public chat room |
| 9 | Groups | `/groups` | Group chat list |
| 10 | GroupChat | `/group/:groupId` | Individual group chat |
| 11 | Library | `/library` | PDF resource library |
| 12 | QuizSimulator | `/quiz` | Past question exam mode |
| 13 | GameLobby | `/games` | Game room lobby |
| 14 | ChessGame | `/chess` | Chess (PvP + AI) |
| 15 | TicTacToe | `/tictactoe` | TicTacToe (PvP) |
| 16 | GameArcade | `/arcade` | Educational mini-games |
| 17 | LostAndFound | `/lost-and-found` | Lost & found items |
| 18 | Leaderboard | `/leaderboard` | Rankings |
| 19 | Notifications | `/notifications` | Activity feed |
| 20 | Dashboard | `/dashboard` | Legacy dashboard |
| 21 | AnonymousChat | `/anonymous-chat` | Anonymous messaging |
| 22 | AdminDashboard | `/admin` | Admin panel |

---

## 1. Login (`/login`) — `pages/Login.js`

### What it does
Authenticates the user via email/password. Includes a "Forgot Password" flow with token-based reset.

### Key State Variables
```
email, password          — Login form fields
error, loading           — UI state
showForgot, resetStep    — Password reset flow:
  'request' → enter email
  'verify'  → enter token + new password
resetEmail, resetToken, newPassword — Reset form fields
```

### Core Functions

```javascript
// Uses 'useAuth' context's login function
const { login } = useAuth();

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    await login(email, password);   // AuthContext sends POST /auth/login
    navigate('/feed');              // Redirect to feed on success
  } catch (err) {
    setError(err.response?.data?.message || 'Invalid credentials');
  } finally {
    setLoading(false);
  }
};
```

### What the API calls
- `login(email, password)` → `POST /api/auth/login` → returns JWT token + user object
- `authAPI.forgotPassword(resetEmail)` → `POST /api/auth/forgot-password` → sends reset email
- `authAPI.resetPassword(resetToken, newPassword)` → `POST /api/auth/reset-password` → updates password

### Key UI features
- Full-screen centered card on dark/light gradient background
- Dark mode toggle button (sun/moon icons) at top right
- Link to Register page
- Forgot password link opens inline reset flow (no page change)
- Reset supports token paste from email or direct link

---

## 2. Register (`/register`) — `pages/Register.js`

### What it does
Creates a new user account with name, email, password, matric number, and department.

### Key State Variables
```
formData: { name, email, password, confirmPassword, matricNo, department }
error, loading
```

### Core Functions

```javascript
const { register } = useAuth();

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');

  if (formData.password !== formData.confirmPassword) {
    setError('Passwords do not match');
    return;
  }

  setLoading(true);
  try {
    await register(
      formData.name,
      formData.email,
      formData.password,
      formData.matricNo,
      formData.department
    );
    navigate('/feed');
  } catch (err) {
    setError(err.response?.data?.message || 'Registration failed');
  } finally {
    setLoading(false);
  }
};
```

### What the API calls
- `register(name, email, password, matricNo, department)` → `POST /api/auth/register` → creates user + returns JWT

---

## 3. Feed (`/feed`) — `pages/Feed.js` (Default Landing Page)

### What it does
Instagram-style social feed with:
- **StoryBar** row at top (user avatars with gradient rings)
- **PostCards** with double-tap like animation, comments, share
- Pull-to-refresh on mobile
- Infinite scroll pagination
- Create post modal with anonymous toggle
- Real-time like/comment updates via Socket.io

### Key State Variables
```
posts[]                     — Array of post objects
page, hasMore, isLoading    — Pagination
newPost, isAnonymous        — Post creation form
expandedComments (Set)      — Which comments are open
commentText{}               — Per-post comment input text
replyingTo                  — Reply-to-comment state
pullDistance, isRefreshing  — Pull-to-refresh
```

### Core Functions

```javascript
// Load posts with pagination
const loadPosts = useCallback(async (pageNum = 1, append = false) => {
  try {
    if (pageNum === 1) setIsLoading(true);
    const response = await api.get(`/posts?page=${pageNum}&limit=10`);
    const { posts: newPosts, hasMore: more } = response.data;
    // Enrich with user's like status
    const postsWithLikes = newPosts.map(p => ({
      ...p,
      isLikedByUser: p.likes?.includes(user?._id) || false,
      likesCount: p.likes?.length || 0
    }));
    if (append) setPosts(prev => [...prev, ...postsWithLikes]);
    else setPosts(postsWithLikes);
    setHasMore(more !== undefined ? more : newPosts.length === 10);
  } finally {
    setIsLoading(false);
    setIsLoadingMore(false);
  }
}, [user?._id]);

// Infinite scroll — triggers when scrolled to bottom
const handleScroll = useCallback(() => {
  // ...detects when user reaches bottom, increments page, calls loadPosts with append=true
}, []);

// Like a post (with optimistic UI + rollback on failure)
const handleLike = async (postId) => {
  const previousPosts = [...posts];
  setPosts(prev => prev.map(p =>
    p._id === postId
      ? { ...p, isLikedByUser: !p.isLikedByUser, likesCount: p.isLikedByUser ? p.likesCount - 1 : p.likesCount + 1 }
      : p
  ));
  try { await api.put(`/posts/${postId}/like`); }
  catch { setPosts(previousPosts); }  // Rollback on error
};
```

### Skeleton Loading
```javascript
// Showed while isLoading === true
{[1,2,3].map(i => (
  <div key={i}>
    <div className="w-8 h-8 rounded-full skeleton" />
    <div className="w-24 h-3 rounded skeleton" />
    <div className="w-full aspect-square rounded skeleton" />
  </div>
))}
```

### Pull-to-Refresh (mobile touch)
```javascript
const handleTouchStart = (e) => {
  if (contentRef.current?.scrollTop <= 0) {
    pullStartY.current = e.touches[0].clientY;
    isPulling.current = true;
  }
};
const handleTouchMove = (e) => {
  const diff = e.touches[0].clientY - pullStartY.current;
  if (diff > 0) setPullDistance(Math.min(diff * 0.5, 120));
};
const handleTouchEnd = () => {
  if (pullDistance > 80) {
    setIsRefreshing(true);
    loadPosts(1).finally(() => setIsRefreshing(false));
  }
  setPullDistance(0);
};
```

### Children: PostCard (`components/PostCard.jsx`)
```javascript
// Each post renders as:
// [Avatar + Username + Menu]
// [Post Image — double-tap shows heart animation]
// [Like/Comment/Share/Save action row]
// [Likes count]
// [Caption + "View all N comments"]
// [Timestamp]

// Double-tap like animation:
const handleDoubleTap = () => {
  setShowHeart(true);
  onLike(post._id);
  setTimeout(() => setShowHeart(false), 800);
};
// Renders: Heart icon scales 0→1.2→1.0→0 over 800ms
```

---

## 4. Explore (`/explore`) — `pages/Explore.js`

### What it does
Instagram Explore-style discovery grid with search bar, filter pills, and a 3-column post grid with hover overlays.

### Key State Variables
```
query             — Search input text
activeFilter      — Current pill: 'posts', 'modules', 'people', 'tags'
posts[]           — Loaded posts
filteredPosts     — Client-side filtered by query
```

### Core Code
```javascript
const [activeFilter, setActiveFilter] = useState('posts');
const [posts, setPosts] = useState([]);

// Fetch posts for the grid
const fetchPosts = useCallback(async () => {
  const res = await api.get('/posts?limit=30');
  setPosts(res.data?.posts || []);
}, []);

// Filter pills UI
{FILTERS.map(({ key, icon: Icon, label }) => (
  <button
    key={key}
    onClick={() => setActiveFilter(key)}
    style={{
      backgroundColor: activeFilter === key ? 'var(--accent)' : 'var(--bg-secondary)',
      color: activeFilter === key ? 'white' : 'var(--text-secondary)'
    }}
  >
    <Icon size={14} /> {label}
  </button>
))}

// 3-column grid with hover overlay showing likes
<div className="grid grid-cols-3 gap-0.5">
  {filteredPosts.map(post => (
    <div className="aspect-square group relative">
      <span>{post.content}</span>
      {/* Hover overlay: like icon + count */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/50 flex items-center justify-center">
        <Heart size={14} fill="white" />
        <span className="text-xs text-white font-semibold">{post.likes?.length || 0}</span>
      </div>
    </div>
  ))}
</div>
```

---

## 5. Profile (`/profile`, `/profile/:id`) — `pages/Profile.js`

### What it does
Instagram-style user profile with:
- Avatar + stats row (posts/followers/following)
- Bio + department + skills
- 3-tab content grid (Posts / Saved / Tagged)
- Hover overlays on grid items
- Edit profile bottom-sheet modal

### Key State Variables
```
activeTab          — 'posts' | 'saved' | 'tagged'
posts[]            — User's posts
showEditModal      — Edit profile sheet open/closed
skills[]           — User's skill tags
```

### Stats Row
```javascript
<div className="flex justify-around py-4 border-b border-[var(--border)]">
  {[
    { label: 'Posts', value: posts.length },
    { label: 'Followers', value: user.followers || 0 },
    { label: 'Following', value: user.following || 0 }
  ].map(s => (
    <div className="text-center">
      <p className="font-bold text-base">{s.value}</p>
      <p className="text-xs text-[var(--text-secondary)]">{s.label}</p>
    </div>
  ))}
</div>
```

### 3-Tab Grid
```javascript
{[Grid, Bookmark, Heart].map((Icon, i) => (
  <button onClick={() => setActiveTab(['posts','saved','tagged'][i])}>
    <Icon size={20} color={activeTab === ['posts','saved','tagged'][i] ? 'var(--accent)' : 'var(--text-tertiary)'} />
  </button>
))}

// Grid items with hover overlay
<div className="grid grid-cols-3 gap-0.5">
  {posts.map(post => (
    <div className="aspect-square relative group">
      <div className="w-full h-full bg-[var(--bg-secondary)]" />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/50 flex items-center justify-center gap-4">
        <div className="flex items-center gap-1"><Heart size={14} fill="white" /><span className="text-white text-xs">{post.likes?.length}</span></div>
        <div className="flex items-center gap-1"><MessageCircle size={14} fill="white" /><span className="text-white text-xs">{post.comments?.length}</span></div>
      </div>
    </div>
  ))}
</div>
```

### Edit Profile Modal
```javascript
<Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Profile">
  <Input label="Name" value={editName} onChange={e => setEditName(e.target.value)} />
  <Input label="Bio" value={editBio} onChange={e => setEditBio(e.target.value)} />
  <Input label="Department" value={editDept} onChange={e => setEditDept(e.target.value)} />
  {/* Skills management — add/remove skill tags */}
  <Button onClick={handleSave}>Save</Button>
</Modal>
```

---

## 6. EducationHub (`/education`) — `pages/EducationHub.js`

### What it does
Module gallery and learning system:
- **Gallery tab**: 2-column card grid with subject-colored headers, search bar, subject filter pills
- **Enrolled tab**: User's enrolled modules
- **My Modules tab**: User's created modules
- **AI Generate modal**: Enter topic → DeepSeek/OpenRouter generates 5-stage module
- **Create modal**: Manual module creation with stages + quizzes
- **Module Player**: Full-screen player with stage navigation, LaTeX-rendered content, quiz with instant feedback

### Key State Variables
```
activeTab          — 'gallery' | 'enrolled' | 'my'
modules[]          — All public modules
searchQuery, selectedSubject — Filtering
showGenerateModal, showCreateModal, showPlayerModal — Modal visibility
selectedModule, currentStageIndex — Player state
generating         — AI generation loading state
```

### Module Card
```javascript
const subjectInfo = SUBJECTS.find(s => s.value === module.subject);
// Renders:
<div className="rounded-xl overflow-hidden bg-[var(--bg-secondary)]">
  {/* Subject color banner + icon */}
  <div className="aspect-[4/3] flex items-center justify-center"
       style={{ backgroundColor: subjectInfo.color + '20' }}>
    <span className="text-4xl">{subjectInfo.icon}</span>
    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold"
         style={{ backgroundColor: subjectInfo.color, color: 'white' }}>
      {module.subject}
    </div>
  </div>
  {/* Title, description, author, stats */}
  <div className="p-3">
    <h3 className="text-sm font-semibold">{module.title}</h3>
    <div className="flex items-center gap-1.5 mt-1">
      <div className="w-5 h-5 rounded-full bg-[var(--accent)] text-white text-[9px] flex items-center justify-center">
        {authorName[0]}
      </div>
      <span className="text-[11px] text-[var(--text-secondary)]">{authorName}</span>
    </div>
    {/* Views + Stages count */}
    <button className="mt-1.5 w-full py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ backgroundColor: isEnrolled ? 'var(--bg-tertiary)' : 'var(--accent)' }}>
      {isEnrolled ? 'Enrolled' : 'Enroll'}
    </button>
  </div>
</div>
```

### AI Generation Flow (the `/api/lessons/generate` endpoint)
```javascript
const handleGenerateModule = async () => {
  setGenerating(true);
  const generateWithRetry = async (retries = 2) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await educationAPI.generateModule(generateTopic.trim());
        // Success → add to modules list, open player
        setModules(prev => [res.data.module, ...prev]);
        setShowGenerateModal(false);
        setSelectedModule(res.data.module);
        setShowPlayerModal(true);
        return { success: true };
      } catch (err) {
        if (err?.response?.status === 503 && attempt < retries) {
          // Wait 3s then retry (server cold start or AI busy)
          await new Promise(r => setTimeout(r, 3000));
        } else {
          return { success: false, error: err?.response?.data?.message || 'Failed to generate' };
        }
      }
    }
  };
  const result = await generateWithRetry(2);
  if (!result.success) alert(result.error);
  setGenerating(false);
};
```

### Module Player
```javascript
const stages = selectedModule?.stages || [];
const currentStage = stages[currentStageIndex];

<div className="fixed inset-0 z-50 bg-[var(--bg-primary)] animate-slide-up">
  {/* Header: back arrow, title, stage tabs (horizontal scroll) */}
  <div className="sticky top-0 px-4 py-3 border-b border-[var(--border)]">
    <button onClick={handleClosePlayer}><ChevronLeft size={18} /> Back</button>
    <h2 className="text-base font-semibold">{selectedModule.title}</h2>
    {/* Stage pill buttons — horizontal scroll */}
    {stages.map((stage, index) => (
      <button onClick={() => setCurrentStageIndex(index)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${currentStageIndex === index ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)]'}`}>
        {stage.heading}
      </button>
    ))}
  </div>

  {/* Content area — LaTeX rendered via react-markdown + remark-math + rehype-katex */}
  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
    {currentStage.content}
  </ReactMarkdown>

  {/* Quiz section — expandable per question */}
  {currentStage.quiz?.map((quiz, i) => (
    <div className="rounded-lg p-4 mb-3 bg-[var(--bg-primary)] border border-[var(--border)]">
      <button onClick={() => setExpandedQuiz(isExpanded ? null : answerKey)}>
        {quiz.question}
      </button>
      {isExpanded && quiz.options.map(option => (
        <button onClick={() => handleCheckQuiz(currentStageIndex, i, option)}
                className="w-full text-left p-3 rounded-lg text-sm"
                style={{
                  border: `1px solid ${
                    selectedAnswer === option ? (result === 'correct' ? 'var(--success)' : 'var(--danger)') : 'var(--border)'
                  }`
                }}>
          {option}
        </button>
      ))}
    </div>
  ))}

  {/* Prev / Next navigation */}
  <button onClick={() => setCurrentStageIndex(prev => Math.max(0, prev - 1))}
          disabled={currentStageIndex === 0}>← Previous</button>
  <button onClick={() => setCurrentStageIndex(prev => Math.min(stages.length - 1, prev + 1))}
          disabled={currentStageIndex === stages.length - 1}>Next →</button>
</div>
```

---

## 7. DirectChat (`/direct-chat`) — `pages/DirectChat.js`

### What it does
Instagram DM-style interface with:
- Conversation list (72px items, 56px avatars, online green dots, unread blue dots)
- Chat view with bubble messages (accent bg for self, secondary bg for them)
- Round 22px input bar with camera/mic icons
- Reply bar
- Find classmates bottom sheet

### Key State Variables
```
conversations[]      — List of DM conversations
activeConversation   — Currently open conversation
messages[]           — Messages in active conversation
newMessage           — Input text
replyingTo           — Reply-to state
showFindModal        — Find classmates sheet
```

### Conversation List Item
```javascript
<div className="flex items-center gap-3 px-4 h-[72px] border-b border-[var(--border)]">
  <div className="relative">
    <img src={conv.avatar} className="w-14 h-14 rounded-full object-cover" />
    {conv.online && (
      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-primary)] bg-[var(--success)]" />
    )}
  </div>
  <div className="flex-1 min-w-0">
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">{conv.name}</span>
      <span className="text-[11px] text-[var(--text-tertiary)]">{conv.timestamp}</span>
    </div>
    <p className="text-sm text-[var(--text-secondary)] truncate">{conv.lastMessage}</p>
  </div>
  {conv.unread > 0 && (
    <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
  )}
</div>
```

### Chat Bubble
```javascript
// Own message (right-aligned, accent bg)
<div className="chat-bubble-me">
  {msg.replyToMessage && (
    <div className="mb-2 p-2 rounded-lg text-xs bg-white/15">
      <CornerUpLeft size={12} />
      <span className="font-medium">{msg.replyToSender}</span>
      <p className="truncate opacity-80">{msg.replyToMessage}</p>
    </div>
  )}
  <p className="text-sm">{msg.message}</p>
</div>

// Other's message (left-aligned, secondary bg)
<div className="chat-bubble-them">
  <p className="text-xs font-semibold text-[var(--accent)]">{msg.senderName}</p>
  <p className="text-sm">{msg.message}</p>
</div>
```

---

## 8. PublicChat (`/public-chat`) — `pages/PublicChat.js`

### What it does
Public campus-wide chat room:
- Real-time messaging via Socket.io
- Reply-to-message feature
- Pin/unpin messages
- Delete own messages
- "View older messages" pagination

### Key State Variables
```
messages[]        — All chat messages
newMessage        — Input text
replyingTo        — Reply-to state
activeMenu        — Which message's action menu is open
showPinned        — Toggle pinned messages view
loading, loadingMore, hasMore — Pagination
```

### Core Socket Flow
```javascript
// Connect to room on mount
useEffect(() => {
  connectSocket();
  joinRoom(PUBLIC_CHAT_ID);  // 'public-chat' room

  // Listen for new messages
  socket.on('receiveMessage', (message) => {
    if (message.chatId === PUBLIC_CHAT_ID) {
      setMessages(prev => [...prev, message]);
    }
  });

  // Cleanup on unmount
  return () => {
    leaveRoom(PUBLIC_CHAT_ID);
    socket.off('receiveMessage');
  };
}, []);

// Send message
const handleSendMessage = (e) => {
  e.preventDefault();
  sendMessageSocket({
    chatId: PUBLIC_CHAT_ID,
    message: newMessage.trim(),
    senderId: user._id,
    senderName: user.name,
    replyTo: replyingTo?._id || null,
    replyToMessage: replyingTo?.message || null,
    replyToSender: replyingTo?.senderName || null,
  });
  setNewMessage('');
};
```

---

## 9–10. Groups + GroupChat (`/groups`, `/group/:groupId`) — `pages/Groups.js`, `pages/GroupChat.js`

### What Groups.js does
Lists all group chat rooms the user belongs to or can join. Each group shows name, member count, last message preview.

### What GroupChat.js does
Full group chat interface:
- Message list with sender names + timestamps
- Real-time Socket.io messaging
- Group member roster
- Create group functionality

### Key State Variables
```
groups[]           — Group list
messages[]         — Group messages
newMessage         — Input
showCreateModal    — Create group form
```

---

## 11. Library (`/library`) — `pages/Library.js`

### What it does
PDF resource library:
- Tab: Books & Resources | Past Questions
- Resource cards with file icon, title, description, department tag
- In-app PDF viewer
- Upload modal with form fields
- Department filter dropdown

### Key State Variables
```
activeTab       — 'books' | 'pq-vault'
resources[]     — Library resources
filter          — Department filter value
showModal, uploading — Upload form state
showPdfViewer, selectedPdfUrl — PDF viewing
```

### Resource Card
```javascript
<div className="rounded-xl p-4 bg-[var(--bg-secondary)]">
  <div className="flex items-start gap-3">
    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--accent)]/20">
      <FileText size={20} color="var(--accent)" />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold truncate">{resource.title}</h3>
      <p className="text-xs mt-1 text-[var(--text-secondary)] line-clamp-2">{resource.description}</p>
    </div>
  </div>
  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
    <span className="text-xs font-medium text-[var(--accent)]">{resource.department}</span>
    <button onClick={() => handleViewPdf(resource)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white">
      <Eye size={13} /> View
    </button>
  </div>
</div>
```

### Upload Flow
```javascript
const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (file && file.type === 'application/pdf') {
    setNewResource({ ...newResource, file });
  } else {
    setError('Please select a PDF file');
  }
};

const handleUpload = async (e) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append('title', newResource.title);
  formData.append('file', newResource.file);
  await libraryAPI.uploadResource(formData);
  // → POST /api/library (multipart/form-data, file upload to Cloudinary)
};
```

---

## 12. QuizSimulator (`/quiz`) — `pages/QuizSimulator.jsx`

### What it does
Past question exam simulator:
- Select course (PHY102, MTH102, etc.)
- Randomized questions from the database
- Multiple choice answers with instant green/red feedback
- Progress bar, timer, score display
- Review mode at the end

### Key Flow
```javascript
// Fetch questions by course code
const fetchQuestions = async (courseCode) => {
  const res = await api.get(`/questions/course/${courseCode}`);
  // Randomize and set
  setQuestions(shuffleArray(res.data));
};

// Answer selection
const handleAnswer = (questionIndex, selectedOption) => {
  const correct = questions[questionIndex].correctAnswer === selectedOption;
  setAnswers(prev => [...prev, { selected: selectedOption, correct }]);
};
```

---

## 13–16. Games (`/games`, `/chess`, `/tictactoe`, `/arcade`) — Game System

### GameLobby (`/games`)
Room-based matchmaking:
- Create Room button → generates 6-digit code
- Join Room by code input
- Game type selection: Chess | TicTacToe
- Active rooms list
- Leaderboard preview (top 3)

### ChessGame (`/chess`)
Full chess game:
- Uses `react-chessboard` for the board UI
- `chess.js` for move validation (client + server)
- PvP via Socket.io room system
- AI mode using local `chessAI.js` engine (uses iterative deepening)
- Move history, captured pieces, game status display

### TicTacToe (`/tictactoe`)
Two-player TicTacToe:
- 3×3 grid with X/O symbols
- Room-based matchmaking (same as Chess)
- Win detection, draw detection
- Highlight winning line

### GameArcade (`/arcade`)
Educational mini-games:
- LogicGame — Boolean logic puzzle
- PacketGame — Network packet sorting
- VectorGame — Vector math visualization
- StructuralGame — Engineering structure builder
- Each uses canvas rendering with custom game engines under `games/engines/`

### Game Socket Events
```javascript
// Client emits:
socket.emit('createRoom', { userId, userName, gameType: 'chess'|'tictactoe' });
socket.emit('joinGameRoomByCode', { code, userId, userName });
socket.emit('makeMove', { gameId, from, to, fen, userId });
socket.emit('tttMakeMove', { roomId, index, symbol, userId });
socket.emit('endGame', { gameId, result, winnerId, loserId, userId });

// Server emits:
socket.on('roomCreated', ({ roomId, gameType }) => { ... });
socket.on('gameStarted', ({ roomId, gameId, whitePlayer, blackPlayer }) => { ... });
socket.on('moveMade', ({ gameId, from, to, fen }) => { ... });
socket.on('gameEnded', ({ gameId, winner, reason }) => { ... });
```

---

## 17. LostAndFound (`/lost-and-found`) — `pages/LostAndFound.js`

### What it does
Lost & found item board:
- Toggle: Lost Items | Found Items | My Reports
- Category filter pills
- Card grid with image, item name, location, date, status badge
- Detail modal with contact info
- Report button (FAB) → form with image upload

### Key State Variables
```
activeTab    — 'lost' | 'found' | 'mine'
items[]      — Item reports
showForm     — Report form modal
form: { itemName, category, location, date, description, image }
```

### Item Card
```javascript
<div className="rounded-xl overflow-hidden bg-[var(--bg-secondary)]">
  {item.image && <img src={item.image} className="w-full h-32 object-cover" />}
  <div className="p-3">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-sm">{item.itemName}</span>
      <span className="text-[10px] px-2 py-0.5 rounded font-semibold"
            style={{
              backgroundColor: item.status === 'lost' ? 'rgba(237,73,86,0.15)' : 'rgba(0,210,106,0.15)',
              color: item.status === 'lost' ? 'var(--danger)' : 'var(--success)'
            }}>
        {item.status}
      </span>
    </div>
    <p className="text-xs text-[var(--text-secondary)] mt-1">{item.location} · {formatDate(item.date)}</p>
  </div>
</div>
```

---

## 18. Leaderboard (`/leaderboard`) — `pages/LeaderboardPage.js`

### What it does
Ranking display:
- Top 3: Podium with gold/silver/bronze accents
- Rank 4+: List with rank number, avatar, name, department, points, wins
- Filter: All Time | This Week | By Department
- Current user's rank banner at bottom if not in top view

### Key State Variables
```
leaderboard[]    — Ranked user array
filter           — 'all' | 'weekly' | 'department'
currentUserRank  — Logged-in user's position
```

### Podium (Top 3)
```javascript
{[1, 2, 3].map(rank => {
  const user = leaderboard[rank - 1];
  const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  return (
    <div className="flex flex-col items-center">
      <div className="w-16 h-16 rounded-full" style={{ border: `3px solid ${colors[rank-1]}` }}>
        <span className="text-2xl">{user?.name?.[0]}</span>
      </div>
      <span className="text-xs font-semibold mt-1">{user?.name}</span>
      <span className="text-xs text-[var(--text-tertiary)]">{user?.points} pts</span>
    </div>
  );
})}
```

---

## 19. Notifications (`/notifications`) — `pages/Notifications.js`

### What it does
Instagram-style activity feed:
- Grouped by Today / This Week / Earlier
- Each item: colored icon + message + timestamp + unread blue dot
- "Mark all read" button
- Falls back to mock data if API unavailable

### Notification Item
```javascript
const ICON_MAP = {
  like: Heart, comment: MessageCircle, follow: UserPlus,
  module: BookOpen, win: Trophy,
};
const COLOR_MAP = {
  like: '#ED4956', comment: '#0095F6', follow: '#00D26A',
  module: '#0095F6', win: '#FFD700',
};

<div className="flex items-center gap-3 px-4 py-3"
     style={{ backgroundColor: notif.read ? 'transparent' : 'var(--bg-secondary)' }}>
  <div className="w-9 h-9 rounded-full flex items-center justify-center"
       style={{ backgroundColor: COLOR_MAP[notif.type] + '20' }}>
    <IconComponent size={16} color={COLOR_MAP[notif.type]} />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-sm">{notif.message}</p>
    <p className="text-[11px] text-[var(--text-tertiary)]">{formattedTime}</p>
  </div>
  {!notif.read && <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
</div>
```

---

## 20. Dashboard (`/dashboard`) — `pages/Dashboard.js`

Legacy main dashboard page. Shows:
- Welcome message with user name
- Quick stats (messages, points, modules)
- Links to major features (chat, education, games, etc.)
- Activity overview

---

## 21. AnonymousChat (`/anonymous-chat`) — `pages/AnonymousChat.js`

Anonymous chat feature. Users can send messages without revealing their identity. Similar to PublicChat but sender names are anonymized (e.g., "Anonymous #247"). Uses Socket.io with `chatType: 'anonymous'`.

---

## 22. AdminDashboard (`/admin`) — `pages/AdminDashboard.js`

Admin-only panel for:
- User management (list users, suspend/restrict/ban)
- Module verification (approve/reject AI-generated modules)
- Content moderation (delete posts, messages)
- System statistics (active users, total messages, etc.)
- Requires `user.role === 'admin'` (enforced by both frontend route guard and backend `middleware/admin.js`)

---

## Navigation & Routing Summary

All routes are defined in `App.js`:

```
/feed              → Feed (default after login)
/explore           → Explore
/education         → EducationHub
/profile           → Profile (self)
/profile/:id       → Profile (other user)
/direct-chat       → DirectChat
/public-chat       → PublicChat
/groups            → Groups
/group/:groupId    → GroupChat
/library           → Library
/quiz              → QuizSimulator
/games             → GameLobby
/chess             → ChessGame
/tictactoe         → TicTacToe
/arcade            → GameArcade
/lost-and-found    → LostAndFound
/leaderboard       → LeaderboardPage
/notifications     → Notifications
/dashboard         → Dashboard
/anonymous-chat    → AnonymousChat
/admin             → AdminDashboard
/login             → Login
/register          → Register
```

Mobile access: Bottom nav (5 tabs) + MoreDrawer (18 secondary pages)
Desktop access: Sidebar (244px, all 22 pages listed)

---

# Backend Architecture

## Server Entry Point — `server/server.js`

Express + Socket.io + MongoDB entry point. Mounts all 14 route groups, configures CORS for Vercel + localhost, connects to MongoDB, auto-seeds question bank on first run, and manages all real-time features:

- **Socket.io rooms** for chat, games, and user presence
- **Multi-game room system** (chess + tic-tac-toe) with in-memory room state
- **AI chess engine** integration
- **Online users** presence tracking via `Map<userId, socketId>`
- **Message persistence** via `saveMessageToDatabase()`
- **Leaderboard updates** broadcast on game end

```js
// Key startup sequence:
const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  // Auto-seed questionsDataPool_v3.json if Question collection is empty
};
// Socket.io events: userConnected, joinChatRoom, joinGameRoomByCode,
// makeMove (chess), tttMakeMove, getAIMove, createRoom, etc.
```

## Models (14 files)

### 1. `server/models/User.js`

User accounts with bcrypt password hashing, points/wins/streaks tracking, suspension system, and leaderboard queries.

**Key schema fields:** `name, email, password, matricNo, role (student|moderator|admin), status (active|suspended|restricted), department, avatar, points, totalWins, totalLosses, totalDraws, gamesPlayed, currentStreak, longestStreak, bio, skills[]`

**Key methods:**
- `pre('save')` — auto-hash password with bcrypt (12 rounds)
- `comparePassword(candidate)` — bcrypt compare
- `recordWin()` — +10 points, +1 win, +1 streak
- `recordLoss()` — -5 points, +1 loss, reset streak
- `recordDraw()` — +3 points, +1 draw
- `isSuspended()` — check if suspension is still active
- `suspend(reason, expiry)` / `unsuspend()` — admin actions
- `getLeaderboard(type, limit)` — statics method for ranking

```js
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  matricNo: { type: String, required: true, unique: true, uppercase: true, select: false },
  role: { type: String, enum: ['student', 'moderator', 'admin'], default: 'student' },
  status: { type: String, enum: ['active', 'suspended', 'restricted'], default: 'active' },
  points: { type: Number, default: 0 },
  totalWins: { type: Number, default: 0 },
  totalLosses: { type: Number, default: 0 },
  totalDraws: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.index({ points: -1, totalWins: -1 });
userSchema.index({ currentStreak: -1 });
```

---

### 2. `server/models/Chat.js`

Chat messages for public, private, group, and anonymous chats.

**Key fields:** `senderId, senderName, message, chatType (public|private|group|anonymous), chatId, recipientId, replyTo, replyToMessage, replyToSender, deleted`

```js
const chatSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  senderName: { type: String, default: 'Anonymous' },
  message: { type: String, required: true },
  chatType: { type: String, enum: ['public', 'private', 'group', 'anonymous'], default: 'public' },
  chatId: { type: String, required: true, index: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', default: null },
  replyToMessage: { type: String, default: null },
  replyToSender: { type: String, default: null }
}, { timestamps: true });

chatSchema.index({ chatId: 1, createdAt: -1 });
```

---

### 3. `server/models/Conversation.js`

DM conversation tracking with per-user unread counts using a Map field.

**Key methods:**
- `incrementUnread(targetUserId)` — +1 unread for a participant
- `clearUnread(targetUserId)` — reset unread to 0
- `findOrCreateByParticipants(userId1, userId2)` — sorted ID lookup + create

```js
const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  unreadCount: { type: Map, of: Number, default: {} },
  lastMessageBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
```

---

### 4. `server/models/Post.js`

Social feed posts with likes, comments, anonymous mode.

**Key fields:** `authorId, content (max 500), isAnonymous, department, likes[], comments[] (authorId + content + createdAt), replyTo, replyToAuthor`

**Virtuals:** `likeCount`, `commentCount`

```js
const postSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxLength: 500 },
  isAnonymous: { type: Boolean, default: false },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });
```

---

### 5. `server/models/Module.js`

Education modules with embedded stages and quizzes. Supports AI-generated modules (`creatorName: 'AI-Qwen'` or `'AI-DeepSeek'`) and user-created modules.

**Key fields:** `title, subject (9 options), description, creator, creatorName, isPublic, isVerified, views, stages[] (moduleId, heading, content, quiz[]), enrolledUsers[], tags[]`

**Key methods:**
- `incrementViews()` — +1 view counter
- `toggleEnrollment(userId)` — enroll/unenroll user
- `searchByTitle(title)` — text search with $regex
- `getPublicModules(options)` — paginated + filtered + text search
- `findByCreator(creatorId)` / `findEnrolled(userId)`
- `verifyModule(moduleId)` — admin verification
- `getStats()` — aggregate total modules, views, verified, by-subject counts

```js
const stageSchema = new mongoose.Schema({
  moduleId: Number,
  heading: { type: String, required: true },
  content: { type: String, required: true },
  quiz: [{ question: String, options: [String], answer: String }]
}, { _id: false });

const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subject: { type: String, enum: ['Math','Physics','GST','COS','Chemistry','Biology','Engineering','Computer Science','Other'], required: true },
  stages: [stageSchema],
  isPublic: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  creatorName: { type: String, default: 'AI-Qwen' },
  enrolledUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  views: { type: Number, default: 0 },
  tags: [String]
}, { timestamps: true });
```

---

### 6. `server/models/Game.js`

Game state for chess and tic-tac-toe. Tracks full move history, FEN strings, player stats, and provides daily/weekly/all-time leaderboard aggregations.

**Key fields:** `gameType (chess|tictactoe), whitePlayer, blackPlayer, fen, board[] (TTT), status (waiting|active|finished|draw), winner, moves[] (from, to, fen, timestamp), currentTurn, isCheck, isCheckmate, isStalemate`

**Static methods:** `findWaitingGame`, `getPlayerStats`, `getDailyTop`, `getWeeklyTop`, `getAllTimeTop`

```js
const gameSchema = new mongoose.Schema({
  gameType: { type: String, enum: ['chess', 'tictactoe'], default: 'chess' },
  whitePlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  blackPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fen: { type: String, default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  status: { type: String, enum: ['waiting', 'active', 'finished', 'draw'], default: 'waiting' },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moves: [{ from: String, to: String, fen: String, timestamp: { type: Date, default: Date.now } }],
  currentTurn: { type: String, enum: ['white', 'black', 'X', 'O'], default: 'white' },
  isCheck: Boolean, isCheckmate: Boolean, isStalemate: Boolean
}, { timestamps: true });
```

---

### 7. `server/models/Group.js`

Group chat rooms with admin system, invite codes, and lock state. Auto-generates 6-char invite code on creation.

```js
const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: String,
  department: String,
  isLocked: { type: Boolean, default: false },
  inviteCode: { type: String, unique: true, sparse: true }
}, { timestamps: true });
```

---

### 8. `server/models/Library.js`

PDF resource library with Cloudinary integration.

```js
const librarySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: String,
  fileUrl: { type: String, required: true },
  publicId: { type: String, required: true },
  department: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fileName: { type: String, required: true }
}, { timestamps: true });
```

---

### 9. `server/models/LostAndFound.js`

Lost & found item reports.

```js
const lostAndFoundSchema = new mongoose.Schema({
  title: String, description: { type: String, required: true },
  location: { type: String, required: true },
  status: { type: String, enum: ['lost', 'found'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contact: String
}, { timestamps: true });
```

---

### 10. `server/models/Question.js`

Past question bank for quiz simulator. Course codes: PHY102, MTH102.

```js
const questionSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, enum: ['PHY102', 'MTH102'], index: true },
  topic: String,
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOption: { type: String, required: true },
  diagramSvg: String
}, { timestamps: true });
```

---

### 11. `server/models/Notification.js`

In-app and push notifications with TTL-based expiry. Supports types: `GAME_INVITE, GAME_WINNER, GAME_STARTED, LOST_FOUND, ANNOUNCEMENT, SYSTEM`. Uses MongoDB TTL index on `expiresAt`.

**Factory methods:** `createGlobalAnnouncement`, `createGameInvite`, `createGameResult`, `createLostFound`, `getUserNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`

```js
const notificationSchema = new mongoose.Schema({
  type: { type: String, enum: ['GAME_INVITE','GAME_WINNER','GAME_STARTED','LOST_FOUND','ANNOUNCEMENT','SYSTEM'], required: true },
  title: String, message: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  isRead: { type: Boolean, default: false },
  isGlobal: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---

### 12–14. Additional Models

- **`PushSubscription`** — `userId (unique), endpoint, keys: { p256dh, auth }`
- **`PastQuestionFile`** — `courseCode, title, year, examType, fileUrl, fileType, uploadedBy, downloadsCount`

---

## Routes (14 files)

### 1. `server/routes/auth.js`
```
POST /register              → register
POST /login                 → login
POST /forgot-password       → forgotPassword
POST /reset-password/:token → resetPassword
GET  /profile               → getProfile (auth)
PUT  /profile               → updateProfile (auth)
GET  /users                 → getAllUsers (auth)
DELETE /users/:id           → deleteUser (auth + admin)
```

### 2. `server/routes/chat.js`
```
GET  /:chatId                → getMessages (auth + suspension check)
POST /                       → sendMessage (auth)
POST /anonymous              → sendAnonymousMessage
GET  /private/:targetUserId  → private message history (auth)
GET  /unread/count           → total unread (auth)
PUT  /unread/clear/:chatId   → clear unread (auth)
DELETE /message/:id          → deleteMessage (auth + admin)
DELETE /clear/:chatId        → clearChat (auth + admin)
DELETE /clear-before/:chatId → clearMessagesBefore (auth + admin)
```

### 3. `server/routes/posts.js`
```
POST /              → Create post (auth) — broadcasts via Socket.io
GET /               → Get paginated posts (auth)
GET /:id            → Get single post (auth)
POST /:id/like      → Toggle like (auth) — broadcasts via Socket.io
POST /:id/comment   → Add comment (auth) — broadcasts via Socket.io
DELETE /:id         → Delete own post (auth)
```

### 4. `server/routes/education.js`
```
GET  /subjects               → getSubjects
GET  /stats                  → getEducationStats
GET  /public                 → getPublicModules
GET  /my, /enrolled          → user-specific modules (auth)
GET  /title/:title           → getModuleByTitle
GET  /:id                    → getModule
POST /generate               → generateModule (auth) — AI via OpenRouter
POST /                       → createManualModule (auth)
PUT  /:id, /:id/enroll, /:id/verify → update/enroll/verify (auth)
DELETE /:id                  → deleteModule (auth)
```

### 5. `server/routes/lessonRoute.js`
```
POST /generate → Generate AI module with 3-attempt retry (auth)
```
Checks `DEEPSEEK_API_KEY` then `OPENROUTER_API_KEY`. Attempts 3 retries. Falls back to similar existing modules. Creates module with `creatorName: 'AI-DeepSeek'`.

### 6–14. Other Routes
**library.js** — CRUD for PDF resources with Cloudinary upload (multer).  
**pastQuestionFileRoute.js** — Upload/list past question files (local disk storage, 15MB limit).  
**questionRoute.js** — `GET /?courseCode=PHY102` — fetch questions.  
**group.js** — Full CRUD + invite/join/leave/lock/admin management.  
**game.js** — Leaderboard, create game, move, end, notifications, history.  
**lostAndFound.js** — CRUD with status filter and owner/admin delete.  
**leaderboard.js** — `GET /` (daily/weekly/allTime) and `GET /stats`.  
**notifications.js** — List/announce/read + push subscribe/unsubscribe.  
**admin.js** — User status/role management, user list with filters.

---

## Controllers (9 files)

### 1. `server/controllers/authController.js` (326 lines)

**Key functions:**
- `register` — validates duplicate email/matricNo, creates user, returns JWT (7-day)
- `login` — finds user by email, compares password, returns JWT
- `forgotPassword` — generates crypto token, sends styled reset email via Nodemailer
- `resetPassword` — validates hashed token + expiry, updates password
- `getProfile` / `updateProfile` — user profile CRUD (matricNo/role changes rejected)
- `getAllUsers` — aggregation pipeline with last private message per user
- `deleteUser` — admin delete by ID

### 2. `server/controllers/chatController.js` (206 lines)

**Key functions:** `getMessages` (pagination + admin unmask), `sendMessage` (Socket.io broadcast + DM notification), `sendAnonymousMessage` (null sender), `deleteMessage`, `clearChat`, `clearMessagesBefore` (admin)

### 3. `server/controllers/educationController.js` (434 lines)

**Key functions:** `generateModule` (3-attempt AI retry), `getPublicModules` (paginated filter), `getModule` (increment views), `createManualModule`, `updateModule` (ownership check), `toggleEnrollment`, `verifyModule`, `getSubjects`

### 4. `server/controllers/gameController.js` (453 lines)

**Key functions:** `getLeaderboard` (daily/weekly/allTime + rank), `createGame` (auto-match), `makeMove` (turn validation + broadcast), `endGame` (resign/draw + points), `getMyGames`, `getWaitingGames`

### 5–9. Other Controllers

**groupController.js** (336 lines) — Group CRUD, join by invite code, lock/unlock, admin promotion.  
**libraryController.js** (99 lines) — Resource upload/delete via Cloudinary.  
**lostAndFoundController.js** (110 lines) — Item reporting CRUD.  
**LeaderboardController.js** (105 lines) — Leaderboard with user rank calculation.  
**NotificationController.js** (137 lines) — Announcements + Socket.io broadcasts.

---

## Middleware (3 files)

### `server/middleware/auth.js` (65 lines)

```js
const auth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId).select('-password -matricNo');
  req.user = user;
  next();
};
const checkNotSuspended — checks status, auto-unsuspends if expiry passed
const checkAdmin — requires admin or moderator role
```

### `server/middleware/errorHandler.js` (29 lines)

Handles: ValidationError, duplicate key (11000), CastError, generic 500.

### `server/middleware/admin.js`

Re-exports `checkAdmin` from auth.js.

---

## Services

### `server/services/aiContentService.js` (167 lines)

**AI generation with fallback chain:** DeepSeek (`deepseek-chat`) → OpenRouter (`deepseek/deepseek-chat-v3-0324:free` → `llama-4-maverick:free` → `qwen3-235b-a22b:free` → `gemma-4-31b-it:free`). Includes JSON cleaning, structural validation, and retry on 429/503.

---

## Config

### `server/config/cloudinary.js` (22 lines)

Cloudinary + multer-storage-cloudinary for PDF uploads.

---

# Frontend Services & Contexts

## `client/src/services/api.js` (142 lines)

Axios instance with JWT auth interceptor and error handler.

**Error handling:** Maps 503/504 (JSON-aware), 401, 500, and network errors to `error.userMessage`.

**API groups:** `authAPI`, `chatAPI`, `lostAndFoundAPI`, `libraryAPI`, `groupAPI`, `userAPI`, `educationAPI`, `quizAPI`

## `client/src/services/socket.js` (178 lines)

Socket.io singleton with auto-reconnect (10 attempts, 1–5s backoff). Exports: `connectSocket`, `disconnectSocket`, `joinRoom`, `leaveRoom`, `sendMessageSocket`, `setSocketUser`, `isSocketConnected`, `socket`.

## `client/src/services/notificationService.js` (165 lines)

Web push notification service: permission request, service worker registration, PushManager subscribe/unsubscribe, VAPID key conversion.

## `client/src/context/AuthContext.js` (116 lines)

JWT auth context. On mount fetches profile. Listens for `accountStatusUpdate` (auto-logout on suspension) and `accountRoleUpdate` via Socket.io. Exports `useAuth()` → `{ user, token, login, register, logout, loading }`.

## `client/src/context/OnlineUsersContext.js` (112 lines)

Real-time online presence. Listens for `onlineUsersList`, `userOnline`, `userOffline`. Exports `useOnlineUsers()` → `{ onlineUsers, isUserOnline, notificationCount }`.

## `client/src/context/NotificationContext.js` (213 lines)

DM unread tracking with localStorage persistence. Listens for `receiveMessage` and `newMessageNotification`. Exports `useNotifications()` → `{ getUnreadCount, getTotalUnread, clearUnread, clearAllUnread, setCurrentChatPartner }`.
