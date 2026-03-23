/* eslint-disable */
import React, { useRef, useState, useCallback, useContext, useEffect } from 'react';
import { ThemeContext } from '../../App';
import { Card, Button } from '../../components/UI';
import { ArrowLeft, Trophy, RotateCcw, Play, Square, AlertTriangle, Settings } from 'lucide-react';
import { useGameLoop } from '../hooks/useGameLoop';
import StructuralEngine from '../engines/StructuralEngine';

const STORAGE_KEY = 'afit_arcade_highscores_structural';

const loadHighScore = () => {
  try { return parseInt(localStorage.getItem(STORAGE_KEY)) || 0; } catch { return 0; }
};

const saveHighScore = (score) => {
  try { localStorage.setItem(STORAGE_KEY, score.toString()); } catch {}
};

const StructuralGame = ({ onBack, highScore: propHighScore, updateHighScore }) => {
  const { darkMode } = useContext(ThemeContext);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [budget, setBudget] = useState(500);
  const [gameState, setGameState] = useState('building');
  const [selectedTool, setSelectedTool] = useState('node');
  const [nodes, setNodes] = useState([]);
  const [beams, setBeams] = useState([]);
  const [truckX, setTruckX] = useState(30);
  const [highScore, setHighScore] = useState(propHighScore || loadHighScore());
  const [brokenBeams, setBrokenBeams] = useState([]);
  const [showStress, setShowStress] = useState(true);

  useEffect(() => {
    engineRef.current = new StructuralEngine({ materialStrength: 100, truckWeight: 50 });
    initLevel();
  }, []);

  const initLevel = () => {
    const puzzle = StructuralEngine.generatePuzzle(level);
    setBudget(puzzle.budget);
    setNodes([
      { id: 'n0', x: 80, y: 350, type: 'pin' },
      { id: 'n1', x: 250, y: 350, type: 'roller' }
    ]);
    setBeams([]);
    setBrokenBeams([]);
    setGameState('building');
    setTruckX(30);
  };

  const calculateNextState = useCallback((dt) => {
    if (gameState !== 'testing') return;

    const newTruckX = truckX + 80 * dt;
    setTruckX(newTruckX);

    if (engineRef.current && beams.length > 0) {
      engineRef.current.nodes = nodes.map(n => ({ ...n }));
      engineRef.current.beams = beams.map(b => ({ ...b, broken: brokenBeams.includes(b.id) }));
      
      const activeNode = nodes.find(n => Math.abs(n.x - newTruckX) < 30);
      if (activeNode) {
        engineRef.current.addLoad(activeNode.id, 0, -50);
      }

      const result = engineRef.current.analyze();
      
      if (result.success) {
        setBeams(prev => prev.map(b => {
          const resultBeam = result.beams.find(rb => rb.id === b.id);
          return resultBeam ? { ...b, color: resultBeam.color, stress: resultBeam.stress, broken: resultBeam.broken } : b;
        }));

        const newlyBroken = result.beams.filter(b => b.broken).map(b => b.id);
        if (newlyBroken.length > 0) {
          setBrokenBeams(prev => [...prev, ...newlyBroken]);
          setGameState('failed');
        }
      }

      if (newTruckX > 500 && brokenBeams.length === 0) {
        setGameState('success');
        const levelScore = budget + 100;
        const newScore = score + levelScore;
        setScore(newScore);
        
        const newHigh = Math.max(highScore, newScore);
        setHighScore(newHigh);
        saveHighScore(newHigh);
        if (updateHighScore) updateHighScore(newHigh);
      }
    }
  }, [gameState, truckX, nodes, beams, brokenBeams, budget, score, highScore, level]);

  const renderScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.fillStyle = darkMode ? '#0f172a' : '#f1f5f9';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1e40af';
    ctx.fillRect(0, 380, width, 20);

    ctx.fillStyle = darkMode ? '#1e3a5f' : '#bfdbfe';
    for (let i = 0; i < width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 380);
      ctx.lineTo(i + 15, 400);
      ctx.lineTo(i - 15, 400);
      ctx.closePath();
      ctx.fill();
    }

    for (const node of nodes) {
      if (node.type === 'pin') {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(node.x - 12, node.y - 12, 24, 24);
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.strokeRect(node.x - 12, node.y - 12, 24, 24);
      } else if (node.type === 'roller') {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(node.x - 18, node.y + 8, 36, 12);
      } else {
        ctx.fillStyle = '#6b7280';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    for (const beam of beams) {
      const nodeA = nodes.find(n => n.id === beam.nodeA);
      const nodeB = nodes.find(n => n.id === beam.nodeB);
      if (!nodeA || !nodeB) continue;

      const isBroken = brokenBeams.includes(beam.id);
      const color = isBroken ? '#374151' : (beam.color || '#6b7280');

      ctx.beginPath();
      ctx.moveTo(nodeA.x, nodeA.y);
      ctx.lineTo(nodeB.x, nodeB.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = isBroken ? 2 : 6;
      ctx.stroke();

      if (showStress && beam.stress && !isBroken) {
        ctx.strokeStyle = beam.stress > 0 ? '#3b82f6' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (gameState === 'testing' || gameState === 'success' || gameState === 'failed') {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(truckX - 20, 345, 40, 25);
      
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(truckX - 10, 370, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(truckX + 10, 370, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOAD', truckX, 360);
    }

    ctx.fillStyle = darkMode ? '#e2e8f0' : '#1e293b';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${level}`, 20, 30);
    ctx.fillText(`SCORE: ${score}`, 20, 50);
    ctx.fillText(`HIGH: ${highScore}`, 20, 70);
    ctx.fillText(`BUDGET: ${budget}`, 20, 90);

    if (gameState === 'failed') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.fillRect(width / 2 - 100, height / 2 - 30, 200, 60);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BRIDGE COLLAPSED!', width / 2, height / 2 + 8);
    }

    if (gameState === 'success') {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.fillRect(width / 2 - 100, height / 2 - 30, 200, 60);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BRIDGE SUCCESS!', width / 2, height / 2 + 8);
    }
  }, [darkMode, level, score, highScore, budget, nodes, beams, brokenBeams, gameState, truckX, showStress]);

  useGameLoop(calculateNextState, renderScene, true);

  const addNode = (e) => {
    if (gameState !== 'building') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y > 370) return;

    const cost = 50;
    if (budget < cost) return;

    const newNode = { id: `n${nodes.length}`, x, y, type: 'joint' };
    setNodes(prev => [...prev, newNode]);
    setBudget(b => b - cost);
  };

  const addBeam = (nodeA, nodeB) => {
    const cost = 100;
    if (budget < cost) return;
    if (beams.some(b => (b.nodeA === nodeA && b.nodeB === nodeB) || (b.nodeA === nodeB && b.nodeB === nodeA))) return;

    const newBeam = { id: `b${beams.length}`, nodeA, nodeB, color: '#6b7280' };
    setBeams(prev => [...prev, newBeam]);
    setBudget(b => b - cost);
  };

  const startTest = () => {
    if (beams.length === 0) return;
    setGameState('testing');
  };

  const nextLevel = () => {
    const next = level + 1;
    setLevel(next);
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
          <Button onClick={initLevel} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      <Card padding="p-0" className="overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="w-full block cursor-crosshair"
          onClick={addNode}
        />
      </Card>

      <Card padding="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <Button onClick={startTest} disabled={gameState !== 'building' || beams.length === 0} className="bg-green-600 hover:bg-green-700">
              <Play className="w-4 h-4 mr-1" /> Test Bridge
            </Button>
            {gameState === 'building' && beams.length > 0 && (
              <Button onClick={() => {
                const lastNode = nodes[nodes.length - 1];
                const firstNode = nodes[0];
                addBeam(lastNode.id, firstNode.id);
              }} disabled={budget < 100 || nodes.length < 2}>
                <Settings className="w-4 h-4 mr-1" /> Connect Last
              </Button>
            )}
            {nodes.length >= 2 && (
              <Button onClick={() => {
                const n = nodes.length;
                addBeam(nodes[n-1].id, nodes[n-2].id);
              }} disabled={budget < 100 || nodes.length < 2}>
                Connect Prev
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showStress} onChange={(e) => setShowStress(e.target.checked)} />
              <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Show Stress</span>
            </label>
            {gameState === 'success' && (
              <Button onClick={nextLevel} className="bg-blue-600">Next Level</Button>
            )}
          </div>
        </div>

        <div className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
          <p>Click on canvas to place nodes. Connect nodes to build beams.</p>
          <p>Node cost: 50 AFIT | Beam cost: 100 AFIT</p>
          <p className="mt-2">
            <span className="text-blue-500">Blue = Tension</span> | <span className="text-red-500">Red = Compression</span>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default StructuralGame;
