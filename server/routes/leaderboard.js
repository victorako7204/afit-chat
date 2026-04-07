const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getLeaderboard, getUserStats } = require('../controllers/LeaderboardController');

router.get('/', auth, getLeaderboard);
router.get('/stats', auth, getUserStats);

module.exports = router;
