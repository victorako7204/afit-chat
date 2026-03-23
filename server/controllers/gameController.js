const Game = require('../models/Game');
const User = require('../models/User');
const Notification = require('../models/Notification');

const POINTS_WIN = 10;
const POINTS_LOSS = -5;
const POINTS_DRAW = 3;

const getLeaderboard = async (req, res, next) => {
  try {
    const { type = 'all', limit = 10 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);

    let dailyTop = [];
    let weeklyTop = [];
    let allTimeTop = [];

    const [daily, weekly, allTime] = await Promise.all([
      Game.getDailyTop(parsedLimit),
      Game.getWeeklyTop(parsedLimit),
      Game.getAllTimeTop(parsedLimit)
    ]);

    dailyTop = daily.map((u, i) => ({ ...u, rank: i + 1 }));
    weeklyTop = weekly.map((u, i) => ({ ...u, rank: i + 1 }));
    allTimeTop = allTime.map((u, i) => ({ ...u, rank: i + 1 }));

    const userRank = req.user ? await getUserRank(req.user._id) : null;

    res.json({
      dailyTop,
      weeklyTop,
      allTimeTop,
      userRank
    });
  } catch (error) {
    next(error);
  }
};

const getUserRank = async (userId) => {
  const allUsers = await User.find().sort({ points: -1, totalWins: -1 }).select('_id points totalWins');
  const rank = allUsers.findIndex(u => u._id.toString() === userId.toString()) + 1;
  const user = allUsers.find(u => u._id.toString() === userId.toString());
  return {
    rank,
    totalUsers: allUsers.length,
    points: user?.points || 0,
    totalWins: user?.totalWins || 0
  };
};

const createGame = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const existingGame = await Game.findOne({
      status: 'waiting',
      $or: [
        { whitePlayer: userId },
        { blackPlayer: userId }
      ]
    });

    if (existingGame) {
      return res.status(400).json({
        message: 'You already have a game in progress or waiting',
        game: existingGame
      });
    }

    const waitingGame = await Game.findWaitingGame(userId);

    if (waitingGame) {
      waitingGame.blackPlayer = userId;
      waitingGame.status = 'active';
      waitingGame.startedAt = new Date();

      await waitingGame.populate('whitePlayer', 'name matricNo');
      await waitingGame.populate('blackPlayer', 'name matricNo');
      await waitingGame.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`user:${waitingGame.whitePlayer._id}`).emit('gameStarted', {
          game: waitingGame,
          message: 'A player has joined your game!'
        });
      }

      return res.json({
        message: 'Game started!',
        game: waitingGame,
        isPlayer: true
      });
    }

    const game = new Game({
      whitePlayer: userId,
      status: 'waiting'
    });
    await game.populate('whitePlayer', 'name matricNo');
    await game.save();

    res.status(201).json({
      message: 'Looking for opponent...',
      game,
      isPlayer: true,
      waiting: true
    });
  } catch (error) {
    next(error);
  }
};

const getGame = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const userId = req.user._id;

    const game = await Game.findById(gameId)
      .populate('whitePlayer', 'name matricNo points')
      .populate('blackPlayer', 'name matricNo points')
      .populate('winner', 'name matricNo');

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    const isPlayer = game.whitePlayer._id.toString() === userId.toString() ||
                     game.blackPlayer?._id?.toString() === userId.toString();

    res.json({ game, isPlayer });
  } catch (error) {
    next(error);
  }
};

const makeMove = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const { from, to, fen, isCheck, isCheckmate, isStalemate } = req.body;
    const userId = req.user._id;

    const game = await Game.findById(gameId);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.status !== 'active') {
      return res.status(400).json({ message: 'Game is not active' });
    }

    const isWhitePlayer = game.whitePlayer.toString() === userId.toString();
    const isBlackPlayer = game.blackPlayer?.toString() === userId.toString();

    if (!isWhitePlayer && !isBlackPlayer) {
      return res.status(403).json({ message: 'You are not a player in this game' });
    }

    const expectedTurn = game.currentTurn === 'white' ? isWhitePlayer : isBlackPlayer;
    if (!expectedTurn) {
      return res.status(400).json({ message: 'Not your turn' });
    }

    game.moves.push({ from, to, fen });
    game.fen = fen;
    game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';
    game.isCheck = isCheck || false;
    game.isCheckmate = isCheckmate || false;
    game.isStalemate = isStalemate || false;

    if (isCheckmate || isStalemate) {
      game.status = 'finished';
      game.endedAt = new Date();

      if (isCheckmate) {
        game.winner = isWhitePlayer ? game.blackPlayer : game.whitePlayer;
      }
    }

    await game.save();
    await game.populate('whitePlayer', 'name matricNo');
    await game.populate('blackPlayer', 'name matricNo');
    await game.populate('winner', 'name matricNo');

    const io = req.app.get('io');
    if (io) {
      io.to(`game:${gameId}`).emit('moveMade', {
        gameId,
        from,
        to,
        fen,
        currentTurn: game.currentTurn,
        isCheck: game.isCheck,
        isCheckmate: game.isCheckmate,
        isStalemate: game.isStalemate,
        move: game.moves[game.moves.length - 1]
      });

      if (game.status === 'finished') {
        io.to(`game:${gameId}`).emit('gameEnded', {
          gameId,
          status: game.status,
          winner: game.winner,
          reason: isCheckmate ? 'checkmate' : 'stalemate'
        });
      }
    }

    res.json({ game });
  } catch (error) {
    next(error);
  }
};

