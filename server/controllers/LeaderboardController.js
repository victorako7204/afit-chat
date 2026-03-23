const Game = require('../models/Game');
const User = require('../models/User');

const getLeaderboard = async (req, res, next) => {
  try {
    const { type = 'all', limit = 10 } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);

    const [dailyTop, weeklyTop, allTimeTop] = await Promise.all([
      Game.getDailyTop(parsedLimit),
      Game.getWeeklyTop(parsedLimit),
      Game.getAllTimeTop(parsedLimit)
    ]);

    const dailyLeaderboard = dailyTop.map((u, i) => ({
      ...u,
      rank: i + 1
    }));

    const weeklyLeaderboard = weeklyTop.map((u, i) => ({
      ...u,
      rank: i + 1
    }));

    const allTimeLeaderboard = allTimeTop.map((u, i) => ({
      ...u,
      rank: i + 1
    }));

    let userRank = null;
    if (req.user) {
      const allUsers = await User.find()
        .sort({ points: -1, totalWins: -1 })
        .select('_id points totalWins');

      const rankIndex = allUsers.findIndex(
        u => u._id.toString() === req.user._id.toString()
      );

      if (rankIndex !== -1) {
        const userData = allUsers[rankIndex];
        userRank = {
          rank: rankIndex + 1,
          totalUsers: allUsers.length,
          points: userData.points,
          totalWins: userData.totalWins
        };
      }
    }

    res.json({
      daily: dailyLeaderboard,
      weekly: weeklyLeaderboard,
      allTime: allTimeLeaderboard,
      userRank
    });
  } catch (error) {
    next(error);
  }
};

const getUserStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [user, gameStats, rankData] = await Promise.all([
      User.findById(userId).select('-password'),
      Game.getPlayerStats(userId),
      getLeaderboardInternal(userId)
    ]);

    res.json({
      user,
      gameStats,
      rank: rankData
    });
  } catch (error) {
    next(error);
  }
};

const getLeaderboardInternal = async (userId) => {
  const allUsers = await User.find()
    .sort({ points: -1, totalWins: -1 })
    .select('_id points totalWins');

  const rankIndex = allUsers.findIndex(
    u => u._id.toString() === userId.toString()
  );

  if (rankIndex === -1) return null;

  const userData = allUsers[rankIndex];
  return {
    rank: rankIndex + 1,
    totalUsers: allUsers.length,
    points: userData.points,
    totalWins: userData.totalWins
  };
};

module.exports = {
  getLeaderboard,
  getUserStats
};
