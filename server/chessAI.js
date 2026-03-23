const { Chess } = require('chess.js');

const PIECE_VALUES = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
  P: -100, N: -320, B: -330, R: -500, Q: -900, K: -20000
};

const CENTER_SQUARES = new Set(['d4', 'd5', 'e4', 'e5']);

const POSITION_BONUS = {
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0]
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50]
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20]
  ],
  r: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0]
  ],
  q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20]
  ],
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20]
  ]
};

let historyTable = {};
let killerMoves = [];

const clearTables = () => {
  historyTable = {};
  killerMoves = [];
};

const evaluateBoard = (chess, alpha, beta) => {
  const board = chess.board();
  let score = 0;
  const turn = chess.turn();
  
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece) {
        const pieceType = piece.type;
        const pieceColor = piece.color;
        const posBonus = POSITION_BONUS[pieceType]?.[i]?.[j] || 0;
        
        score += PIECE_VALUES[pieceType];
        
        if (pieceColor === 'w') {
          score += posBonus;
          if (CENTER_SQUARES.has(String.fromCharCode(97 + j) + (8 - i))) {
            score += 30;
          }
        } else {
          score -= posBonus;
          if (CENTER_SQUARES.has(String.fromCharCode(97 + j) + (8 - i))) {
            score -= 30;
          }
        }
      }
    }
  }
  
  if (chess.isCheck()) {
    if (turn === 'w') {
      score -= 50;
    } else {
      score += 50;
    }
  }
  
  if (chess.isCheckmate()) {
    if (turn === 'w') {
      return -100000;
    } else {
      return 100000;
    }
  }
  
  return score;
};

const quiescence = (chess, alpha, beta, depth) => {
  const standPat = evaluateBoard(chess, alpha, beta);
  
  if (chess.isGameOver()) return evaluateBoard(chess, alpha, beta);
  if (depth <= 0) return standPat;
  
  if (chess.turn() === 'w') {
    if (standPat >= beta) return beta;
    alpha = Math.max(alpha, standPat);
  } else {
    if (standPat <= alpha) return alpha;
    beta = Math.min(beta, standPat);
  }

  const moves = chess.moves({ verbose: true }).filter(m => m.captured);
  
  if (moves.length === 0) return standPat;

  for (const move of moves.sort((a, b) => {
    const aValue = PIECE_VALUES[a.captured] || 0;
    const bValue = PIECE_VALUES[b.captured] || 0;
    return bValue - aValue;
  })) {
    chess.move(move);
    const score = quiescence(chess, alpha, beta, depth - 1);
    chess.undo();
    
    if (chess.turn() === 'w') {
      alpha = Math.max(alpha, score);
    } else {
      beta = Math.min(beta, score);
    }
    
    if (beta <= alpha) break;
  }

  return chess.turn() === 'w' ? alpha : beta;
};

const scoreMove = (move, depth, alpha, beta, isMaximizing) => {
  if (move.captured) {
    return 10000 + PIECE_VALUES[move.captured] * 10;
  }
  
  const moveKey = `${move.from}-${move.to}`;
  if (historyTable[moveKey]) {
    return historyTable[moveKey];
  }
  
  for (let k = 0; k < killerMoves.length; k++) {
    if (killerMoves[k] && killerMoves[k][0] === move.from && killerMoves[k][1] === move.to) {
      return 9000 - k * 100;
    }
  }
  
  if (CENTER_SQUARES.has(move.to)) {
    return 100;
  }
  
  return 0;
};

const minimax = (chess, depth, alpha, beta, maximizing, currentDepth = 0) => {
  if (depth === 0 || chess.isGameOver()) {
    return { score: quiescence(chess, alpha, beta, 6), move: null };
  }

  const moves = chess.moves({ verbose: true });
  
  if (moves.length === 0) {
    return { score: evaluateBoard(chess, alpha, beta), move: null };
  }
  
  moves.sort((a, b) => {
    if (maximizing) {
      return scoreMove(b, depth, alpha, beta, true) - scoreMove(a, depth, alpha, beta, true);
    } else {
      return scoreMove(a, depth, alpha, beta, false) - scoreMove(b, depth, alpha, beta, false);
    }
  });

  let bestMove = moves[0];

  if (maximizing) {
    let maxScore = -Infinity;
    
    for (const move of moves) {
      chess.move(move);
      const { score } = minimax(chess, depth - 1, alpha, beta, false, currentDepth + 1);
      chess.undo();
      
      if (score > maxScore) {
        maxScore = score;
        bestMove = move;
      }
      
      alpha = Math.max(alpha, score);
      if (beta <= alpha) {
        if (!move.captured) {
          if (currentDepth < killerMoves.length) {
            killerMoves[currentDepth] = [move.from, move.to];
          } else {
            killerMoves.push([move.from, move.to]);
          }
        }
        const moveKey = `${move.from}-${move.to}`;
        historyTable[moveKey] = (historyTable[moveKey] || 0) + depth;
        break;
      }
    }
    
    return { score: maxScore, move: bestMove };
  } else {
    let minScore = Infinity;
    
    for (const move of moves) {
      chess.move(move);
      const { score } = minimax(chess, depth - 1, alpha, beta, true, currentDepth + 1);
      chess.undo();
      
      if (score < minScore) {
        minScore = score;
        bestMove = move;
      }
      
      beta = Math.min(beta, score);
      if (beta <= alpha) {
        if (!move.captured) {
          if (currentDepth < killerMoves.length) {
            killerMoves[currentDepth] = [move.from, move.to];
          } else {
            killerMoves.push([move.from, move.to]);
          }
        }
        const moveKey = `${move.from}-${move.to}`;
        historyTable[moveKey] = (historyTable[moveKey] || 0) + depth;
        break;
      }
    }
    
    return { score: minScore, move: bestMove };
  }
};

const getBestMove = (fen, skillLevel = 3) => {
  const baseDepth = Math.min(4, Math.max(1, skillLevel));
  
  try {
    const chess = new Chess(fen);
    
    if (chess.isGameOver()) {
      return null;
    }

    const startTime = Date.now();
    const maxTime = Math.min(500, 1000 / (skillLevel || 1));
    
    clearTables();
    
    const result = minimax(chess, baseDepth, -Infinity, Infinity, chess.turn() === 'w');
    const elapsed = Date.now() - startTime;
    
    console.log(`🤖 GM AI depth ${baseDepth} | Score: ${result.score} | Time: ${elapsed}ms | Move: ${result.move?.from}->${result.move?.to}`);
    
    if (elapsed > maxTime && baseDepth > 1) {
      console.log(`🤖 Time exceeded, using shallower search next time`);
    }
    
    return result.move;
  } catch (error) {
    console.error('AI error:', error.message);
    const chess = new Chess(fen);
    const moves = chess.moves();
    if (moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      console.log('🤖 Falling back to random move:', randomMove);
      return { from: randomMove.slice(0, 2), to: randomMove.slice(2, 4) };
    }
    return null;
  }
};

module.exports = { getBestMove, evaluateBoard };
