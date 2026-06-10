require('dotenv').config();

const logger = require('./utils/logger');

logger.info(`Startup key check: DEEPSEEK=${!!process.env.DEEPSEEK_API_KEY}, OPENROUTER=${!!process.env.OPENROUTER_API_KEY}`);
if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENROUTER_API_KEY) {
  logger.warn('No AI API keys configured. Module generation will return 503.');
}

const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const { getBestMove } = require('./chessAI');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const lostAndFoundRoutes = require('./routes/lostAndFound');
const libraryRoutes = require('./routes/library');
const pastQuestionFileRoutes = require('./routes/pastQuestionFileRoute');
const groupRoutes = require('./routes/group');
const educationRoutes = require('./routes/education');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');
const notificationsRoutes = require('./routes/notifications');
const postsRoutes = require('./routes/posts');
const questionRoutes = require('./routes/questionRoute');
const errorHandler = require('./middleware/errorHandler');
const chatHandlers = require('./socket/chatHandlers');
const Chat = require('./models/Chat');
const Game = require('./models/Game');
const User = require('./models/User');
const Conversation = require('./models/Conversation');

let sendPushNotification;
try {
  const notificationsModule = require('./routes/notifications');
  sendPushNotification = notificationsModule.sendPushNotification;
} catch (e) {
  logger.info('Push notifications not available');
}

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;
const ALLOWED_ORIGINS = [
  'https://afit-chat.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/afit-chat.*\.vercel\.app$/.test(origin)) return true;
  return false;
};

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://afit-chat-server.onrender.com', 'wss://afit-chat-server.onrender.com']
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.disable('x-powered-by');

app.use(cors({
  origin: function(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400
}));

app.options('*', cors());

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  pingInterval: 30000,
  pingTimeout: 90000,
  transports: ['websocket', 'polling']
});

app.set('io', io);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postsRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/lost-and-found', lostAndFoundRoutes);
app.use('/api/v1/library', libraryRoutes);
app.use('/api/v1/past-questions', pastQuestionFileRoutes);
app.use('/uploads/past-questions', express.static(path.join(__dirname, 'uploads/past-questions')));
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/education', educationRoutes);
app.use('/api/v1/lessons', require('./routes/lessonRoute'));
app.use('/api/v1/games', gameRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/questions', questionRoutes);

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'ok', timestamp: Date.now() }
  });
});

app.use(errorHandler);

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    logger.error('MONGO_URI not configured!');
    return false;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('MongoDB connected');
    try {
      const Question = require('./models/Question');
      const count = await Question.countDocuments();
      if (count === 0) {
        logger.info('Database empty. Auto-seeding questions...');
        const fs = require('fs');
        const dataPath = path.join(__dirname, 'questionsDataPool_v3.json');
        const pastQuestionsData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        await Question.deleteMany({});
        await Question.insertMany(pastQuestionsData);
        logger.info(`Auto-seed complete. Inserted ${pastQuestionsData.length} questions.`);
      } else {
        logger.info(`Question repository populated with ${count} records.`);
      }
    } catch (seedErr) {
      logger.error('Auto-seed error:', seedErr.message);
    }
    return true;
  } catch (err) {
    logger.error('MongoDB error:', err.message);
    return false;
  }
};

const onlineUsers = new Map();
const getOnlineUsersArray = () => Array.from(onlineUsers.keys()).map(id => String(id));

const broadcastOnlineUsers = () => {
  io.emit('onlineUsersList', { userIds: getOnlineUsersArray() });
};

const getTopLeaderboard = async (limit = 10) => {
  const topUsers = await User.find()
    .sort({ points: -1, totalWins: -1 })
    .limit(limit)
    .select('name department points totalWins');
  return topUsers.map((u, i) => ({ ...u.toObject(), rank: i + 1 }));
};

const gameRooms = {};

const generateRoomCode = () => {
  return Math.random().toString().substring(2, 8);
};

const TTT_WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const checkTTTWinner = (board) => {
  for (const pattern of TTT_WIN_PATTERNS) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], pattern };
    }
  }
  if (board.every(cell => cell !== null)) {
    return { winner: 'draw', pattern: null };
  }
  return null;
};

