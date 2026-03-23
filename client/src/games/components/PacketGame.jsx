/* eslint-disable */
import React, { useRef, useState, useCallback, useContext, useEffect } from 'react';
import { ThemeContext } from '../../App';
import { Card, Button } from '../../components/UI';
import { ArrowLeft, Trophy, RotateCcw, RotateCw, Wifi, WifiOff, Shield, ShieldAlert } from 'lucide-react';
import { useGameLoop } from '../hooks/useGameLoop';
import PacketEngine, { PACKET_TYPES, Router } from '../engines/PacketEngine';

const STORAGE_KEY = 'afit_arcade_highscores_packet';

const loadHighScore = () => {
  try { return parseInt(localStorage.getItem(STORAGE_KEY)) || 0; } catch { return 0; }
};

const saveHighScore = (score) => {
  try { localStorage.setItem(STORAGE_KEY, score.toString()); } catch {}
};

const PacketGame = ({ onBack, highScore: propHighScore, updateHighScore }) => {
  const { darkMode } = useContext(ThemeContext);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState('playing');
  const [packets, setPackets] = useState([]);
  const [routers, setRouters] = useState([]);
  const [ports, setPorts] = useState([]);
  const [highScore, setHighScore] = useState(propHighScore || loadHighScore());
  const [spawnTimer, setSpawnTimer] = useState(0);

  useEffect(() => {
    initLevel();
  }, []);

  const initLevel = () => {
    engineRef.current = new PacketEngine();
    
    setRouters([
      { id: 'r1', x: 150, y: 150, rotation: 0 },
      { id: 'r2', x: 350, y: 250, rotation: 90 },
      { id: 'r3', x: 200, y: 350, rotation: 0 }
    ]);
    
    setPorts([
      { id: 'p1', x: 550, y: 100, type: 'Web', color: '#3b82f6', port: 80 },
      { id: 'p2', x: 550, y: 250, type: 'SSH', color: '#f59e0b', port: 22 },
      { id: 'p3', x: 550, y: 400, type: 'DNS', color: '#8b5cf6', port: 53 }
    ]);
    
    setPackets([]);
    setLives(3);
    setScore(0);
    setGameState('playing');
    setSpawnTimer(0);
  };

  const spawnPacket = useCallback(() => {
    const side = Math.random() < 0.5 ? 'left' : 'top';
    const packetTypes = ['HTTP', 'HTTPS', 'SSH', 'DNS'];
    const typeIndex = Math.floor(Math.random() * packetTypes.length);
    const type = PACKET_TYPES[packetTypes[typeIndex]];
    
    let startX, startY, dirX, dirY;
    if (side === 'left') {
      startX = -30;
      startY = 100 + Math.random() * 300;
      dirX = 1;
      dirY = 0;
    } else {
      startX = 100 + Math.random() * 400;
      startY = -30;
      dirX = 0;
      dirY = 1;
    }

    const packet = {
      id: `pkt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      x: startX,
      y: startY,
      type,
      color: type.color,
      port: type.port,
      direction: { dx: dirX, dy: dirY },
      lifetime: 0
    };

    setPackets(prev => [...prev, packet]);
  }, []);

  const calculateNextState = useCallback((dt) => {
    if (gameState !== 'playing') return;

    setSpawnTimer(t => t + dt);
    if (spawnTimer > 3 - level * 0.2) {
      spawnPacket();
      setSpawnTimer(0);
    }

    setPackets(prev => {
      const updated = [];
      let dropped = 0;

      for (const pkt of prev) {
        let newX = pkt.x + pkt.direction.dx * 100 * dt;
        let newY = pkt.y + pkt.direction.dy * 100 * dt;
        let newDir = { ...pkt.direction };

        for (const router of routers) {
          const dx = newX - router.x;
          const dy = newY - router.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 25) {
            if (router.id === 'r1') {
              newDir = pkt.port === 80 || pkt.port === 443 ? { dx: 0, dy: -1 } : { dx: 0, dy: 1 };
            } else if (router.id === 'r2') {
              newDir = pkt.port === 22 ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
            } else if (router.id === 'r3') {
              newDir = pkt.port === 53 ? { dx: 1, dy: 0 } : { dx: 1, dy: 0 };
            }
          }
        }

        let delivered = false;
        for (const port of ports) {
          const dx = newX - port.x;
          const dy = newY - port.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 30) {
            if (port.port === pkt.port) {
              setScore(s => s + 10);
              delivered = true;
            } else {
              dropped++;
              setLives(l => l - 1);
            }
          }
        }

        if (!delivered && (newX < -50 || newX > 650 || newY < -50 || newY > 450)) {
          dropped++;
        }

        if (!delivered && newX >= -50 && newX <= 650 && newY >= -50 && newY <= 450) {
          updated.push({ ...pkt, x: newX, y: newY, direction: newDir, lifetime: pkt.lifetime + dt });
        }
      }

      if (dropped > 0 && lives - dropped <= 0) {
        setGameState('gameover');
      }

      return updated;
    });
  }, [gameState, routers, ports, spawnTimer, spawnPacket, level, lives]);

  const renderScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.fillStyle = darkMode ? '#0f172a' : '#f1f5f9';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = darkMode ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    for (const port of ports) {
      ctx.fillStyle = port.color;
      ctx.fillRect(port.x - 25, port.y - 25, 50, 50);
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(port.x - 25, port.y - 25, 50, 50);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(port.type, port.x, port.y);
      ctx.font = '10px sans-serif';
      ctx.fillText(`:${port.port}`, port.x, port.y + 15);
    }

    for (const router of routers) {
      ctx.save();
      ctx.translate(router.x, router.y);
      ctx.rotate(router.rotation * Math.PI / 180);

      ctx.fillStyle = '#6366f1';
      ctx.fillRect(-20, -20, 40, 40);

      ctx.strokeStyle = '#a5b4fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, -30);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, -30, 5, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 2);
        ctx.fillStyle = i === 0 ? '#22c55e' : '#6b7280';
        ctx.beginPath();
        ctx.arc(25, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    for (const pkt of packets) {
      ctx.beginPath();
      ctx.arc(pkt.x, pkt.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = pkt.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pkt.port, pkt.x, pkt.y);
    }

    ctx.fillStyle = darkMode ? '#e2e8f0' : '#1e293b';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${level}`, 20, 30);
    ctx.fillText(`SCORE: ${score}`, 20, 50);
    ctx.fillText(`HIGH: ${highScore}`, 20, 70);
    ctx.fillText(`LIVES: ${'❤️'.repeat(lives)}`, 20, 90);

    if (gameState === 'gameover') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.fillRect(width / 2 - 120, height / 2 - 40, 240, 80);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER!', width / 2, height / 2 + 8);
    }
  }, [darkMode, level, score, highScore, lives, packets, routers, ports, gameState]);

  useGameLoop(calculateNextState, renderScene, gameState === 'playing');

  const rotateRouter = (routerId) => {
    setRouters(prev => prev.map(r => {
      if (r.id === routerId) {
        return { ...r, rotation: (r.rotation + 90) % 360 };
      }
      return r;
    }));
  };

  const restart = () => {
    initLevel();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${darkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className={`text-sm font-mono ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>{highScore}</span>
          </div>
          <Button onClick={restart} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" /> Restart
          </Button>
        </div>
      </div>

      <Card padding="p-0" className="overflow-hidden">
        <canvas ref={canvasRef} width={600} height={450} className="w-full block" />
      </Card>

      <Card padding="p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            {routers.map(router => (
              <Button
                key={router.id}
                onClick={() => rotateRouter(router.id)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                Rotate {router.id}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-blue-500" />
              <span className={darkMode ? 'text-slate-300' : 'text-gray-700'}>Router A: Port 80</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-yellow-500" />
              <span className={darkMode ? 'text-slate-300' : 'text-gray-700'}>Router B: Port 22</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-purple-500" />
              <span className={darkMode ? 'text-slate-300' : 'text-gray-700'}>Router C: Port 53</span>
            </div>
          </div>
        </div>

        <div className={`mt-4 p-3 rounded-lg ${darkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
          <h4 className={`font-medium mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Mission:</h4>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
            Click routers to rotate them. Route packets to their correct ports.
            HTTP/HTTPS → Port 80/443, SSH → Port 22, DNS → Port 53.
            Wrong routing costs lives!
          </p>
        </div>
      </Card>
    </div>
  );
};

export default PacketGame;
