/* eslint-disable */
import React, { useRef, useEffect, useState, useCallback, useContext } from 'react';
import { ThemeContext } from '../../App';
import { Card, Button } from '../../components/UI';
import { ArrowLeft, Trophy, RotateCcw, Play, Pause, Target, Wind, Zap, AlertTriangle } from 'lucide-react';
import { useGameLoop } from '../hooks/useGameLoop';
import VectorEngine from '../engines/VectorEngine';

const STORAGE_KEY = 'afit_arcade_highscores_vector';

const loadHighScore = () => {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch { return 0; }
};

const saveHighScore = (score) => {
  try {
    localStorage.setItem(STORAGE_KEY, score.toString());
  } catch {}
};

const VectorGame = ({ onBack, highScore: propHighScore, updateHighScore }) => {
  const { darkMode } = useContext(ThemeContext);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const stateRef = useRef({
    velocity: 50,
    angle: 45,
    wind: 0,
    level: 1,
    score: 0,
    shots: 0,
    isAnimating: false,
    result: null,
    trajectory: [],
    projectile: { x: 30, y: 0, active: false },
    explosion: { active: false, x: 0, y: 0, frame: 0 },
    target: null,
    gameStarted: false
  });

  const [localScore, setLocalScore] = useState(0);
  const [highScore, setHighScore] = useState(propHighScore || loadHighScore());

  useEffect(() => {
    engineRef.current = new VectorEngine({ canvasWidth: 800, canvasHeight: 500, gravity: 9.81 });
    const target = engineRef.current.generateTarget(1);
    stateRef.current.target = target;
    stateRef.current.wind = engineRef.current.generateWind(1);
  }, []);

  const calculateNextState = useCallback((dt) => {
    const state = stateRef.current;
    if (!state.isAnimating) return;

    const proj = state.projectile;
    if (proj.active && engineRef.current) {
      proj.t = (proj.t || 0) + dt;
      const pos = engineRef.current.getPosition(state.velocity, state.angle, proj.t, state.wind);
      
      const canvas = canvasRef.current;
      const scale = 5;
      proj.x = 30 + pos.x * scale;
      proj.y = (canvas?.height || 500) - 20 + pos.y * scale;

      if (pos.y > 1 && state.explosion.active) {
        proj.active = false;
      }

      if (state.target && proj.y >= (canvas?.height || 500) - 20 - state.target.y * scale) {
        const targetX = 30 + state.target.x * scale;
        const targetY = (canvas?.height || 500) - 20 + state.target.y * scale;
        const dx = proj.x - targetX;
        const dy = proj.y - targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= state.target.radius * scale) {
          state.explosion = { active: true, x: proj.x, y: proj.y, frame: 0 };
          const hitResult = engineRef.current.checkHit(state.velocity, state.angle, state.target, state.wind);
          const shotScore = engineRef.current.calculateScore(hitResult, state.velocity, state.angle);
          state.score += shotScore;
          state.result = { hit: true, ...hitResult };
          setLocalScore(state.score);
          
          const newHigh = Math.max(highScore, state.score);
          setHighScore(newHigh);
          saveHighScore(newHigh);
          if (updateHighScore) updateHighScore(newHigh);

          setTimeout(() => {
            state.level++;
            state.target = engineRef.current.generateTarget(state.level);
            state.wind = engineRef.current.generateWind(state.level);
            state.isAnimating = false;
            state.result = null;
            state.trajectory = [];
            state.projectile = { x: 30, y: 0, active: false, t: 0 };
          }, 2000);
        } else {
          proj.active = false;
          state.result = { hit: false, distance: dist / scale };
          setTimeout(() => {
            state.isAnimating = false;
            state.result = null;
            state.trajectory = [];
          }, 1500);
        }
      }
    }

    if (state.explosion.active) {
      state.explosion.frame++;
      if (state.explosion.frame > 30) {
        state.explosion.active = false;
      }
    }
  }, []);

  const renderScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const state = stateRef.current;
    const { width, height } = canvas;

    ctx.fillStyle = darkMode ? '#0f172a' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = darkMode ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const groundY = height - 20;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, groundY, width, 20);

    if (state.target) {
      const scale = 5;
      const tx = 50 + state.target.x * scale;
      const ty = groundY + state.target.y * scale;

      ctx.beginPath();
      ctx.arc(tx, ty, state.target.radius * scale + 10, 0, Math.PI * 2);
      ctx.fillStyle = darkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(tx, ty, state.target.radius * scale, 0, Math.PI * 2);
      ctx.fillStyle = darkMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(tx, ty, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = darkMode ? '#94a3b8' : '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`(${state.target.x.toFixed(1)}, ${Math.abs(state.target.y).toFixed(1)})`, tx + 15, ty + 4);
    }

    const cannonX = 30;
    ctx.save();
    ctx.translate(cannonX, groundY);
    ctx.rotate(-state.angle * Math.PI / 180);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(0, -4, 35, 8);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cannonX, groundY, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#4f46e5';
    ctx.fill();

    if (state.trajectory.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = darkMode ? '#8b5cf6' : '#7c3aed';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      ctx.moveTo(30 + state.trajectory[0].x * 5, groundY - state.trajectory[0].y * 5);
      for (const pt of state.trajectory) {
        ctx.lineTo(30 + pt.x * 5, groundY - pt.y * 5);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (state.projectile.active) {
      const proj = state.projectile;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (state.explosion.active) {
      const exp = state.explosion;
      const progress = exp.frame / 30;
      const radius = 10 + progress * 40;
      const alpha = 1 - progress;

      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
      ctx.fill();
    }

    if (state.wind !== 0) {
      ctx.fillStyle = darkMode ? '#60a5fa' : '#3b82f6';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`WIND: ${state.wind > 0 ? '+' : ''}${state.wind.toFixed(1)} m/s`, width - 140, 25);

      const arrowX = width - 120;
      const arrowLen = state.wind * 12;
      ctx.beginPath();
      ctx.moveTo(arrowX, 40);
      ctx.lineTo(arrowX + arrowLen, 40);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (Math.abs(arrowLen) > 5) {
        const dir = arrowLen > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(arrowX + arrowLen, 40);
        ctx.lineTo(arrowX + arrowLen - dir * 10, 35);
        ctx.lineTo(arrowX + arrowLen - dir * 10, 45);
        ctx.closePath();
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
      }
    }

    ctx.fillStyle = darkMode ? '#e2e8f0' : '#1e293b';
    ctx.font = '14px sans-serif';
    ctx.fillText(`LEVEL ${state.level}`, 15, 25);
    ctx.fillText(`SCORE: ${state.score}`, 15, 45);
    ctx.fillText(`SHOTS: ${state.shots}`, 15, 65);
    ctx.fillText(`V₀=${state.velocity} θ=${state.angle}°`, 15, 85);

    if (state.result) {
      ctx.font = 'bold 24px sans-serif';
      if (state.result.hit) {
        ctx.fillStyle = '#22c55e';
        ctx.fillText('DIRECT HIT!', width / 2 - 80, 100);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`MISSED by ${state.result.distance?.toFixed(1) || '?'}m`, width / 2 - 100, 100);
      }
    }
  }, [darkMode]);

  useGameLoop(calculateNextState, renderScene, true);

  const fire = () => {
    const state = stateRef.current;
    if (state.isAnimating) return;

    state.isAnimating = true;
    state.shots++;
    state.projectile = { x: 30, y: 0, active: true, t: 0 };
    state.trajectory = engineRef.current.generateTrajectory(state.velocity, state.angle, state.wind);
  };

  const setVelocity = (v) => { stateRef.current.velocity = v; };
  const setAngle = (a) => { stateRef.current.angle = a; };
  const setWind = (w) => { stateRef.current.wind = w; };

  const reset = () => {
    stateRef.current = {
      velocity: 50,
      angle: 45,
      wind: 0,
      level: 1,
      score: 0,
      shots: 0,
      isAnimating: false,
      result: null,
      trajectory: [],
      projectile: { x: 30, y: 0, active: false },
      explosion: { active: false, x: 0, y: 0, frame: 0 },
      target: engineRef.current?.generateTarget(1),
      gameStarted: true
    };
    stateRef.current.wind = engineRef.current?.generateWind(1) || 0;
    setLocalScore(0);
  };

  const state = stateRef.current;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className={`text-sm font-mono ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              {highScore}
            </span>
          </div>
          <Button onClick={reset} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      <Card padding="p-0" className="overflow-hidden">
        <canvas ref={canvasRef} width={800} height={500} className="w-full block" />
      </Card>

      <Card padding="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              <Zap className="w-4 h-4 inline mr-1" />
              Velocity (V₀): {state.velocity} m/s
            </label>
            <input
              type="range"
              min="20"
              max="100"
              value={state.velocity}
              onChange={(e) => setVelocity(Number(e.target.value))}
              className="w-full accent-blue-600"
              disabled={state.isAnimating}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              <Target className="w-4 h-4 inline mr-1" />
              Angle (θ): {state.angle}°
            </label>
            <input
              type="range"
              min="5"
              max="85"
              value={state.angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="w-full accent-blue-600"
              disabled={state.isAnimating}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
              <Wind className="w-4 h-4 inline mr-1" />
              Wind: {state.wind > 0 ? '+' : ''}{state.wind.toFixed(1)} m/s²
            </label>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={state.wind}
              onChange={(e) => setWind(Number(e.target.value))}
              className="w-full accent-blue-600"
              disabled={state.isAnimating}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={fire}
              disabled={state.isAnimating}
              className="w-full text-lg py-3"
            >
              {state.isAnimating ? (
                <><Pause className="w-5 h-5 mr-2" /> Firing...</>
              ) : (
                <><Play className="w-5 h-5 mr-2" /> FIRE!</>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default VectorGame;
