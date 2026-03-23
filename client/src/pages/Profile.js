/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User,
  Edit3,
  Save,
  X,
  Trophy,
  Award,
  Calendar,
  Mail,
  BookOpen,
  Clock,
  ChevronLeft,
  Loader2,
  Crown,
  Target,
  Flame,
  Star,
  Plus,
  Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import api from '../services/api';

const Profile = () => {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const { darkMode } = React.useContext(ThemeContext);
  const navigate = useNavigate();
  
  const isOwnProfile = !id || id === currentUser?._id;
  const profileId = id || currentUser?._id;
  
  const [profile, setProfile] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [newSkill, setNewSkill] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const glassCard = `rounded-2xl backdrop-blur-xl border ${
    darkMode ? 'bg-white/5 border-white/10' : 'bg-white/50 border-white/20'
  }`;

  useEffect(() => {
    loadProfile();
  }, [profileId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const userRes = isOwnProfile 
        ? await api.get('/auth/profile')
        : await api.get(`/auth/users/${profileId}`);
      
      const userData = isOwnProfile ? userRes.data.user : userRes.data;
      setProfile(userData);
      setEditForm({
        name: userData.name,
        bio: userData.bio || '',
        department: userData.department || '',
        skills: userData.skills || []
      });
      
      const gameRes = await api.get(`/games/history/${profileId}`);
      setGameHistory(gameRes.data.games || []);
    } catch (error) {
      console.error('Load profile error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.put('/auth/profile', editForm);
      setProfile(prev => ({ ...prev, ...editForm }));
      setIsEditing(false);
    } catch (error) {
      console.error('Save profile error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    setEditForm(prev => ({
      ...prev,
      skills: [...(prev.skills || []), { name: newSkill.trim(), level: 3 }]
    }));
    setNewSkill('');
  };

  const removeSkill = (index) => {
    setEditForm(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const updateSkillLevel = (index, level) => {
    setEditForm(prev => ({
      ...prev,
      skills: prev.skills.map((s, i) => i === index ? { ...s, level } : s)
    }));
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getGameResult = (game) => {
    const isPlayerWhite = String(game.whitePlayer?._id || game.whitePlayer) === String(profileId);
    if (game.status === 'draw') return { text: 'Draw', color: 'text-gray-400', bg: 'bg-gray-500/20' };
    if (String(game.winner) === String(profileId)) return { text: 'Won', color: 'text-green-400', bg: 'bg-green-500/20' };
    return { text: 'Lost', color: 'text-red-400', bg: 'bg-red-500/20' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className={`w-8 h-8 animate-spin ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`text-center py-12 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
        <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>Profile not found</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-blue-500">Go back</button>
      </div>
    );
  }

  const stats = [
    { label: 'Points', value: profile.points || 0, icon: Star, color: 'text-yellow-400' },
    { label: 'Wins', value: profile.totalWins || 0, icon: Trophy, color: 'text-green-400' },
    { label: 'Games', value: profile.gamesPlayed || 0, icon: Target, color: 'text-blue-400' },
    { label: 'Streak', value: profile.currentStreak || 0, icon: Flame, color: 'text-orange-400' }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20">
      <div className={`p-6 ${glassCard}`}>
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-500/30">
            {profile.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {profile.name}
                </h1>
                {profile.matricNo && (
                  <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    {profile.matricNo}
                  </p>
                )}
              </div>
              {isOwnProfile && !isEditing && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsEditing(true)}
                  className={`p-2 rounded-xl ${darkMode ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <Edit3 className="w-5 h-5" />
                </motion.button>
              )}
              {isEditing && (
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-2 rounded-xl bg-green-500 text-white"
                  >
                    <Save className="w-5 h-5" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setIsEditing(false); setEditForm({ name: profile.name, bio: profile.bio, department: profile.department, skills: profile.skills }); }}
                    className="p-2 rounded-xl bg-red-500 text-white"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
              )}
            </div>
            
            {isEditing ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Name</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full mt-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Department</label>
                  <input
                    type="text"
                    value={editForm.department || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                    className={`w-full mt-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Bio</label>
                  <textarea
                    value={editForm.bio || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value.slice(0, 200) }))}
                    placeholder="Tell us about yourself..."
                    className={`w-full mt-1 px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none ${
                      darkMode ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                    }`}
                    rows={3}
                  />
                  <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                    {(editForm.bio || '').length}/200
                  </span>
                </div>
                <div>
                  <label className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Skills</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(editForm.skills || []).map((skill, i) => (
                      <div key={i} className={`flex items-center gap-1 px-2 py-1 rounded-lg ${darkMode ? 'bg-white/10' : 'bg-gray-100'}`}>
                        <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>{skill.name}</span>
                        <select
                          value={skill.level}
                          onChange={(e) => updateSkillLevel(i, parseInt(e.target.value))}
                          className={`text-xs rounded px-1 ${darkMode ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          {[1, 2, 3, 4, 5].map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                        <button onClick={() => removeSkill(i)} className="text-red-400 hover:text-red-300">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add skill..."
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                        darkMode ? 'bg-white/5 border-white/10 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                      }`}
                      onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={addSkill}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {profile.department && (
                  <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    <BookOpen className="w-4 h-4 inline mr-1" />
                    {profile.department}
                  </p>
                )}
                {profile.bio && (
                  <p className={`mt-2 text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                    {profile.bio}
                  </p>
                )}
                {profile.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {profile.skills.map((skill, i) => (
                      <span
                        key={i}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          darkMode ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {skill.name}
                        <span className="ml-1 opacity-60">Lv.{skill.level}</span>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-4 gap-2 ${glassCard} p-4`}>
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="text-center"
          >
            <stat.icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
            <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
            <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className={`p-4 ${glassCard}`}>
        <div className="flex gap-2 mb-4">
          {['overview', 'games'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                  : darkMode ? 'bg-white/5 text-slate-400' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab === 'overview' ? 'Overview' : 'Match History'}
            </button>
          ))}
        </div>

        {activeTab === 'overview' ? (
          <div className="space-y-3">
            <div className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
              <Calendar className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
              <div>
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Member since</p>
                <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatDate(profile.createdAt)}
                </p>
              </div>
            </div>
            {profile.longestStreak > 0 && (
              <div className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                <Award className={`w-5 h-5 text-orange-400`} />
                <div>
                  <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>Longest Win Streak</p>
                  <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {profile.longestStreak} wins
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {gameHistory.length === 0 ? (
              <p className={`text-center py-8 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                No games played yet
              </p>
            ) : (
              gameHistory.map((game, i) => {
                const result = getGameResult(game);
                return (
                  <motion.div
                    key={game._id || i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center justify-between p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Crown className={`w-5 h-5 ${result.color}`} />
                      <div>
                        <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          vs {game.whitePlayer?._id === profileId ? game.blackPlayer?.name : game.whitePlayer?.name || 'Unknown'}
                        </p>
                        <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                          {formatDate(game.endedAt || game.startedAt)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${result.bg} ${result.color}`}>
                      {result.text}
                    </span>
                  </motion.div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
