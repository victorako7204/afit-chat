const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
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
} = require('../controllers/gameController');

router.get('/leaderboard', auth, getLeaderboard);
router.post('/create', auth, createGame);
router.get('/waiting', auth, getWaitingGames);
router.get('/my', auth, getMyGames);
router.get('/history/:userId', auth, async (req, res) => {
  try {
    const Game = require('../models/Game');
    const games = await Game.find({
      $or: [
        { whitePlayer: req.params.userId },
        { blackPlayer: req.params.userId }
      ],
      status: { $in: ['finished', 'draw'] }
    })
      .populate('whitePlayer', 'name matricNo')
      .populate('blackPlayer', 'name matricNo')
      .populate('winner', 'name matricNo')
      .sort({ endedAt: -1 })
      .limit(20);
    
    res.json({ games });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/:gameId', auth, getGame);
router.post('/:gameId/move', auth, makeMove);
router.post('/:gameId/end', auth, endGame);
router.post('/announce', auth, announce);
router.get('/notifications/list', auth, getNotifications);
router.put('/notifications/:notificationId/read', auth, markNotificationRead);
router.put('/notifications/read-all', auth, markAllNotificationsRead);

module.exports = router;
