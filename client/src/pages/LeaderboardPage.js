import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import api from '../services/api';

const LeaderboardPage = () => {
  const { user } = useAuth();
  const { darkMode } = React.useContext(ThemeContext);
  const [activeTab, setActiveTab] = useState('daily');
  const [leaderboard, setLeaderboard] = useState({ daily: [], weekly: [], allTime: [], userRank: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/leaderboard');
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'daily', label: 'Daily Kings', icon: '☀️' },
    { id: 'weekly', label: 'Weekly Warriors', icon: '📅' },
    { id: 'allTime', label: 'All-Time Legends', icon: '🏆' }
  ];

  const currentData = leaderboard[activeTab] || [];
  const top3 = currentData.slice(0, 3);

  const getAvatarColor = (rank) => {
    if (rank === 1) return 'from-yellow-400 to-orange-500';
    if (rank === 2) return 'from-gray-300 to-gray-400';
    if (rank === 3) return 'from-amber-600 to-amber-700';
    return darkMode ? 'from-slate-600 to-slate-700' : 'from-blue-500 to-blue-600';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className={`text-3xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
          Hall of Fame
        </h1>
        <p className={`mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          Top chess players on the leaderboard
        </p>
      </div>

      {leaderboard.userRank && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-4 mb-6 ${
            darkMode ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30' : 'bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Your Ranking</span>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                  #{leaderboard.userRank.rank}
                </span>
                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  of {leaderboard.userRank.totalUsers}
                </span>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Points</span>
                <div className={`text-xl font-bold ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  {leaderboard.userRank.points}
                </div>
              </div>
              <div className="text-center">
                <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Wins</span>
                <div className={`text-xl font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                  {leaderboard.userRank.totalWins}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                : darkMode
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {top3.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-end justify-center gap-4">
            {top3[1] && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center"
              >
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getAvatarColor(2)} flex items-center justify-center text-white text-xl font-bold shadow-lg mb-2`}>
                  {top3[1].name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-2xl">🥈</span>
                <span className={`font-semibold ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}>
                  {top3[1].name}
                </span>
                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {top3[1].totalWins || top3[1].weeklyWins || top3[1].dailyWins} wins
                </span>
                <div className={`mt-1 px-3 py-1 rounded-full text-sm font-bold ${
                  darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'
                }`}>
                  #{2}
                </div>
              </motion.div>
            )}

            {top3[0] && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center"
              >
                <div className="absolute -top-2">
                  <span className="text-4xl">👑</span>
                </div>
                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getAvatarColor(1)} flex items-center justify-center text-white text-3xl font-bold shadow-xl mb-2 ring-4 ${
                  darkMode ? 'ring-yellow-500/50' : 'ring-yellow-400'
                }`}>
                  {top3[0].name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-3xl">🥇</span>
                <span className={`font-bold text-lg ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  {top3[0].name}
                </span>
                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {top3[0].totalWins || top3[0].weeklyWins || top3[0].dailyWins} wins
                </span>
                <div className="mt-2 px-4 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-bold">
                  #{1}
                </div>
              </motion.div>
            )}

            {top3[2] && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col items-center"
              >
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getAvatarColor(3)} flex items-center justify-center text-white text-xl font-bold shadow-lg mb-2`}>
                  {top3[2].name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-2xl">🥉</span>
                <span className={`font-semibold ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}>
                  {top3[2].name}
                </span>
                <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {top3[2].totalWins || top3[2].weeklyWins || top3[2].dailyWins} wins
                </span>
                <div className={`mt-1 px-3 py-1 rounded-full text-sm font-bold ${
                  darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'
                }`}>
                  #{3}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={`rounded-2xl overflow-hidden ${
          darkMode ? 'bg-slate-800/50 backdrop-blur-xl border border-slate-700' : 'bg-white shadow-lg'
        }`}
      >
        <div className={`px-6 py-4 border-b ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
          <h2 className={`font-bold text-lg ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : currentData.length === 0 ? (
          <div className={`p-8 text-center ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            No data available yet. Be the first to play!
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-700">
            {currentData.map((entry, index) => (
              <motion.div
                key={entry._id || index}
                variants={itemVariants}
                className={`px-6 py-4 flex items-center gap-4 hover:${
                  darkMode ? 'bg-slate-700/50' : 'bg-gray-50'
                } transition-colors ${entry._id === user?._id ? (darkMode ? 'bg-blue-500/10' : 'bg-blue-50') : ''}`}
              >
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getAvatarColor(entry.rank)} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                  {entry.name?.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                      {entry.name}
                    </span>
                    {entry._id === user?._id && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                      }`}>
                        You
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    {entry.matricNo} {entry.department && `• ${entry.department}`}
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-xl font-bold ${
                    entry.rank === 1 ? 'text-yellow-500' : darkMode ? 'text-slate-100' : 'text-gray-900'
                  }`}>
                    {entry.points || entry.totalWins || entry.weeklyWins || entry.dailyWins}
                  </div>
                  <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    {entry.points ? 'pts' : 'wins'}
                  </div>
                </div>

                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                  entry.rank === 1
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                    : entry.rank === 2
                    ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                    : entry.rank === 3
                    ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
                    : darkMode
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {entry.rank}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className={`mt-6 rounded-xl p-4 text-center ${
          darkMode ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30' : 'bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200'
        }`}
      >
        <p className={darkMode ? 'text-slate-300' : 'text-gray-600'}>
          <span className="font-semibold">Want to climb the ranks?</span> Play chess games to earn points and compete with other students!
        </p>
      </motion.div>
    </div>
  );
};

export default LeaderboardPage;
