/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Edit3, Save, X, Trophy, Award, Calendar, Mail, BookOpen, Clock, ChevronLeft, Loader2, Crown, Target, Flame, Star, Plus, Trash2, Grid, Bookmark, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Profile = () => {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
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
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => { loadProfile(); }, [profileId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const userRes = isOwnProfile ? await api.get('/auth/profile') : await api.get(`/auth/users/${profileId}`);
      setProfile(userRes.data);
      setEditForm({
        name: userRes.data.name || '', bio: userRes.data.bio || '', department: userRes.data.department || '',
        avatar: userRes.data.avatar || '', skills: userRes.data.skills || []
      });
      if (profileId) {
        try {
          const historyRes = await api.get(`/games/history/${profileId}`);
          setGameHistory(historyRes.data?.games || []);
        } catch {}
      }
    } catch (err) { console.error('Load profile error:', err); }
    finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try { await api.put('/auth/profile/update', editForm); setIsEditing(false); loadProfile(); }
    catch (err) { console.error('Save error:', err); }
    finally { setIsSaving(false); }
  };

  const addSkill = () => {
    if (newSkill.trim() && !editForm.skills.includes(newSkill.trim())) {
      setEditForm(prev => ({ ...prev, skills: [...prev.skills, newSkill.trim()] }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill) => setEditForm(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-6 pb-4 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full skeleton" />
          <div className="w-32 h-4 rounded skeleton" />
          <div className="w-48 h-3 rounded skeleton" />
          <div className="flex gap-6 mt-2">
            <div className="w-12 h-6 rounded skeleton" />
            <div className="w-12 h-6 rounded skeleton" />
            <div className="w-12 h-6 rounded skeleton" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-0.5 mt-2">
          {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square skeleton" />)}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const placeholderPosts = [
    { _id: '1', image: null, likesCount: 0, content: '📚 Study session...' },
    { _id: '2', image: null, likesCount: 5, content: '🎉 Campus life!' },
    { _id: '3', image: null, likesCount: 12, content: '⚛️ Physics is fun' },
    { _id: '4', image: null, likesCount: 3, content: '💻 Coding all night' },
    { _id: '5', image: null, likesCount: 8, content: '📖 Reading...' },
    { _id: '6', image: null, likesCount: 2, content: '🏆 Game winner!' },
  ];

  return (
    <div className="flex flex-col" style={{backgroundColor:'var(--bg-primary)'}}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {!isOwnProfile && (
          <button onClick={() => navigate(-1)} className="btn-press">
            <ChevronLeft size={24} />
          </button>
        )}
        <span className="text-lg font-bold">{profile.name || 'Profile'}</span>
      </div>

      {/* Profile Info */}
      <div className="flex items-start gap-4 px-4 pb-4" style={{borderBottom:'1px solid var(--border)'}}>
        <div className="w-20 h-20 rounded-full overflow-hidden shrink-0" style={{backgroundColor:'var(--bg-tertiary)'}}>
          {profile.avatar ? (
            <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{backgroundColor:'var(--accent)',color:'white'}}>
              {(profile.name || 'U')[0]}
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">{profile.name}</h2>
            {isOwnProfile && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="px-4 py-1 text-xs font-semibold rounded" style={{backgroundColor:'var(--bg-tertiary)',color:'var(--text-primary)'}}>
                Edit Profile
              </button>
            )}
            {isOwnProfile && (
              <button className="btn-press">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span><strong>{placeholderPosts.length}</strong> posts</span>
            <span><strong>{profile.followers || profile.points || 0}</strong> followers</span>
            <span><strong>{profile.following || gameHistory.length || 0}</strong> following</span>
          </div>
          {profile.bio && <p className="text-sm mt-1">{profile.bio}</p>}
          {profile.department && (
            <p className="text-xs" style={{color:'var(--text-tertiary)'}}>
              {profile.department}
            </p>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{backgroundColor:'rgba(0,0,0,0.7)'}} onClick={() => setIsEditing(false)}>
          <div className="w-full max-w-[500px] rounded-t-2xl overflow-y-auto max-h-[80vh]" style={{backgroundColor:'var(--bg-secondary)'}} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:'1px solid var(--border)'}}>
              <button onClick={() => setIsEditing(false)} className="btn-press"><X size={20} /></button>
              <span className="text-sm font-semibold">Edit Profile</span>
              <button onClick={handleSave} disabled={isSaving} className="text-sm font-semibold" style={{color:'var(--accent)'}}>
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
              </button>
            </div>
            <div className="p-4 space-y-4">
              <input label="Name" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Name" className="w-full px-3 py-2 text-sm rounded" />
              <textarea label="Bio" value={editForm.bio} onChange={e => setEditForm({...editForm, bio: e.target.value})} placeholder="Bio" rows={3} className="w-full px-3 py-2 text-sm rounded resize-none" />
              <input label="Department" value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} placeholder="Department" className="w-full px-3 py-2 text-sm rounded" />
              <div>
                <p className="text-xs font-semibold mb-2" style={{color:'var(--text-secondary)'}}>SKILLS</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(editForm.skills || []).map(s => (
                    <span key={s} className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full" style={{backgroundColor:'var(--bg-tertiary)'}}>
                      {s}
                      <button onClick={() => removeSkill(s)} className="btn-press"><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newSkill} onChange={e => setNewSkill(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSkill()} placeholder="Add a skill" className="flex-1 px-3 py-1.5 text-xs rounded" />
                  <button onClick={addSkill} className="px-3 py-1.5 text-xs font-semibold rounded" style={{backgroundColor:'var(--accent)',color:'white'}}>Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-around py-3 px-4" style={{borderBottom:'1px solid var(--border)',backgroundColor:'var(--bg-secondary)'}}>
        <div className="flex flex-col items-center">
          <Trophy size={18} style={{color:'var(--accent)'}} />
          <span className="text-xs font-semibold mt-1">{profile.totalWins || 0}</span>
          <span className="text-[10px]" style={{color:'var(--text-tertiary)'}}>Wins</span>
        </div>
        <div className="flex flex-col items-center">
          <Award size={18} style={{color:'var(--accent)'}} />
          <span className="text-xs font-semibold mt-1">{profile.points || 0}</span>
          <span className="text-[10px]" style={{color:'var(--text-tertiary)'}}>Points</span>
        </div>
        <div className="flex flex-col items-center">
          <Flame size={18} style={{color:'var(--accent)'}} />
          <span className="text-xs font-semibold mt-1">{profile.currentStreak || 0}</span>
          <span className="text-[10px]" style={{color:'var(--text-tertiary)'}}>Streak</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex" style={{borderBottom:'1px solid var(--border)'}}>
        {[
          { key: 'posts', icon: Grid },
          { key: 'saved', icon: Bookmark },
          { key: 'tagged', icon: Heart },
        ].map(({ key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center py-3 border-t-2 transition-all btn-press ${
              activeTab === key ? 'opacity-100' : 'opacity-40'
            }`}
            style={{borderTopColor: activeTab === key ? 'var(--text-primary)' : 'transparent'}}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>

      {/* Grid */}
      {activeTab === 'posts' && (
        <div className="grid grid-cols-3 gap-0.5">
          {placeholderPosts.map(post => (
            <div key={post._id} className="aspect-square relative overflow-hidden cursor-pointer group" style={{backgroundColor:'var(--bg-secondary)'}}>
              <div className="w-full h-full flex items-center justify-center p-2 text-center">
                <span className="text-[10px] leading-tight" style={{color:'var(--text-tertiary)'}}>{post.content}</span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{backgroundColor:'rgba(0,0,0,0.5)'}}>
                <div className="flex items-center gap-1">
                  <Heart size={14} fill="white" stroke="white" />
                  <span className="text-xs font-semibold text-white">{post.likesCount}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-xs font-semibold text-white">{Math.floor(Math.random() * 10)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {activeTab === 'saved' && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-8">
          <Bookmark size={40} style={{color:'var(--text-tertiary)'}} />
          <p className="text-sm mt-3" style={{color:'var(--text-secondary)'}}>Save photos and videos that you want to see again</p>
          <p className="text-xs mt-1" style={{color:'var(--text-tertiary)'}}>No saved posts yet</p>
        </div>
      )}
      {activeTab === 'tagged' && (
        <div className="flex flex-col items-center justify-center py-16 text-center px-8">
          <Heart size={40} style={{color:'var(--text-tertiary)'}} />
          <p className="text-sm mt-3" style={{color:'var(--text-secondary)'}}>Photos and videos of you</p>
          <p className="text-xs mt-1" style={{color:'var(--text-tertiary)'}}>No tagged posts yet</p>
        </div>
      )}
    </div>
  );
};

export default Profile;
