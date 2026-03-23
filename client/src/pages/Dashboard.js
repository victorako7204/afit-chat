import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import { Card } from '../components/UI';

const Dashboard = () => {
  const { user } = useAuth();
  const { darkMode } = useContext(ThemeContext);

  const features = [
    {
      title: 'Public Chat',
      description: 'Join the campus-wide conversation with all students',
      link: '/public-chat',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      color: 'blue'
    },
    {
      title: 'Direct Messages',
      description: 'Chat privately with other students one-on-one',
      link: '/direct-chat',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: 'green'
    },
    {
      title: 'Groups',
      description: 'Join department groups and collaborate with peers',
      link: '/groups',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'purple'
    },
    {
      title: 'Anonymous Chat',
      description: 'Share ideas and feedback anonymously',
      link: '/anonymous-chat',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'yellow'
    },
    {
      title: 'Lost & Found',
      description: 'Report and find lost items on campus',
      link: '/lost-and-found',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      color: 'red'
    },
    {
      title: 'Library',
      description: 'Access and share study materials and resources',
      link: '/library',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      color: 'indigo'
    },
    {
      title: 'Education Hub',
      description: 'AI-generated study modules and quizzes',
      link: '/education',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      color: 'cyan'
    },
    {
      title: 'Chess Arena',
      description: 'Play chess and climb the leaderboard',
      link: '/chess',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      ),
      color: 'rose'
    },
    {
      title: 'Leaderboard',
      description: 'View top chess players and rankings',
      link: '/leaderboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'amber'
    }
  ];

  const colorClasses = {
    blue: darkMode 
      ? 'bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30' 
      : 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
    green: darkMode 
      ? 'bg-green-500/20 text-green-400 group-hover:bg-green-500/30' 
      : 'bg-green-50 text-green-600 group-hover:bg-green-100',
    purple: darkMode 
      ? 'bg-purple-500/20 text-purple-400 group-hover:bg-purple-500/30' 
      : 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
    yellow: darkMode 
      ? 'bg-yellow-500/20 text-yellow-400 group-hover:bg-yellow-500/30' 
      : 'bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100',
    red: darkMode 
      ? 'bg-red-500/20 text-red-400 group-hover:bg-red-500/30' 
      : 'bg-red-50 text-red-600 group-hover:bg-red-100',
    indigo: darkMode 
      ? 'bg-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/30' 
      : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100',
    cyan: darkMode 
      ? 'bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/30' 
      : 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100',
    rose: darkMode 
      ? 'bg-rose-500/20 text-rose-400 group-hover:bg-rose-500/30' 
      : 'bg-rose-50 text-rose-600 group-hover:bg-rose-100',
    amber: darkMode 
      ? 'bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30' 
      : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
          Welcome, {user?.name}
        </h1>
        <p className={`mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          {user?.department ? `${user.department} Department` : 'Campus Chat & Resource Platform'}
        </p>
        <div className="flex items-center gap-4 mt-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
            darkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
          }`}>
            {user?.matricNo}
          </span>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
            darkMode ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-700'
          }`}>
            {user?.role}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-slate-200' : 'text-gray-900'}`}>
          Quick Access
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <Link
              key={index}
              to={feature.link}
              className="group block"
            >
              <Card hover className={`h-full transition-all duration-200 hover-lift ${
                darkMode ? 'dark:bg-slate-800 dark:border-slate-700' : ''
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl transition-colors duration-200 ${colorClasses[feature.color]} group-hover:scale-110`}>
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold transition-colors ${
                      darkMode 
                        ? 'text-slate-200 group-hover:text-blue-400' 
                        : 'text-gray-900 group-hover:text-blue-600'
                    }`}>
                      {feature.title}
                    </h3>
                    <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="mt-8">
          <Link to="/admin" className="block">
            <Card className={`transition-all duration-200 ${
              darkMode 
                ? 'bg-gradient-to-r from-red-500/10 to-pink-500/10 border-red-500/30 hover:border-red-500/50' 
                : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200 hover:shadow-md'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-semibold ${darkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                    Admin Panel
                  </h3>
                  <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    Manage users and moderate content
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                  <svg className={`w-5 h-5 ${darkMode ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
