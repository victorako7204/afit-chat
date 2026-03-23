import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { socket } from '../services/socket';

const GlobalAlert = () => {
  const [announcement, setAnnouncement] = useState(null);
  const [showCrownAlert, setShowCrownAlert] = useState(false);
  const [crownData, setCrownData] = useState(null);
  const [lostFoundAlerts, setLostFoundAlerts] = useState([]);

  const triggerConfetti = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1'];

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  useEffect(() => {
    const handleNewDailyLeader = (data) => {
      setCrownData(data);
      setShowCrownAlert(true);
      triggerConfetti();

      setTimeout(() => {
        setShowCrownAlert(false);
      }, 5000);
    };

    const handleGlobalAnnouncement = (data) => {
      if (data.type === 'LOST_FOUND' || data.type === 'Lost & Found') {
        const alertId = Date.now();
        setLostFoundAlerts(prev => [...prev, { ...data, alertId }]);

        setTimeout(() => {
          setLostFoundAlerts(prev => prev.filter(a => a.alertId !== alertId));
        }, 8000);
      } else {
        setAnnouncement(data);

        setTimeout(() => {
          setAnnouncement(null);
        }, 5000);
      }
    };

    socket.on('newDailyLeader', handleNewDailyLeader);
    socket.on('globalAnnouncement', handleGlobalAnnouncement);

    return () => {
      socket.off('newDailyLeader', handleNewDailyLeader);
      socket.off('globalAnnouncement', handleGlobalAnnouncement);
    };
  }, [triggerConfetti]);

  return (
    <>
      <AnimatePresence>
        {showCrownAlert && crownData && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50"
          >
            <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 shadow-2xl">
              <div className="max-w-4xl mx-auto px-4 py-3">
                <div className="flex items-center justify-center gap-4">
                  <motion.div
                    animate={{ 
                      rotate: [0, -10, 10, -10, 0],
                      scale: [1, 1.2, 1]
                    }}
                    transition={{ 
                      duration: 0.5,
                      repeat: 2
                    }}
                    className="text-4xl"
                  >
                    👑
                  </motion.div>
                  <div className="text-center">
                    <h3 className="text-white font-bold text-lg">
                      New King Crowned!
                    </h3>
                    <p className="text-white/90">
                      <span className="font-semibold">{crownData.user?.name || 'Unknown'}</span> has become the #1 Chess Champion!
                    </p>
                  </div>
                  <motion.div
                    animate={{ 
                      rotate: [0, 10, -10, 10, 0],
                      scale: [1, 1.2, 1]
                    }}
                    transition={{ 
                      duration: 0.5,
                      repeat: 2
                    }}
                    className="text-4xl"
                  >
                    👑
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {announcement && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed top-20 right-4 z-40 max-w-sm"
          >
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2">
                <div className="flex items-center gap-2 text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  <span className="font-semibold">{announcement.title || 'Announcement'}</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-slate-200 text-sm">
                  {announcement.message}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {announcement.sender}
                  </span>
                  <button
                    onClick={() => setAnnouncement(null)}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed top-20 left-4 right-4 z-40 pointer-events-none">
        <AnimatePresence>
          {lostFoundAlerts.map((alert) => (
            <motion.div
              key={alert.alertId}
              initial={{ y: -50, opacity: 0, x: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="pointer-events-auto mb-2"
            >
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl shadow-2xl overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="text-2xl">📢</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-white font-semibold text-sm">
                          Lost & Found Alert
                        </h4>
                        <button
                          onClick={() => setLostFoundAlerts(prev => prev.filter(a => a.alertId !== alert.alertId))}
                          className="text-white/70 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-white/90 text-sm mt-1">
                        {alert.message}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          alert.data?.itemType === 'lost' 
                            ? 'bg-red-500/30 text-white'
                            : 'bg-green-500/30 text-white'
                        }`}>
                          {alert.data?.itemType === 'lost' ? '🔴 Lost' : '🟢 Found'}
                        </span>
                        <span className="text-xs text-white/70">
                          {alert.sender}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-orange-600 to-amber-600" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};

export default GlobalAlert;