const validateAndMakeMove = (chess, from, to) => {
  let move = chess.move({ from, to });
  if (!move) {
    const toRank = to[1];
    if (toRank === '8' || toRank === '1') {
      move = chess.move({ from, to, promotion: 'q' });
    }
  }
  return move;
};

io.on('connection', (socket) => {
  let socketUser = null;
  try {
    const cookieHeader = socket.handshake.headers?.cookie;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const [k, ...v] = c.trim().split('=');
          return [k, v.join('=')];
        })
      );
      const accessToken = cookies['accessToken'];
      if (accessToken) {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        socketUser = { userId: decoded.userId };
      }
    }
  } catch (e) {
  }

  if (!socketUser) {
    socket.disconnect(true);
    return;
  }

  logger.info('User connected:', socket.id);

  socket.emit('onlineUsersList', { userIds: getOnlineUsersArray() });

  chatHandlers(io, socket);

  socket.on('userConnected', async (data) => {
    const { userId } = data;
    if (!userId) return;
    const userIdStr = String(userId);
    onlineUsers.set(userIdStr, socket.id);
    socket.userId = userIdStr;
    socket.join(`user:${userIdStr}`);

    try {
      const user = await User.findById(userId).lean();
      if (user) {
        socket.user = { userId: userIdStr, name: user.name, role: user.role };

        const conversations = await Conversation.find({ participants: userId }).lean();
        for (const conv of conversations) {
          socket.join(conv.chatId);

          const missedMessages = await Chat.find({
            chatId: conv.chatId,
            recipientId: userId,
            status: 'sent',
            isDeleted: false
          }).lean();

          if (missedMessages.length > 0) {
            const messageIds = missedMessages.map(m => m._id);
            await Chat.updateMany(
              { _id: { $in: messageIds } },
              { status: 'delivered', deliveredAt: new Date() }
            );
            socket.emit('missedMessages', { messages: missedMessages, chatId: conv.chatId });
          }
        }
      }
    } catch (e) {
      logger.error('Reconnection handler error:', e.message);
    }

    logger.info(`User online: ${userIdStr}`);
    broadcastOnlineUsers();
  });

  socket.on('getOnlineUsers', () => {
    socket.emit('onlineUsersList', { userIds: getOnlineUsersArray() });
  });

  socket.on('leaveRoom', (data) => {
    const { chatId } = data;
    socket.leave(chatId);
  });

  socket.on('rejoinRoom', async (data) => {
    const { roomId, userId } = data;
    if (!roomId || !userId) {
      return socket.emit('roomError', { message: 'Room ID and user ID required' });
    }
    const room = gameRooms[roomId];
    if (!room) {
      return socket.emit('roomRestored', { success: false, message: 'Room no longer exists' });
    }
    socket.join(roomId);
    socket.currentGameRoom = roomId;
    if (room.status === 'waiting') {
      socket.emit('roomRestored', {
        success: true, status: 'waiting', roomId, gameType: room.gameType,
        isHost: String(room.hostId) === String(userId)
      });
    } else if (room.status === 'active' && room.gameId) {
      try {
        const game = await Game.findById(room.gameId)
          .populate('whitePlayer', 'name points totalWins')
          .populate('blackPlayer', 'name points totalWins');
        if (game) {
          socket.emit('roomRestored', {
            success: true, status: 'active', roomId, gameId: game._id,
            gameType: room.gameType, board: game.board || null, fen: game.fen,
            whitePlayer: game.whitePlayer, blackPlayer: game.blackPlayer,
            currentTurn: game.currentTurn,
            isHost: String(game.whitePlayer._id || game.whitePlayer) === String(userId)
          });
        } else {
          socket.emit('roomRestored', { success: false, message: 'Game not found' });
        }
      } catch (error) {
        socket.emit('roomRestored', { success: false, message: 'Error restoring game' });
      }
    } else {
      socket.emit('roomRestored', { success: false, message: 'Room game has ended' });
    }
  });

  socket.on('joinGameRoom', (data) => {
    const { gameId } = data;
    if (!gameId) return;
    socket.join(`game:${gameId}`);
  });

  socket.on('getAIMove', async (data) => {
    const { fen, skillLevel = 3 } = data;
    if (!fen) {
      return socket.emit('aiMoveError', { message: 'FEN required' });
    }
    const move = getBestMove(fen, skillLevel);
    if (move) {
      socket.emit('aiMove', { from: move.from, to: move.to });
    } else {
      socket.emit('aiMoveError', { message: 'No move available' });
    }
  });

  socket.on('getGameState', async (data) => {
    const { gameId } = data;
    if (!gameId) return;
    try {
      const game = await Game.findById(gameId)
        .populate('whitePlayer', 'name')
        .populate('blackPlayer', 'name')
        .populate('winner', 'name');
      if (!game) {
        return socket.emit('gameError', { message: 'Game not found' });
      }
      socket.emit('gameState', {
        gameId: game._id.toString(), fen: game.fen, currentTurn: game.currentTurn,
        whitePlayer: game.whitePlayer, blackPlayer: game.blackPlayer,
        isCheck: game.isCheck, isCheckmate: game.isCheckmate,
        isStalemate: game.isStalemate, winner: game.winner, status: game.status
      });
    } catch (error) {
      socket.emit('gameError', { message: 'Failed to fetch game state' });
    }
  });

  socket.on('createRoom', (data) => {
    const { userId, userName, gameType = 'chess' } = data;
    if (!userId || !userName) {
      return socket.emit('roomError', { message: 'User info required' });
    }
    if (!['chess', 'tictactoe'].includes(gameType)) {
      return socket.emit('roomError', { message: 'Invalid game type' });
    }
    const code = generateRoomCode();
    gameRooms[code] = {
      hostId: userId, hostName: userName, guestId: null, guestName: null,
      gameId: null, gameType, status: 'waiting', createdAt: new Date()
    };
    socket.join(code);
    socket.currentGameRoom = code;
    socket.emit('roomCreated', { roomId: code, gameType, message: 'Room created! Share the code.' });
  });

  socket.on('joinGameRoomByCode', async (data) => {
    const { code, userId, userName } = data;
    if (!code || !userId || !userName) {
      return socket.emit('roomError', { message: 'Code and user info required' });
    }
    const room = gameRooms[code];
    if (!room) {
      return socket.emit('roomError', { message: 'Room not found. Check the code.' });
    }
    if (room.status !== 'waiting') {
      return socket.emit('roomError', { message: 'Game already in progress.' });
    }
    if (String(room.hostId) === String(userId)) {
      return socket.emit('roomError', { message: 'You cannot join your own room.' });
    }
    room.guestId = userId;
    room.guestName = userName;
    room.status = 'active';
    socket.join(code);
    socket.currentGameRoom = code;
    try {
      const gameData = {
        whitePlayer: room.hostId, blackPlayer: room.guestId,
        gameType: room.gameType, status: 'active', startedAt: new Date()
      };
      if (room.gameType === 'chess') {
        gameData.fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        gameData.currentTurn = 'white';
      } else if (room.gameType === 'tictactoe') {
        gameData.board = Array(9).fill(null);
        gameData.currentTurn = 'X';
      }
      const game = new Game(gameData);
      await game.save();
      await game.populate('whitePlayer', 'name points totalWins');
      await game.populate('blackPlayer', 'name points totalWins');
      room.gameId = game._id;
      const gameEvent = {
        roomId: code, gameId: game._id.toString(), gameType: room.gameType,
        whitePlayer: game.whitePlayer, blackPlayer: game.blackPlayer,
        currentTurn: game.currentTurn
      };
      if (room.gameType === 'chess') gameEvent.fen = gameData.fen;
      else if (room.gameType === 'tictactoe') gameEvent.board = gameData.board;
      io.in(code).emit('gameStarted', gameEvent);
      const sockets = await io.in(code).fetchSockets();
      for (const s of sockets) {
        const isHost = String(s.userId) === String(room.hostId);
        if (room.gameType === 'tictactoe') {
          s.emit('assignRoles', { symbol: isHost ? 'X' : 'O', yourTurn: isHost });
        } else {
          s.emit('playerAssignment', { color: isHost ? 'white' : 'black' });
        }
        s.join(`game:${game._id.toString()}`);
      }
    } catch (error) {
      logger.error('Error creating game:', error);
      socket.emit('roomError', { message: 'Failed to create game.' });
    }
  });

  socket.on('deleteRoom', (data) => {
    const { roomId, userId } = data;
    if (!roomId || !userId) return;
    const room = gameRooms[roomId];
    if (!room) return;
    if (String(room.hostId) !== String(userId)) {
      return socket.emit('roomError', { message: 'Only the host can delete.' });
    }
    if (room.status === 'active') {
      return socket.emit('roomError', { message: 'Cannot delete active game.' });
    }
    delete gameRooms[roomId];
    socket.emit('roomDeleted', { roomId, message: 'Room deleted.' });
  });

  socket.on('makeMove', async (data) => {
    const { gameId, from, to, fen, userId } = data;
    if (!gameId || !from || !to || !fen) {
      return socket.emit('moveError', { message: 'Missing fields' });
    }
    try {
      const game = await Game.findById(gameId);
      if (!game) return socket.emit('moveError', { message: 'Game not found' });
      if (game.status !== 'active') return socket.emit('moveError', { message: 'Game not active' });
      const isWhitePlayer = String(game.whitePlayer) === String(userId);
      const isBlackPlayer = String(game.blackPlayer) === String(userId);
      if (!isWhitePlayer && !isBlackPlayer) return socket.emit('moveError', { message: 'Not in this game' });
      const expectedTurn = game.currentTurn === 'white' ? isWhitePlayer : isBlackPlayer;
      if (!expectedTurn) return socket.emit('moveError', { message: 'Not your turn' });
      const chess = new Chess(game.fen);
      const move = validateAndMakeMove(chess, from, to);
      if (!move) return socket.emit('moveError', { message: 'Illegal move' });
      const serverFen = chess.fen();
      game.moves.push({ from, to, fen: serverFen });
      game.fen = serverFen;
      const nextTurn = game.currentTurn === 'white' ? 'black' : 'white';
      const isCheck = chess.isCheck();
      const isCheckmate = chess.isCheckmate();
      const isStalemate = chess.isStalemate();
      game.currentTurn = nextTurn;
      game.isCheck = isCheck;
      game.isCheckmate = isCheckmate;
      game.isStalemate = isStalemate;
      let gameEnded = false;
      let winner = null;
      if (isCheckmate || isStalemate) {
        game.status = 'finished';
        game.endedAt = new Date();
        gameEnded = true;
        if (isCheckmate) {
          const winnerColor = nextTurn === 'white' ? 'black' : 'white';
          winner = winnerColor === 'white' ? game.whitePlayer : game.blackPlayer;
          game.winner = winner;
        }
      }
      await game.save();
      await game.populate('whitePlayer', 'name');
      await game.populate('blackPlayer', 'name');
      await game.populate('winner', 'name');
      let roomCode = null;
      for (const [code, room] of Object.entries(gameRooms)) {
        if (String(room.gameId) === String(gameId)) {
          roomCode = code;
          if (gameEnded) room.status = 'finished';
          break;
        }
      }
      const gameRoom = `game:${gameId}`;
      io.to(gameRoom).emit('moveMade', {
        gameId: gameId.toString(), from, to, fen: serverFen,
        currentTurn: game.currentTurn, isCheck, isCheckmate, isStalemate,
        winner: game.winner
      });
      if (gameEnded) {
        io.to(gameRoom).emit('gameEnded', {
          gameId: gameId.toString(), status: game.status,
          winner: game.winner, reason: isCheckmate ? 'checkmate' : 'stalemate'
        });
        if (winner && String(winner) !== 'cpu') {
          const winnerUser = await User.findById(winner);
          if (winnerUser) {
            await winnerUser.recordWin();
            io.emit('leaderboardUpdate', await getTopLeaderboard(10));
          }
        }
        if (roomCode) delete gameRooms[roomCode];
      }
    } catch (error) {
      logger.error('Processing error:', error.message);
    }
  });

  socket.on('endGame', async (data) => {
    const { gameId, result, winnerId, loserId, userId, isCPU } = data;
    if (!gameId) return socket.emit('gameError', { message: 'Game ID required' });
    try {
      const game = await Game.findById(gameId);
      if (!game || game.status === 'finished') {
        return socket.emit('gameError', { message: 'Game not found or ended' });
      }
      if (isCPU || winnerId === 'cpu') {
        game.status = result === 'draw' ? 'draw' : 'finished';
        game.endedAt = new Date();
        await game.save();
        socket.emit('gameEnded', { gameId, status: game.status, winner: winnerId, reason: result, isCPU: true });
        return;
      }
      const isPlayer = String(game.whitePlayer) === String(userId) || String(game.blackPlayer) === String(userId);
      if (!isPlayer) return socket.emit('gameError', { message: 'Not a player' });
      if (result === 'resign' && winnerId) {
        game.status = 'finished';
        game.winner = winnerId;
        game.endedAt = new Date();
        if (winnerId !== 'cpu') {
          const winner = await User.findById(winnerId);
          const loser = await User.findById(loserId);
          if (winner) await winner.recordWin();
          if (loser) await loser.recordLoss();
        }
      } else if (result === 'draw') {
        game.status = 'draw';
        game.endedAt = new Date();
      }
      await game.save();
      await game.populate('whitePlayer', 'name');
      await game.populate('blackPlayer', 'name');
      await game.populate('winner', 'name');
      io.to(`game:${gameId}`).emit('gameEnded', {
        gameId, status: game.status, winner: game.winner, reason: result
      });
      if (game.winner && game.winner !== 'cpu') {
        io.emit('leaderboardUpdate', await getTopLeaderboard(10));
      }
    } catch (error) {
      logger.error('End game error:', error);
      socket.emit('gameError', { message: 'Failed to end game' });
    }
  });

  socket.on('playAgain', async (data) => {
    const { roomId, userId } = data;
    if (!roomId || !userId) return;
    const room = gameRooms[roomId];
    if (!room) return socket.emit('gameError', { message: 'Room not found' });
    room.gameId = null;
    room.status = 'waiting';
    room.createdAt = new Date();
    socket.emit('playAgainStarted', { roomId, gameType: room.gameType, message: 'New game ready.' });
  });

  socket.on('tttMakeMove', async (data) => {
    const { roomId, index, symbol, userId } = data;
    if (!roomId || index === undefined || !symbol || !userId) {
      return socket.emit('tttMoveError', { message: 'Missing fields' });
    }
    try {
      const room = gameRooms[roomId];
      if (!room || !room.gameId) return socket.emit('tttMoveError', { message: 'Room not found' });
      const game = await Game.findById(room.gameId);
      if (!game || game.gameType !== 'tictactoe') return socket.emit('tttMoveError', { message: 'Game not found' });
      if (game.status !== 'active') return socket.emit('tttMoveError', { message: 'Game not active' });
      const board = game.board || Array(9).fill(null);
      if (board[index] !== null) return socket.emit('tttMoveError', { message: 'Cell already taken' });
      if (symbol !== game.currentTurn) return socket.emit('tttMoveError', { message: 'Not your turn' });
      board[index] = symbol;
      game.board = board;
      const nextTurn = symbol === 'X' ? 'O' : 'X';
      game.currentTurn = nextTurn;
      const result = checkTTTWinner(board);
      let gameEnded = false;
      let winner = null;
      if (result) {
        gameEnded = true;
        game.status = 'finished';
        game.endedAt = new Date();
        if (result.winner === 'X') { winner = game.whitePlayer; game.winner = winner; }
        else if (result.winner === 'O') { winner = game.blackPlayer; game.winner = winner; }
      }
      await game.save();
      await game.populate('whitePlayer', 'name');
      await game.populate('blackPlayer', 'name');
      await game.populate('winner', 'name');
      const gameRoom = `game:${game._id.toString()}`;
      io.to(gameRoom).emit('tttUpdateBoard', {
        gameId: game._id.toString(), board, currentTurn: game.currentTurn,
        lastMove: { index, symbol }, isGameOver: gameEnded
      });
      if (gameEnded) {
        io.to(gameRoom).emit('tttGameOver', {
          gameId: game._id.toString(), winner: result.winner,
          winningPlayer: game.winner, winningPattern: result.pattern,
          reason: result.winner === 'draw' ? 'draw' : 'win'
        });
        if (winner && String(winner) !== 'cpu') {
          const winnerUser = await User.findById(winner);
          if (winnerUser) {
            await winnerUser.recordWin();
            io.emit('leaderboardUpdate', await getTopLeaderboard(10));
          }
        }
        delete gameRooms[roomId];
      }
    } catch (error) {
      logger.error('TTT Move error:', error);
      socket.emit('tttMoveError', { message: 'Server error' });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      broadcastOnlineUsers();
    }
  });
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  connectDB();
});
