/* eslint-disable */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, XCircle, ChevronLeft, ArrowLeft, Gamepad2 } from 'lucide-react';
import { ThemeContext } from '../App';

const GAMES = [
  {
    id: 'chess',
    name: 'Grandmaster Chess',
    description: 'Classic chess with AI opponent or multiplayer',
    icon: Crown,
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/30',
    accentColor: 'text-amber-400'
  },
  {
    id: 'tictactoe',
    name: 'AFIT Tic-Tac-Toe',
    description: 'Quick rounds of X vs O multiplayer',
    icon: XCircle,
    color: 'from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    accentColor: 'text-blue-400'
  }
];

const GameLobby = () => {
  const { darkMode } = React.useContext(ThemeContext);
  const navigate = useNavigate();

  const glassCard = `rounded-3xl backdrop-blur-xl border ${
    darkMode ? 'bg-white/5 border-white/10' : 'bg-white/50 border-white/20'
  }`;

  const handleGameSelect = (gameId) => {
    if (gameId === 'chess') {
      navigate('/chess');
    } else if (gameId === 'tictactoe') {
      navigate('/tictactoe');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 min-h-screen">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/')}
          className={`p-2 rounded-xl transition-colors ${
            darkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
          }`}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Game Arena
          </h1>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            Choose your game and challenge others
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {GAMES.map((game, index) => {
          const Icon = game.icon;
          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleGameSelect(game.id)}
              className={`${glassCard} p-6 cursor-pointer group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl`}
            >
              <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-gradient-to-br ${game.color} shadow-lg group-hover:shadow-xl transition-shadow`}>
                <Icon className="w-10 h-10 text-white" />
              </div>

              <h2 className={`text-xl font-bold text-center mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {game.name}
              </h2>

              <p className={`text-sm text-center mb-4 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {game.description}
              </p>

              <div className={`${game.bgColor} ${game.borderColor} border rounded-xl p-3`}>
                <div className="flex items-center justify-center gap-2">
                  <Gamepad2 className={`w-4 h-4 ${game.accentColor}`} />
                  <span className={`text-sm font-medium ${game.accentColor}`}>
                    Play Now
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={`mt-8 p-6 rounded-2xl ${glassCard} text-center`}
      >
        <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
          darkMode ? 'bg-purple-500/20' : 'bg-purple-100'
        }`}>
          <Crown className={`w-6 h-6 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
        </div>
        <h3 className={`text-lg font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Compete for the Leaderboard
        </h3>
        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          Win games across all modes to climb the rankings and earn points!
        </p>
      </motion.div>
    </div>
  );
};

export default GameLobby;
