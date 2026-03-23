/* eslint-disable */
import React, { useState, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import { Card } from '../components/UI';
import { Target, Zap, Settings, ChevronRight, Trophy } from 'lucide-react';
import VectorGame from '../games/components/VectorGame';
import LogicGame from '../games/components/LogicGame';
import StructuralGame from '../games/components/StructuralGame';
import PacketGame from '../games/components/PacketGame';

const STORAGE_KEY = 'afit_arcade_highscores';

const loadHighScores = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

const saveHighScores = (scores) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch (e) {
    console.error('Failed to save high scores:', e);
  }
};

const GAMES = {
  vector: {
    name: 'AFIT Vector Command',
    icon: Target,
    color: '#3b82f6',
    bgGradient: 'from-blue-600 to-cyan-500',
    description: 'Master 2D projectile physics. Calculate trajectory to hit targets.',
    discipline: 'Physics / Aerospace',
    component: VectorGame
  },
  logic: {
    name: 'Logic Gate Overload',
    icon: Zap,
    color: '#10b981',
    bgGradient: 'from-emerald-500 to-teal-500',
    description: 'Build boolean circuits. Match truth tables using logic gates.',
    discipline: 'Computer Science / EE',
    component: LogicGame
  },
  structural: {
    name: 'Structural Integrity',
    icon: Settings,
    color: '#f59e0b',
    bgGradient: 'from-amber-500 to-orange-500',
    description: 'Engineer bridges. Analyze tension, compression, and failure.',
    discipline: 'Civil / Mechanical',
    component: StructuralGame
  },
  packet: {
    name: 'The Packet Router',
    icon: Zap,
    color: '#8b5cf6',
    bgGradient: 'from-violet-500 to-purple-500',
    description: 'Route network packets. Sort by IP/Port. Block malicious traffic.',
    discipline: 'Cyber / IT',
    component: PacketGame
  }
};

const GameArcade = () => {
  const { darkMode } = useContext(ThemeContext);
  const { user } = useAuth();
  const [selectedGame, setSelectedGame] = useState(null);
  const [highScores, setHighScores] = useState(loadHighScores);

  const updateHighScore = (game, score) => {
    const newScores = { ...highScores, [game]: Math.max(highScores[game] || 0, score) };
    setHighScores(newScores);
    saveHighScores(newScores);

    if (user?._id) {
      socket?.emit('updateAfitRank', {
        userId: user._id,
        game,
        score
      });
    }
  };

  const renderGame = () => {
    if (!selectedGame) return null;
    
    const GameComponent = GAMES[selectedGame]?.component;
    if (!GameComponent) return null;

    return (
      <GameComponent
        onBack={() => setSelectedGame(null)}
        highScore={highScores[selectedGame]}
        updateHighScore={(score) => updateHighScore(selectedGame, score)}
      />
    );
  };

  if (selectedGame) {
    return renderGame();
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className={`text-3xl md:text-4xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          AFIT Arcade
        </h1>
        <p className={`text-lg ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
          Educational Engineering Games for Students
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(GAMES).map(([key, game]) => {
          const Icon = game.icon;
          return (
            <Card
              key={key}
              padding="p-6"
              className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br ${game.bgGradient}`}
              onClick={() => setSelectedGame(key)}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-white">{game.name}</h3>
                    <div className="flex items-center gap-1 text-white/80">
                      <Trophy className="w-4 h-4" />
                      <span className="text-sm font-mono">{highScores[key] || 0}</span>
                    </div>
                  </div>
                  <p className="text-sm text-white/80 mb-2">{game.description}</p>
                  <span className="inline-block px-2 py-1 bg-white/20 rounded text-xs text-white">
                    {game.discipline}
                  </span>
                </div>
                <ChevronRight className="w-6 h-6 text-white/60 self-center" />
              </div>
            </Card>
          );
        })}
      </div>

      <Card padding="p-6 mt-8" className={darkMode ? 'bg-slate-800/50' : 'bg-gray-100'}>
        <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Your High Scores
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(GAMES).map(([key, game]) => (
            <div key={key} className="text-center">
              <div className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {highScores[key] || 0}
              </div>
              <div className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                {game.name.split(' ')[0]}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default GameArcade;
