const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  gameType: {
    type: String,
    enum: ['chess', 'tictactoe'],
    default: 'chess'
  },
  whitePlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blackPlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fen: {
    type: String,
    default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  },
  board: [{
    type: String,
    default: null
  }],
  status: {
    type: String,
    enum: ['waiting', 'active', 'finished', 'draw'],
    default: 'waiting'
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  moves: [{
    from: String,
    to: String,
    fen: String,
    timestamp: { type: Date, default: Date.now }
  }],
  currentTurn: {
    type: String,
    enum: ['white', 'black', 'X', 'O'],
    default: 'white'
  },
  isCheck: {
    type: Boolean,
    default: false
  },
  isCheckmate: {
    type: Boolean,
    default: false
  },
  isStalemate: {
    type: Boolean,
    default: false
  },
  spectators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  startedAt: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

gameSchema.index({ whitePlayer: 1, blackPlayer: 1, status: 1 });
gameSchema.index({ status: 1, createdAt: -1 });

gameSchema.statics.findWaitingGame = async function(excludeUserId) {
  return this.findOne({
    status: 'waiting',
    whitePlayer: { $ne: excludeUserId },
    blackPlayer: { $ne: excludeUserId }
  }).sort({ createdAt: 1 });
};

gameSchema.statics.getPlayerStats = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: {
        $or: [
          { whitePlayer: userId },
          { blackPlayer: userId }
        ],
        status: 'finished'
      }
    },
    {
      $group: {
        _id: null,
        totalGames: { $sum: 1 },
        wins: {
          $sum: { $cond: [{ $eq: ['$winner', userId] }, 1, 0] }
        },
        losses: {
          $sum: { $cond: [{ $and: [{ $ne: ['$winner', null] }, { $ne: ['$winner', userId] }] }, 1, 0] }
        },
        draws: {
          $sum: { $cond: [{ $eq: ['$status', 'draw'] }, 1, 0] }
        }
      }
    }
  ]);
  return stats[0] || { totalGames: 0, wins: 0, losses: 0, draws: 0 };
};

gameSchema.statics.getDailyTop = async function(limit = 10) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return this.aggregate([
    {
      $match: {
        status: 'finished',
        endedAt: { $gte: startOfDay }
      }
    },
    {
      $group: {
        _id: '$winner',
        dailyWins: { $sum: 1 }
      }
    },
    { $sort: { dailyWins: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: '$user._id',
        name: '$user.name',
        matricNo: '$user.matricNo',
        department: '$user.department',
        dailyWins: 1,
        points: '$user.points',
        totalWins: '$user.totalWins'
      }
    }
  ]);
};

gameSchema.statics.getWeeklyTop = async function(limit = 10) {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  startOfWeek.setHours(0, 0, 0, 0);

  return this.aggregate([
    {
      $match: {
        status: 'finished',
        endedAt: { $gte: startOfWeek }
      }
    },
    {
      $group: {
        _id: '$winner',
        weeklyWins: { $sum: 1 }
      }
    },
    { $sort: { weeklyWins: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: '$user._id',
        name: '$user.name',
        matricNo: '$user.matricNo',
        department: '$user.department',
        weeklyWins: 1,
        points: '$user.points',
        totalWins: '$user.totalWins'
      }
    }
  ]);
};

gameSchema.statics.getAllTimeTop = async function(limit = 10) {
  return this.aggregate([
    {
      $match: {
        status: 'finished'
      }
    },
    {
      $group: {
        _id: '$winner',
        totalWins: { $sum: 1 }
      }
    },
    { $sort: { totalWins: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: '$user._id',
        name: '$user.name',
        matricNo: '$user.matricNo',
        department: '$user.department',
        totalWins: 1,
        points: '$user.points'
      }
    }
  ]);
};

module.exports = mongoose.model('Game', gameSchema);