const endGame = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const { result, winnerId } = req.body;
    const userId = req.user._id;

    const game = await Game.findById(gameId);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    if (game.status === 'finished') {
      return res.status(400).json({ message: 'Game already finished' });
    }

    const isPlayer = game.whitePlayer.toString() === userId.toString() ||
                     game.blackPlayer?.toString() === userId.toString();

    if (!isPlayer) {
      return res.status(403).json({ message: 'You are not a player in this game' });
    }

    const winner = winnerId ? await User.findById(winnerId) : null;
    const loser = winnerId
      ? (game.whitePlayer.toString() === winnerId ? game.blackPlayer : game.whitePlayer)
      : null;
    const loserUser = loser ? await User.findById(loser) : null;

    if (result === 'resign') {
      game.status = 'finished';
      game.winner = winnerId;
      game.endedAt = new Date();

      if (winner) await winner.recordWin();
      if (loserUser) await loserUser.recordLoss();
    } else if (result === 'draw') {
      game.status = 'draw';
      game.endedAt = new Date();

      const whiteUser = await User.findById(game.whitePlayer);
      const blackUser = await User.findById(game.blackPlayer);
      if (whiteUser) await whiteUser.recordDraw();
      if (blackUser) await blackUser.recordDraw();
    }

    await game.save();
    await game.populate('whitePlayer', 'name matricNo points');
    await game.populate('blackPlayer', 'name matricNo points');
    await game.populate('winner', 'name matricNo');

    const io = req.app.get('io');
    if (io) {
      io.to(`game:${gameId}`).emit('gameEnded', {
        gameId,
        status: game.status,
        winner: game.winner,
        reason: result
      });

      const previousLeader = await getUserRank(game.winner?._id || winnerId);

      const currentLeader = await User.find().sort({ points: -1 }).select('_id').limit(1);
      const isNewLeader = currentLeader[0]?._id.toString() === (game.winner?._id || winnerId)?.toString();

      if (isNewLeader && previousLeader?.rank === 1) {
        const leaderboard = await getLeaderboardData();
        io.emit('leaderboardUpdate', leaderboard);
        io.emit('newDailyLeader', {
          user: winner || game.winner,
          previousLeader: previousLeader,
          newLeader: currentLeader[0]
        });
      }
    }

    res.json({ game });
  } catch (error) {
    next(error);
  }
};

const getLeaderboardData = async () => {
  const [dailyTop, weeklyTop, allTimeTop] = await Promise.all([
    Game.getDailyTop(10),
    Game.getWeeklyTop(10),
    Game.getAllTimeTop(10)
  ]);

  return {
    dailyTop: dailyTop.map((u, i) => ({ ...u, rank: i + 1 })),
    weeklyTop: weeklyTop.map((u, i) => ({ ...u, rank: i + 1 })),
    allTimeTop: allTimeTop.map((u, i) => ({ ...u, rank: i + 1 }))
  };
};

const getMyGames = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, limit = 20 } = req.query;

    const query = {
      $or: [
        { whitePlayer: userId },
        { blackPlayer: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    const games = await Game.find(query)
      .populate('whitePlayer', 'name matricNo')
      .populate('blackPlayer', 'name matricNo')
      .populate('winner', 'name matricNo')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json(games);
  } catch (error) {
    next(error);
  }
};

const getWaitingGames = async (req, res, next) => {
  try {
    const waitingGames = await Game.find({ status: 'waiting' })
      .populate('whitePlayer', 'name matricNo points totalWins')
      .sort({ createdAt: 1 })
      .limit(20);

    res.json(waitingGames);
  } catch (error) {
    next(error);
  }
};

const announce = async (req, res, next) => {
  try {
    const { title, message } = req.body;
    const userId = req.user._id;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const notification = await Notification.createGlobalAnnouncement(
      title,
      message,
      userId,
      req.user.name
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('globalAnnouncement', {
        id: notification._id,
        title,
        message,
        sender: req.user.name,
        createdAt: notification.createdAt
      });

      io.emit('newNotification', {
        id: notification._id,
        type: 'ANNOUNCEMENT',
        title,
        message,
        isGlobal: true
      });
    }

    res.status(201).json({
      message: 'Announcement sent',
      notification
    });
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { limit = 50 } = req.query;

    const notifications = await Notification.getUserNotifications(userId, parseInt(limit));
    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    const notification = await Notification.markAsRead(notificationId, userId);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    await Notification.markAllAsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeaderboard,
  createGame,
  getGame,
  makeMove,
  endGame,
  getMyGames,
  getWaitingGames,
  announce,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
