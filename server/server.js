require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const { getBestMove } = require('./chessAI');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const lostAndFoundRoutes = require('./routes/lostAndFound');
const libraryRoutes = require('./routes/library');
const groupRoutes = require('./routes/group');
const educationRoutes = require('./routes/education');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');
const notificationsRoutes = require('./routes/notifications');
const postsRoutes = require('./routes/posts');
const errorHandler = require('./middleware/errorHandler');
const Chat = require('./models/Chat');
const Game = require('./models/Game');
const User = require('./models/User');
const Conversation = require('./models/Conversation');

let sendPushNotification;
try {
  const notificationsModule = require('./routes/notifications');
  sendPushNotification = notificationsModule.sendPushNotification;
} catch (e) {
  console.log('Push notifications not available');
}

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;

// FIXED: Allow Vercel frontend and localhost
const io = new Server(server, {
  cors: {
    origin: ["https://afit-chat.vercel.app", "http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingInterval: 30000,
  pingTimeout: 90000,
  transports: ['websocket', 'polling']
});

app.set('io', io);

app.use(cors({
  origin: ["https://afit-chat.vercel.app", "http://localhost:3000", "http://localhost:3001"],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/lost-and-found', lostAndFoundRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/education', educationRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/posts', postsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not configured!');
    return false;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
    return true;
  } catch (err) {
    console.error('❌ MongoDB error:', err.message);
    return false;
  }
};

const saveMessageToDatabase = async (messageData) => {
  try {
    const { chatId, message, senderId } = messageData;
    
    if (!chatId || !message || !senderId) {
      throw new Error("Validation Failed: Missing critical message fields (chatId, message, senderId)");
    }

    const chat = new Chat({
      senderId: messageData.senderId || null,
      senderName: messageData.senderName || 'Anonymous',
      message: messageData.message.trim(),
      chatType: messageData.chatType || 'public',
      chatId: messageData.chatId,
      recipientId: messageData.recipientId || null,
      replyTo: messageData.replyTo || null,
      replyToMessage: messageData.replyToMessage || null,
      replyToSender: messageData.replyToSender || null
    });
    
    const savedChat = await chat.save();
    return await savedChat.populate('senderId', 'name matricNo');
  } catch (error) {
    console.error('❌ Database Save Crash:', error.message);
    throw error;
  }
};

const getChatHistory = async (chatId, limit = 50) => {
  try {
    const messages = await Chat.find({ chatId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'name matricNo')
      .lean();
    return messages.reverse();
  } catch (error) {
    console.error('❌ Error fetching chat history:', error.message);
    return [];
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
    .select('name matricNo department points totalWins');
  return topUsers.map((u, i) => ({ ...u.toObject(), rank: i + 1 }));
};

// ============================================
// MULTI-GAME ROOM SYSTEM
// ============================================
const gameRooms = {};

const generateRoomCode = () => {
  return Math.random().toString().substring(2, 8);
};

// Tic-Tac-Toe winning combinations
const TTT_WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
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

// Helper to validate and make chess move
const validateAndMakeMove = (chess, from, to) => {
  // Try without promotion first
  let move = chess.move({ from, to });
  
  // If failed and pawn reaches back rank (8 for white, 1 for black), try with promotion
  if (!move) {
    const toRank = to[1];
    if (toRank === '8' || toRank === '1') {
      move = chess.move({ from, to, promotion: 'q' });
    }
  }
  
  return move;
};

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.emit('onlineUsersList', { userIds: getOnlineUsersArray() });

  socket.on('userConnected', (data) => {
    const { userId } = data;
    if (!userId) return;
    const userIdStr = String(userId);
    onlineUsers.set(userIdStr, socket.id);
    socket.userId = userIdStr;
    socket.join(`user:${userIdStr}`);
    console.log(`✅ User online: ${userIdStr}`);
    broadcastOnlineUsers();
  });

  socket.on('getOnlineUsers', () => {
    socket.emit('onlineUsersList', { userIds: getOnlineUsersArray() });
  });

  socket.on('joinChatRoom', async (data) => {
    const { chatId } = data;
    if (!chatId) return;
    
    socket.join(chatId);
    console.log(`📥 Socket ${socket.id} joined chat room: ${chatId}`);
    
    // For direct messages (dm-user1-user2 format), notify recipient to join
    if (chatId.startsWith('dm-')) {
      const parts = chatId.split('-');
      if (parts.length >= 3) {
        // parts: ['dm', 'userId1', 'userId2']
        const userIds = parts.slice(1);
        userIds.forEach(userId => {
          if (userId !== socket.userId) {
            io.to(`user:${userId}`).emit('joinChatRoomRequest', { chatId });
            console.log(`📤 Sent joinChatRoomRequest to user: ${userId}`);
          }
        });
      }
    }
    
    const history = await getChatHistory(chatId);
    socket.emit('chatHistory', { chatId, messages: history });
    broadcastOnlineUsers();
  });

  socket.on('leaveRoom', (data) => {
    const { chatId } = data;
    socket.leave(chatId);
  });

  // ============================================
  // REJOIN ROOM
  // ============================================
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
        success: true,
        status: 'waiting',
        roomId: roomId,
        gameType: room.gameType,
        isHost: String(room.hostId) === String(userId)
      });
    } else if (room.status === 'active' && room.gameId) {
      try {
        const game = await Game.findById(room.gameId)
          .populate('whitePlayer', 'name matricNo points totalWins')
          .populate('blackPlayer', 'name matricNo points totalWins');

        if (game) {
          socket.emit('roomRestored', {
            success: true,
            status: 'active',
            roomId: roomId,
            gameId: game._id,
            gameType: room.gameType,
            board: game.board || null,
            fen: game.fen,
            whitePlayer: game.whitePlayer,
            blackPlayer: game.blackPlayer,
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

  // ============================================
  // JOIN GAME ROOM (for receiving game events)
  // ============================================
  socket.on('joinGameRoom', (data) => {
    const { gameId } = data;
    if (!gameId) return;
    const gameRoom = `game:${gameId}`;
    socket.join(gameRoom);
    console.log(`🎮 Player joined game room: ${gameRoom}`);
  });

  // ============================================
  // GET AI MOVE
  // ============================================
  socket.on('getAIMove', async (data) => {
    const { fen, skillLevel = 3 } = data;
    
    if (!fen) {
      return socket.emit('aiMoveError', { message: 'FEN required' });
    }

    console.log('🤖 Calculating AI move at depth', skillLevel);
    
    const move = getBestMove(fen, skillLevel);
    
    if (move) {
      console.log('🤖 AI best move:', move.from, '->', move.to);
      socket.emit('aiMove', { from: move.from, to: move.to });
    } else {
      console.log('🤖 No AI move available');
      socket.emit('aiMoveError', { message: 'No move available' });
    }
  });

  // ============================================
  // GET GAME STATE (for sync recovery)
  // ============================================
  socket.on('getGameState', async (data) => {
    const { gameId } = data;
    if (!gameId) return;

    try {
      const game = await Game.findById(gameId)
        .populate('whitePlayer', 'name matricNo')
        .populate('blackPlayer', 'name matricNo')
        .populate('winner', 'name matricNo');
      
      if (!game) {
        return socket.emit('gameError', { message: 'Game not found' });
      }

      console.log(`📤 Sending game state for: ${gameId}, FEN: ${game.fen}`);
      socket.emit('gameState', {
        gameId: game._id.toString(),
        fen: game.fen,
        currentTurn: game.currentTurn,
        whitePlayer: game.whitePlayer,
        blackPlayer: game.blackPlayer,
        isCheck: game.isCheck,
        isCheckmate: game.isCheckmate,
        isStalemate: game.isStalemate,
        winner: game.winner,
        status: game.status
      });
    } catch (error) {
      console.error('❌ Error fetching game state:', error.message);
      socket.emit('gameError', { message: 'Failed to fetch game state' });
    }
  });

  // ============================================
  // CREATE ROOM
  // ============================================
  socket.on('createRoom', (data) => {
    const { userId, userName, gameType = 'chess' } = data;
    
    console.log('🏠 Create room request:', { userId, userName, gameType });
    
    if (!userId || !userName) {
      return socket.emit('roomError', { message: 'User info required' });
    }

    if (!['chess', 'tictactoe'].includes(gameType)) {
      return socket.emit('roomError', { message: 'Invalid game type' });
    }

    const code = generateRoomCode();
    
    gameRooms[code] = {
      hostId: userId,
      hostName: userName,
      guestId: null,
      guestName: null,
      gameId: null,
      gameType,
      status: 'waiting',
      createdAt: new Date()
    };

    socket.join(code);
    socket.currentGameRoom = code;
    
    console.log('🏠 Room Created:', code, 'by', userName, 'for', gameType);
    
    socket.emit('roomCreated', { roomId: code, gameType, message: 'Room created! Share the code.' });
  });

  // ============================================
  // JOIN GAME ROOM BY CODE
  // ============================================
  socket.on('joinGameRoomByCode', async (data) => {
    const { code, userId, userName } = data;
    
    console.log('🎮 Join room request:', { code, userName });
    
    if (!code || !userId || !userName) {
      return socket.emit('roomError', { message: 'Code and user info required' });
    }

    const room = gameRooms[code];
    
    if (!room) {
      console.log('❌ Room not found:', code);
      return socket.emit('roomError', { message: 'Room not found. Check the code.' });
    }

    if (room.status !== 'waiting') {
      console.log('❌ Room not waiting:', code);
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
        whitePlayer: room.hostId,
        blackPlayer: room.guestId,
        gameType: room.gameType,
        status: 'active',
        startedAt: new Date()
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
      await game.populate('whitePlayer', 'name matricNo points totalWins');
      await game.populate('blackPlayer', 'name matricNo points totalWins');

      room.gameId = game._id;

      console.log('🎮 Game started in room:', code, 'Type:', room.gameType);

      const gameEvent = {
        roomId: code,
        gameId: game._id.toString(),
        gameType: room.gameType,
        whitePlayer: game.whitePlayer,
        blackPlayer: game.blackPlayer,
        currentTurn: game.currentTurn
      };

      if (room.gameType === 'chess') {
        gameEvent.fen = gameData.fen;
      } else if (room.gameType === 'tictactoe') {
        gameEvent.board = gameData.board;
      }

      io.in(code).emit('gameStarted', gameEvent);
      
      const sockets = await io.in(code).fetchSockets();
      for (const s of sockets) {
        const isHost = String(s.userId) === String(room.hostId);
        
        if (room.gameType === 'tictactoe') {
          const playerSymbol = isHost ? 'X' : 'O';
          const yourTurn = isHost;
          s.emit('assignRoles', { 
            symbol: playerSymbol,
            yourTurn
          });
          console.log(`🎨 TTT: Assigned ${s.userId} as ${playerSymbol}, yourTurn: ${yourTurn}`);
        } else {
          const playerColor = isHost ? 'white' : 'black';
          s.emit('playerAssignment', { 
            color: playerColor
          });
          console.log(`🎨 Chess: Assigned ${s.userId} as ${playerColor}`);
        }
        s.join(`game:${game._id.toString()}`);
      }
      
      console.log(`🎮 All players joined game room: game:${game._id}`);
    } catch (error) {
      console.error('❌ Error creating game:', error);
      socket.emit('roomError', { message: 'Failed to create game.' });
    }
  });

  // ============================================
  // DELETE ROOM
  // ============================================
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
    console.log('🗑️ Room deleted:', roomId);
    socket.emit('roomDeleted', { roomId, message: 'Room deleted.' });
  });

  // ============================================
  // MAKE MOVE
  // ============================================
  socket.on('makeMove', async (data) => {
    const { gameId, from, to, fen, userId } = data;

    console.log('📥 Move received:', { gameId, from, to, userId: userId?.substring(0, 8) });
    console.log('   Client FEN:', fen);

    if (!gameId || !from || !to || !fen) {
      console.log('❌ Missing fields');
      return socket.emit('moveError', { message: 'Missing fields' });
    }

    try {
      const game = await Game.findById(gameId);
      if (!game) {
        console.log('❌ Game not found:', gameId);
        return socket.emit('moveError', { message: 'Game not found' });
      }
      
      console.log('   Server FEN:', game.fen);
      console.log('   Turn:', game.currentTurn);
      
      if (game.status !== 'active') {
        console.log('❌ Game not active:', game.status);
        return socket.emit('moveError', { message: 'Game not active' });
      }

      const isWhitePlayer = String(game.whitePlayer) === String(userId);
      const isBlackPlayer = String(game.blackPlayer) === String(userId);

      if (!isWhitePlayer && !isBlackPlayer) {
        console.log('❌ User not in game');
        return socket.emit('moveError', { message: 'Not in this game' });
      }

      const expectedTurn = game.currentTurn === 'white' ? isWhitePlayer : isBlackPlayer;
      if (!expectedTurn) {
        console.log(`❌ Not ${isWhitePlayer ? 'white' : 'black'}'s turn. Current: ${game.currentTurn}`);
        return socket.emit('moveError', { message: 'Not your turn' });
      }

      // Server-side validation
      const chess = new Chess(game.fen);
      
      try {
        const move = validateAndMakeMove(chess, from, to);
        
        if (!move) {
          console.log(`❌ Illegal move: ${from} -> ${to}, FEN: ${game.fen}`);
          return socket.emit('moveError', { message: 'Illegal move' });
        }
        
        console.log(`✅ Move validated: ${from} -> ${to}, New FEN: ${chess.fen()}`);
      } catch (moveErr) {
        console.log(`❌ Move error: ${moveErr.message}`);
        return socket.emit('moveError', { message: 'Invalid move: ' + moveErr.message });
      }

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
          console.log(`👑 Checkmate! Winner: ${winnerColor}`);
        }
      }

      await game.save();
      await game.populate('whitePlayer', 'name matricNo');
      await game.populate('blackPlayer', 'name matricNo');
      await game.populate('winner', 'name matricNo');

      let roomCode = null;
      for (const [code, room] of Object.entries(gameRooms)) {
        if (String(room.gameId) === String(gameId)) {
          roomCode = code;
          if (gameEnded) room.status = 'finished';
          break;
        }
      }

      const gameRoom = `game:${gameId}`;
      console.log('✅ Move confirmed - emitting to game room:', gameRoom);
      
      io.to(gameRoom).emit('moveMade', {
        gameId: gameId.toString(), from, to, fen: serverFen,
        currentTurn: game.currentTurn,
        isCheck, isCheckmate, isStalemate,
        winner: game.winner
      });

      if (gameEnded) {
        io.to(gameRoom).emit('gameEnded', {
          gameId: gameId.toString(),
          status: game.status,
          winner: game.winner,
          reason: isCheckmate ? 'checkmate' : 'stalemate'
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
      console.error(`❌ Move error for game ${gameId}:`, error.message || error);
      socket.emit('moveError', { message: 'Server error: ' + (error.message || 'Unknown error') });
    }
  });

  // ============================================
  // END GAME
  // ============================================
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
      await game.populate('whitePlayer', 'name matricNo');
      await game.populate('blackPlayer', 'name matricNo');
      await game.populate('winner', 'name matricNo');

      io.to(`game:${gameId}`).emit('gameEnded', {
        gameId, status: game.status, winner: game.winner, reason: result
      });

      if (game.winner && game.winner !== 'cpu') {
        io.emit('leaderboardUpdate', await getTopLeaderboard(10));
      }
    } catch (error) {
      console.error('❌ End game error:', error);
      socket.emit('gameError', { message: 'Failed to end game' });
    }
  });

  // ============================================
  // PLAY AGAIN
  // ============================================
  socket.on('playAgain', async (data) => {
    const { roomId, userId } = data;

    if (!roomId || !userId) return;

    const room = gameRooms[roomId];
    if (!room) return socket.emit('gameError', { message: 'Room not found' });

    room.gameId = null;
    room.status = 'waiting';
    room.createdAt = new Date();

    socket.emit('playAgainStarted', {
      roomId,
      gameType: room.gameType,
      message: 'New game ready.'
    });
  });

  // ============================================
  // TIC-TAC-TOE MOVE
  // ============================================
  socket.on('tttMakeMove', async (data) => {
    const { roomId, index, symbol, userId } = data;

    console.log('⭕ TTT MakeMove received:', { roomId, index, symbol, userId });

    if (!roomId || index === undefined || !symbol || !userId) {
      return socket.emit('tttMoveError', { message: 'Missing fields' });
    }

    try {
      const room = gameRooms[roomId];
      if (!room || !room.gameId) {
        return socket.emit('tttMoveError', { message: 'Room not found' });
      }

      const game = await Game.findById(room.gameId);
      if (!game) {
        return socket.emit('tttMoveError', { message: 'Game not found' });
      }

      if (game.gameType !== 'tictactoe') {
        return socket.emit('tttMoveError', { message: 'Not a Tic-Tac-Toe game' });
      }

      if (game.status !== 'active') {
        return socket.emit('tttMoveError', { message: 'Game not active' });
      }

      const board = game.board || Array(9).fill(null);

      if (board[index] !== null) {
        return socket.emit('tttMoveError', { message: 'Cell already taken' });
      }

      const isXPlayer = String(game.whitePlayer) === String(userId);
      const expectedSymbol = game.currentTurn;

      if (symbol !== expectedSymbol) {
        return socket.emit('tttMoveError', { message: 'Not your turn' });
      }

      board[index] = symbol;
      game.board = board;

      const result = checkTTTWinner(board);
      const nextTurn = expectedSymbol === 'X' ? 'O' : 'X';
      game.currentTurn = nextTurn;

      let gameEnded = false;
      let winner = null;

      if (result) {
        gameEnded = true;
        game.status = 'finished';
        game.endedAt = new Date();

        if (result.winner === 'X') {
          winner = game.whitePlayer;
          game.winner = winner;
        } else if (result.winner === 'O') {
          winner = game.blackPlayer;
          game.winner = winner;
        }
      }

      await game.save();
      await game.populate('whitePlayer', 'name matricNo');
      await game.populate('blackPlayer', 'name matricNo');
      await game.populate('winner', 'name matricNo');

      const gameRoom = `game:${game._id.toString()}`;
      console.log('⭕ TTT UpdateBoard - emitting to:', gameRoom);
      
      io.to(gameRoom).emit('tttUpdateBoard', {
        gameId: game._id.toString(),
        board,
        currentTurn: game.currentTurn,
        lastMove: { index, symbol },
        isGameOver: gameEnded
      });

      if (gameEnded) {
        io.to(gameRoom).emit('tttGameOver', {
          gameId: game._id.toString(),
          winner: result.winner,
          winningPlayer: game.winner,
          winningPattern: result.pattern,
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
      console.error('❌ TTT Move error:', error);
      socket.emit('tttMoveError', { message: 'Server error: ' + error.message });
    }
  });

  // ============================================
  // CHAT
  // ============================================
  socket.on('sendMessage', async (data) => {
    try {
      const { chatId, message, chatType, senderId, senderName, recipientId, replyTo, replyToMessage, replyToSender } = data;
      
      if (!chatId || !message) {
        return socket.emit('messageError', { message: 'Cannot send empty message' });
      }

      const sender = await User.findById(senderId).lean();
      if (!sender) {
        return socket.emit('messageError', { message: 'User not found.' });
      }

      if (sender.status === 'suspended') {
        return socket.emit('messageError', { 
          message: 'ACCESS DENIED: Your account is suspended.' 
        });
      }

      if (sender.status === 'restricted' && chatType === 'public') {
        return socket.emit('messageError', { 
          message: 'RESTRICTED: You can only send Private Messages.' 
        });
      }

      const savedMessage = await saveMessageToDatabase({
        chatId, message, chatType, senderId, senderName, recipientId, replyTo, replyToMessage, replyToSender
      });

      const messageObj = {
        ...savedMessage.toObject(),
        senderId: String(senderId),
        recipientId: recipientId ? String(recipientId) : null,
        chatId,
        replyTo: replyTo || null,
        replyToMessage: replyToMessage || null,
        replyToSender: replyToSender || null
      };
      
      io.to(chatId).emit('receiveMessage', messageObj);

      if (chatType === 'private' && recipientId) {
        const recipientIdStr = String(recipientId);
        const isOnline = onlineUsers.has(recipientIdStr);
        
        Conversation.incrementUnreadForUser(chatId, recipientIdStr).catch(console.error);

        io.to(`user:${recipientIdStr}`).emit('receiveMessage', messageObj);
        
        io.to(`user:${recipientIdStr}`).emit('newMessageNotification', {
          senderId: String(senderId),
          senderName,
          message: message.substring(0, 50),
          chatId,
          timestamp: new Date().toISOString()
        });
        
        if (!isOnline && sendPushNotification) {
          await sendPushNotification(recipientIdStr, {
            title: `New message from ${senderName}`,
            body: message.substring(0, 100),
            icon: '/icon-192.png',
            tag: 'new-message',
            data: { chatId, senderId: String(senderId) }
          });
        }
      }
    } catch (error) {
      console.error('❌ sendMessage Handler Error:', error);
      socket.emit('messageError', { 
        message: 'Server failed to save your message. Please check your connection.' 
      });
    }
  });

  // ============================================
  // DELETE MESSAGE
  // ============================================
  socket.on('deleteMessage', async (data) => {
    const { chatId, messageId, userId } = data;
    
    if (!chatId || !messageId || !userId) {
      return socket.emit('deleteError', { message: 'Missing fields' });
    }

    try {
      const message = await Chat.findById(messageId);
      
      if (!message) {
        return socket.emit('deleteError', { message: 'Message not found' });
      }

      if (String(message.senderId) !== String(userId)) {
        return socket.emit('deleteError', { message: 'Not authorized to delete this message' });
      }

      await Chat.findByIdAndUpdate(messageId, { deleted: true, message: '' });

      io.to(chatId).emit('messageDeleted', { 
        messageId,
        chatId,
        deletedBy: userId
      });

      console.log('🗑️ Message deleted:', messageId, 'by user:', userId);
    } catch (error) {
      console.error('❌ Delete message error:', error);
      socket.emit('deleteError', { message: 'Failed to delete message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      broadcastOnlineUsers();
    }
  });
});

const startServer = async () => {
  console.log('🚀 Starting server...');
  await connectDB();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
};

startServer();
