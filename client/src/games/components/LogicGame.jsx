/* eslint-disable */
import React, { useRef, useState, useCallback, useContext, useEffect } from 'react';
import { ThemeContext } from '../../App';
import { Card, Button } from '../../components/UI';
import { ArrowLeft, Trophy, RotateCcw, Zap, CheckCircle, XCircle } from 'lucide-react';
import LogicEngine from '../engines/LogicEngine';

const STORAGE_KEY = 'afit_arcade_highscores_logic';

const loadHighScore = () => {
  try { return parseInt(localStorage.getItem(STORAGE_KEY)) || 0; } catch { return 0; }
};

const saveHighScore = (score) => {
  try { localStorage.setItem(STORAGE_KEY, score.toString()); } catch {}
};

const GATE_COLORS = {
  AND: '#3b82f6',
  OR: '#10b981', 
  NOT: '#f59e0b',
  XOR: '#8b5cf6',
  NAND: '#ec4899',
  NOR: '#ef4444'
};

const LogicGame = ({ onBack, highScore: propHighScore, updateHighScore }) => {
  const { darkMode } = useContext(ThemeContext);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const animationRef = useRef(null);
  
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [puzzle, setPuzzle] = useState(null);
  const [inputA, setInputA] = useState(false);
  const [inputB, setInputB] = useState(false);
  const [circuit, setCircuit] = useState([]);
  const [output, setOutput] = useState(null);
  const [solved, setSolved] = useState(false);
  const [highScore, setHighScore] = useState(propHighScore || loadHighScore());
  const [powerAnim, setPowerAnim] = useState([]);

  useEffect(() => {
    engineRef.current = new LogicEngine();
    loadPuzzle(1);
  }, []);

  const loadPuzzle = (lvl) => {
    const newPuzzle = LogicEngine.generatePuzzle(lvl);
    setPuzzle(newPuzzle);
    setCircuit([]);
    setOutput(null);
    setSolved(false);
    setInputA(false);
    setInputB(false);
  };

  const evaluateGate = (gateType, a, b) => {
    switch (gateType) {
      case 'AND': return a && b;
      case 'OR': return a || b;
      case 'NOT': return !a;
      case 'XOR': return a !== b;
      case 'NAND': return !(a && b);
      case 'NOR': return !(a || b);
      default: return false;
    }
  };

  const evaluateCircuit = useCallback(() => {
    if (circuit.length === 0) return null;
    
    let result = inputA;
    const animPath = [{ gate: 'INPUT_A', value: inputA, delay: 0 }];
    let delay = 1;

    for (const gate of circuit) {
      const prevResult = result;
      
      if (gate === 'NOT') {
        result = evaluateGate(gate, result, false);
      } else {
        const input = inputB !== undefined ? inputB : result;
        result = evaluateGate(gate, result, input);
      }
      
      animPath.push({ gate, value: result, delay: delay++ });
    }
    
    setPowerAnim(animPath);
    return result;
  }, [circuit, inputA, inputB]);

  useEffect(() => {
    const result = evaluateCircuit();
    setOutput(result);
  }, [circuit, inputA, inputB, evaluateCircuit]);

  const checkSolution = () => {
    if (!puzzle) return false;
    
    for (const row of puzzle.targetTruthTable) {
      let result = row.inputs[0];
      for (const gate of circuit) {
        const input = row.inputs[1] !== undefined ? row.inputs[1] : row.inputs[0];
        if (gate === 'NOT') {
          result = !result;
        } else {
          result = evaluateGate(gate, result, input);
        }
      }
      if (result !== row.output) return false;
    }
    return true;
  };

  const placeGate = (gateType) => {
    if (solved) return;
    const newCircuit = [...circuit, gateType];
    setCircuit(newCircuit);
    
    setTimeout(() => {
      if (newCircuit.length === puzzle.targetTruthTable.length && checkSolution()) {
        handleSolved();
      }
    }, 100);
  };

  const handleSolved = () => {
    setSolved(true);
    const bonus = Math.max(100 - circuit.length * 10, 20);
    const levelScore = 50 + bonus;
    const newScore = score + levelScore;
    setScore(newScore);
    
    const newHigh = Math.max(highScore, newScore);
    setHighScore(newHigh);
    saveHighScore(newHigh);
    if (updateHighScore) updateHighScore(newHigh);

    setTimeout(() => {
      const nextLevel = level + 1;
      setLevel(nextLevel);
      loadPuzzle(nextLevel);
    }, 2500);
  };

  const verifySolution = () => {
    if (checkSolution()) {
      handleSolved();
    }
  };

  const clearCircuit = () => {
    setCircuit([]);
    setOutput(null);
    setPowerAnim([]);
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.fillStyle = darkMode ? '#0f172a' : '#f1f5f9';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = darkMode ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    const centerY = height / 2;
    const startX = 80;
    const gateSpacing = 100;

    ctx.fillStyle = darkMode ? '#e2e8f0' : '#1e293b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`LEVEL ${level}`, 20, 30);
    ctx.fillText(`SCORE: ${score}`, 20, 50);
    ctx.fillText(`HIGH: ${highScore}`, 20, 70);

    const inputBoxY = centerY - 40;
    ctx.fillStyle = inputA ? '#22c55e' : (darkMode ? '#334155' : '#cbd5e1');
    ctx.fillRect(startX - 30, inputBoxY, 60, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(inputA ? '1' : '0', startX, inputBoxY + 26);
    
    if (inputB !== undefined) {
      const inputB_y = centerY + 40;
      ctx.fillStyle = inputB ? '#22c55e' : (darkMode ? '#334155' : '#cbd5e1');
      ctx.fillRect(startX - 30, inputB_y, 60, 40);
      ctx.fillStyle = '#fff';
      ctx.fillText(inputB ? '1' : '0', startX, inputB_y + 26);
    }

    for (let i = 0; i < circuit.length; i++) {
      const gate = circuit[i];
      const x = startX + 100 + i * gateSpacing;
      const y = centerY;
      const color = GATE_COLORS[gate] || '#6b7280';

      const isPowered = powerAnim[i + 1]?.value;
      
      ctx.shadowColor = isPowered ? '#22c55e' : 'transparent';
      ctx.shadowBlur = isPowered ? 15 : 0;
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x - 30, y - 25, 60, 50, 8);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isPowered ? '#22c55e' : (darkMode ? '#475569' : '#94a3b8');
      ctx.lineWidth = isPowered ? 3 : 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gate, x, y + 5);

      if (i > 0) {
        const prevX = startX + 100 + (i - 1) * gateSpacing;
        const prevPowered = powerAnim[i]?.value;
        
        ctx.beginPath();
        ctx.moveTo(prevX + 30, centerY);
        ctx.lineTo(x - 30, centerY);
        ctx.strokeStyle = prevPowered ? '#22c55e' : (darkMode ? '#475569' : '#94a3b8');
        ctx.lineWidth = prevPowered ? 4 : 2;
        ctx.setLineDash(prevPowered ? [] : [5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (i === circuit.length - 1 && isPowered !== undefined) {
        ctx.beginPath();
        ctx.moveTo(x + 30, centerY);
        ctx.lineTo(x + 80, centerY);
        ctx.strokeStyle = isPowered ? '#22c55e' : '#ef4444';
        ctx.lineWidth = isPowered ? 4 : 2;
        ctx.stroke();
      }
    }

    const outputX = startX + 100 + circuit.length * gateSpacing + 80;
    ctx.fillStyle = output ? '#22c55e' : (darkMode ? '#334155' : '#cbd5e1');
    ctx.beginPath();
    ctx.arc(outputX, centerY, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = output ? '#16a34a' : (darkMode ? '#475569' : '#94a3b8');
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(output !== null ? (output ? '1' : '0') : '?', outputX, centerY + 6);

    ctx.fillStyle = darkMode ? '#94a3b8' : '#64748b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('INPUT A', startX - 30, inputBoxY - 10);
    if (inputB !== undefined) {
      ctx.fillText('INPUT B', startX - 30, inputBoxY + 100);
    }
    ctx.fillText('OUTPUT', outputX - 25, centerY - 40);

    if (solved) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.fillRect(width / 2 - 100, height / 2 - 40, 200, 80);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SOLVED!', width / 2, height / 2 + 8);
    }
  }, [darkMode, level, score, highScore, circuit, output, inputA, inputB, powerAnim, solved]);

  useEffect(() => {
    let animId;
    const animate = () => {
      render();
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [render]);

  if (!puzzle) return <div className="text-center p-8">Loading puzzle...</div>;

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
          <Button onClick={() => loadPuzzle(level)} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </Button>
        </div>
      </div>

      <Card padding="p-0" className="overflow-hidden">
        <canvas ref={canvasRef} width={800} height={350} className="w-full block" />
      </Card>

      <Card padding="p-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Level {level}: {puzzle.name}
            </h3>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>{puzzle.description}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setInputA(!inputA)} className={`px-4 py-2 rounded-lg font-bold text-white transition-all ${inputA ? 'bg-green-500' : 'bg-slate-600'}`}>
              Input A: {inputA ? '1' : '0'}
            </button>
            {puzzle.targetTruthTable.length > 1 && (
              <button onClick={() => setInputB(!inputB)} className={`px-4 py-2 rounded-lg font-bold text-white transition-all ${inputB ? 'bg-green-500' : 'bg-slate-600'}`}>
                Input B: {inputB ? '1' : '0'}
              </button>
            )}
            <Button onClick={verifySolution} disabled={circuit.length === 0} className="ml-4">
              <CheckCircle className="w-4 h-4 mr-1" /> Verify
            </Button>
            <Button onClick={clearCircuit} variant="outline">
              <XCircle className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>
        </div>

        <div>
          <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Available Gates:
          </p>
          <div className="flex flex-wrap gap-2">
            {puzzle.availableGates.map(gate => (
              <button
                key={gate}
                onClick={() => placeGate(gate)}
                disabled={solved}
                className="px-4 py-2 rounded-lg font-bold text-white transition-transform hover:scale-105 disabled:opacity-50"
                style={{ backgroundColor: GATE_COLORS[gate] }}
              >
                {gate}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
            Target Truth Table:
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className={darkMode ? 'bg-slate-700' : 'bg-gray-100'}>
                {puzzle.targetTruthTable[0]?.inputs.map((_, i) => (
                  <th key={i} className="px-3 py-2 text-left">{String.fromCharCode(65 + i)}</th>
                ))}
                <th className="px-3 py-2 text-left">Output</th>
              </tr>
            </thead>
            <tbody>
              {puzzle.targetTruthTable.map((row, i) => (
                <tr key={i} className={`border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                  {row.inputs.map((v, j) => (
                    <td key={j} className="px-3 py-2 font-mono">{v ? '1' : '0'}</td>
                  ))}
                  <td className="px-3 py-2 font-mono font-bold">{row.output ? '1' : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default LogicGame;
