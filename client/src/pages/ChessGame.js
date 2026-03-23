/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusSquare,
  Key,
  LogIn,
  XCircle,
  Trophy,
  Crown,
  RotateCcw,
  LogOut,
  User,
  Cpu,
  ChevronLeft,
  Check,
  Loader2,
  X,
  Monitor,
  PlayCircle,
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  Swords
} from 'lucide-react';
import { socket, connectSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const STORAGE_KEY = 'afit_chess_room';

const ChessGame = () => {
  const { user } = useAuth();
  const { darkMode } = React.useContext(ThemeContext);
  const navigate = useNavigate();
  
  // ============================================
  // STATE
  // ============================================
  const [roomId, setRoomId] = useState(null);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(INITIAL_FEN);
  const [gameId, setGameId] = useState(null);
  const [gameStatus, setGameStatus] = useState('idle');
  const [players, setPlayers] = useState({ white: null, black: null });
  const [winner, setWinner] = useState(null);
  const [myColor, setMyColor] = useState('white');
  const [orientation, setOrientation] = useState('white');
  const [lastMove, setLastMove] = useState(null);
  const [playVsCPU, setPlayVsCPU] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [resultReason, setResultReason] = useState(null);
  
  // Tap-to-move state
  const [moveFrom, setMoveFrom] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [showMoveSuccess, setShowMoveSuccess] = useState(false);
  const [showNotYourTurn, setShowNotYourTurn] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  
  const [joinCode, setJoinCode] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [error, setError] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const gameRef = useRef(new Chess());
  const copiedTimeoutRef = useRef(null);
  const hasCheckedStorage = useRef(false);
  const roomIdRef = useRef(roomId);
  
  roomIdRef.current = roomId;

  // ============================================
  // LOCALSTORAGE HELPERS
  // ============================================
  const clearRoomFromStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getStoredRoom = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // ============================================
  // TOP-LEVEL SOCKET LISTENERS (FIXED)
  // ============================================
  const gameIdRef = useRef(gameId);
  const userRef = useRef(user);
  const gameStatusRef = useRef(gameStatus);
  const playVsCPURef = useRef(playVsCPU);
  const myColorRef = useRef(myColor);
  const fenRef = useRef(fen);
  
  gameIdRef.current = gameId;
  userRef.current = user;
  gameStatusRef.current = gameStatus;
  playVsCPURef.current = playVsCPU;
  myColorRef.current = myColor;
  fenRef.current = fen;

  useEffect(() => {
    fenRef.current = fen;
  }, [fen]);

  useEffect(() => {
    console.log('🔌 Setting up socket listeners');
    
    connectSocket();
    
    socket.on('roomCreated', ({ roomId }) => {
      console.log('✅ Room Created:', roomId);
      setIsLoading(false);
      setRoomId(roomId);
      setGameStatus('waiting');
      setIsHost(true);
      setError(null);
      const stored = { roomId, playerColor: 'white', timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    });

    socket.on('playerAssignment', (data) => {
      console.log('🎨 Player assigned:', data.color);
      const color = data.color;
      setMyColor(color);
      setOrientation(color);
      
      // Save to storage
      const stored = { roomId: roomIdRef.current, playerColor: color, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    });

    socket.on('gameStarted', (data) => {
      console.log('✅ Game Started:', data);
      setIsLoading(false);
      setRoomId(data.roomId);
      setGameId(data.gameId);
      setPlayers({ white: data.whitePlayer, black: data.blackPlayer });
      setGameStatus('active');
      setWinner(null);
      setMoveFrom(null); // Reset tap selection
      
      const chess = new Chess(data.fen || INITIAL_FEN);
      gameRef.current = chess;
      setGame(chess);
      setFen(data.fen || INITIAL_FEN);
      
      const currentUser = userRef.current;
      const isWhite = String(data.whitePlayer?._id) === String(currentUser?._id);
      const color = isWhite ? 'white' : 'black';
      setMyColor(color);
      setOrientation(color);
      setIsHost(isWhite);
      
      socket.emit('joinGameRoom', { gameId: data.gameId });
      
      const stored = { roomId: data.roomId, playerColor: color, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    });

    socket.on('roomRestored', (data) => {
      console.log('🔄 Room Restored:', data);
      setIsReconnecting(false);
      setMoveFrom(null); // Reset tap selection

      if (!data.success) {
        localStorage.removeItem(STORAGE_KEY);
        setError(data.message || 'Room no longer exists');
        return;
      }

      setRoomId(data.roomId);

      if (data.status === 'waiting') {
        setGameStatus('waiting');
        setIsHost(data.isHost);
      } else if (data.status === 'active') {
        setGameId(data.gameId);
        setPlayers({ white: data.whitePlayer, black: data.blackPlayer });
        setGameStatus('active');
        
        const chess = new Chess(data.fen || INITIAL_FEN);
        gameRef.current = chess;
        setGame(chess);
        setFen(data.fen || INITIAL_FEN);
        
        // Get color from storage or determine from server data
        const stored = getStoredRoom();
        const storedColor = stored?.playerColor;
        
        const currentUser = userRef.current;
        const isWhite = String(data.whitePlayer?._id) === String(currentUser?._id);
        const color = storedColor || (isWhite ? 'white' : 'black');
        
        setMyColor(color);
        setOrientation(color);
        setIsHost(isWhite);
        
        socket.emit('joinGameRoom', { gameId: data.gameId });
      }
    });

    socket.on('moveMade', (data) => {
      console.log('♟️ Move confirmed:', data.from, '->', data.to, 'gameId:', data.gameId);
      if (data.gameId !== gameIdRef.current) {
        console.log('♟️ Move ignored - gameId mismatch');
        return;
      }
      
      console.log('   Server FEN:', data.fen);
      console.log('   Server turn:', data.currentTurn);
      console.log('   Current FEN before update:', fenRef.current);
      
      // Validate server FEN before accepting
      try {
        const chess = new Chess(data.fen);
        
        // Update board with server-confirmed FEN
        gameRef.current = chess;
        fenRef.current = data.fen; // Sync ref immediately
        setGame(chess);
        setFen(data.fen);
        setLastMove({ from: data.from, to: data.to });
        setMoveFrom(null); // Reset tap selection
        
        // Show success toast
        setShowMoveSuccess(true);
        setTimeout(() => setShowMoveSuccess(false), 1000);
        
        console.log('   ✅ FEN synced. Now:', fenRef.current);
        
        // Handle game end from server
        if (data.isCheckmate) {
          setGameStatus('finished');
          setWinner(data.winner);
          setResultReason('checkmate');
        } else if (data.isStalemate) {
          setGameStatus('finished');
          setResultReason('stalemate');
        } else if (data.isDraw) {
          setGameStatus('finished');
          setResultReason('draw');
        }
      } catch (err) {
        console.error('❌ Invalid server FEN:', err.message);
        console.log('   Requesting fresh state from server...');
        socket.emit('getGameState', { gameId: gameIdRef.current });
      }
    });

    socket.on('moveError', ({ message }) => {
      console.log('❌ Move rejected:', message);
      setError('Invalid move: ' + message);
      setMoveFrom(null);
      setOptionSquares({}); // Clear hints
      
      // Request fresh state from server to sync
      socket.emit('getGameState', { gameId: gameIdRef.current });
      setTimeout(() => setError(null), 3000);
    });

    socket.on('gameEnded', (data) => {
      console.log('🏁 Game Ended:', data);
      setGameStatus('finished');
      setWinner(data.winner);
      setResultReason(data.reason);
      localStorage.removeItem(STORAGE_KEY);
    });

    socket.on('playAgainStarted', () => {
      console.log('🔄 Play Again');
      setGameStatus('waiting');
      setWinner(null);
      setResultReason(null);
      setGameId(null);
      setPlayers({ white: null, black: null });
      const chess = new Chess();
      gameRef.current = chess;
      setGame(chess);
      setFen(INITIAL_FEN);
    });

    socket.on('roomError', ({ message }) => {
      console.log('❌ Room Error:', message);
      setIsLoading(false);
      setError(message);
    });

    socket.on('roomDeleted', () => {
      localStorage.removeItem(STORAGE_KEY);
      resetAll();
    });

    socket.on('gameState', (data) => {
      console.log('📩 Game state from server:', data.fen);
      console.log('   Current turn:', data.currentTurn);
      try {
        const chess = new Chess(data.fen);
        gameRef.current = chess;
        fenRef.current = data.fen;
        setGame(chess);
        setFen(data.fen);
        console.log('✅ Game state synced successfully');
      } catch (err) {
        console.error('❌ Invalid game state from server:', err.message);
      }
    });

    socket.on('aiMove', (data) => {
      console.log('🤖 AI move received:', data.from, '->', data.to);
      setAiThinking(false);
      
      const currentGame = gameRef.current;
      
      let move = currentGame.move({ from: data.from, to: data.to });
      
      if (!move && (data.to[1] === '8' || data.to[1] === '1')) {
        move = currentGame.move({ from: data.from, to: data.to, promotion: 'q' });
      }
      
      if (move) {
        gameRef.current = currentGame;
        const newFen = currentGame.fen();
        setGame(new Chess(newFen));
        setFen(newFen);
        setLastMove({ from: data.from, to: data.to });
        
        setShowMoveSuccess(true);
        setTimeout(() => setShowMoveSuccess(false), 1000);
        
        if (currentGame.isGameOver()) {
          setGameStatus('finished');
          if (currentGame.isCheckmate()) {
            setWinner({ _id: 'cpu', name: 'Computer' });
            setResultReason('checkmate');
          }
        }
      }
    });

    socket.on('aiMoveError', ({ message }) => {
      console.error('❌ AI move error:', message);
      setAiThinking(false);
    });

    return () => {
      socket.off('roomCreated');
      socket.off('gameStarted');
      socket.off('playerAssignment');
      socket.off('roomRestored');
      socket.off('moveMade');
      socket.off('moveError');
      socket.off('gameEnded');
      socket.off('playAgainStarted');
      socket.off('roomError');
      socket.off('roomDeleted');
      socket.off('gameState');
      socket.off('aiMove');
      socket.off('aiMoveError');
    };
  }, []);

  // ============================================
  // AUTO-RECONNECT ON MOUNT
  // ============================================
  useEffect(() => {
    const userRef2 = user;
    if (!userRef2 || hasCheckedStorage.current) return;
    hasCheckedStorage.current = true;

    try {
      const stored = getStoredRoom();
      if (stored && stored.roomId && gameStatus === 'idle') {
        console.log('🔄 Reconnecting to stored room:', stored.roomId);
        setIsReconnecting(true);
        socket.emit('rejoinRoom', { roomId: stored.roomId, userId: userRef2._id });
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [gameStatus, user, getStoredRoom]);

  // ============================================
  // CPU LOGIC - Request AI moves from server
  // ============================================
  useEffect(() => {
    if (!playVsCPU || gameStatus !== 'active') return;
    const currentGame = gameRef.current;
    if (currentGame.turn() === 'b' && !currentGame.isGameOver()) {
      setAiThinking(true);
      const delay = setTimeout(() => {
        console.log('🤖 Requesting AI move from server...');
        socket.emit('getAIMove', { 
          fen: fenRef.current, 
          skillLevel: 3 
        });
      }, 500);
      return () => {
        clearTimeout(delay);
        setAiThinking(false);
      };
    }
  }, [fen, playVsCPU, gameStatus]);

  // ============================================
  // ACTIONS
  // ============================================
  const handleCreateRoom = () => {
    if (!user) return;
    console.log('🚀 Creating room...');
    setError(null);
    setIsLoading(true);
    socket.emit('createRoom', { userId: user._id, userName: user.name });
    // Reset after 10s if no response
    setTimeout(() => setIsLoading(false), 10000);
  };

  const handleJoinRoom = (code) => {
    if (!user || !code) return;
    console.log('🚀 Joining room:', code);
    setError(null);
    setIsLoading(true);
    socket.emit('joinGameRoomByCode', { code, userId: user._id, userName: user.name });
    // Reset after 10s if no response
    setTimeout(() => setIsLoading(false), 10000);
  };

  const handleDeleteRoom = () => {
    if (!roomId || !user || !isHost) return;
    socket.emit('deleteRoom', { roomId, userId: user._id });
    clearRoomFromStorage();
  };

  const handleBackToMenu = () => {
    clearRoomFromStorage();
    resetAll();
  };

  const returnToGame = () => {
    const stored = getStoredRoom();
    if (stored && stored.roomId && user) {
      setIsReconnecting(true);
      socket.emit('rejoinRoom', { roomId: stored.roomId, userId: user._id });
    }
  };

  const handlePlayAgain = () => {
    if (playVsCPU) {
      startCPUGame();
    } else if (roomId) {
      socket.emit('playAgain', { roomId, userId: user._id });
    }
  };

  const startCPUGame = () => {
    if (!user) return;
    setPlayVsCPU(true);
    setMyColor('white');
    setOrientation('white');
    setIsHost(false);
    const chess = new Chess();
    gameRef.current = chess;
    setGame(chess);
    setFen(chess.fen());
    setPlayers({ white: { _id: user._id, name: user.name }, black: { _id: 'cpu', name: 'Computer' } });
    setGameStatus('active');
    setWinner(null);
    setResultReason(null);
  };

  // ============================================
  // CLICK-TO-MOVE (Two-Click System)
  // ============================================
  const onSquareClick = useCallback((visualSquare) => {
    const currentGame = gameRef.current;
    const currentFen = fenRef.current;
    const currentGameStatus = gameStatusRef.current;
    const currentMyColor = myColorRef.current;
    const currentPlayVsCPU = playVsCPURef.current;
    
    // Transform visual coordinates to logical coordinates (for Black orientation)
    let square = visualSquare;
    if (currentMyColor === 'black') {
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const file = visualSquare[0];
      const rank = parseInt(visualSquare[1]);
      square = `${files[7 - files.indexOf(file)]}${9 - rank}`;
    }
    
    console.log('👆 Square clicked:', visualSquare, '->', square, '| Selected:', moveFrom, '| My color:', currentMyColor);
    
    // Reset if game not active
    if (currentGameStatus !== 'active') {
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }
    
    // Extract turn from FEN (2nd space-separated part)
    const fenParts = currentFen.split(' ');
    const turnIndicator = fenParts[1]; // 'w' or 'b'
    const isWhitePlayer = currentMyColor === 'white';
    const expectedTurn = isWhitePlayer ? 'w' : 'b';
    
    // If no piece selected yet, try to select one (only on correct turn)
    if (!moveFrom) {
      // Check if it's this player's turn
      if (turnIndicator !== expectedTurn && !currentPlayVsCPU) {
        console.log('👆 Not your turn, turn is:', turnIndicator, 'expected:', expectedTurn);
        setShowNotYourTurn(true);
        setTimeout(() => setShowNotYourTurn(false), 1500);
        return;
      }
      
      const piece = currentGame.get(square);
      console.log('👆 Piece at', square, ':', piece);
      
      // Only select if it's the player's own piece
      const playerPieceColor = isWhitePlayer ? 'w' : 'b';
      if (piece && piece.color === playerPieceColor) {
        setMoveFrom(square);
        
        // Generate move hints (legal moves from this square)
        const moves = currentGame.moves({ square: square, verbose: true });
        const hints = {};
        moves.forEach(move => {
          const targetPiece = currentGame.get(move.to);
          if (targetPiece) {
            // Capture move - red ring
            hints[move.to] = {
              background: 'radial-gradient(circle, transparent 30%, rgba(255,0,0,0.4) 30%, rgba(255,0,0,0.4) 50%, transparent 50%)',
              borderRadius: '50%'
            };
          } else {
            // Empty square - gray dot
            hints[move.to] = {
              background: 'radial-gradient(circle, rgba(0,0,0,0.4) 35%, transparent 35%)',
              borderRadius: '50%'
            };
          }
        });
        setOptionSquares(hints);
        console.log('👆 Selected:', square, '| Hints:', moves.map(m => m.to).join(', '));
      }
      return;
    }
    
    // If same square clicked, deselect
    if (moveFrom === square) {
      setMoveFrom(null);
      setOptionSquares({});
      return;
    }
    
    // Try to make the move with auto-queen promotion
    const chess = new Chess(currentFen);
    let move = chess.move({ from: moveFrom, to: square, promotion: 'q' });
    
    if (!move) {
      // Invalid move - if clicking own piece, select it instead
      const piece = currentGame.get(square);
      if (piece && piece.color === (currentMyColor === 'white' ? 'w' : 'b')) {
        setMoveFrom(square);
        // Generate new hints for newly selected piece
        const moves = currentGame.moves({ square: square, verbose: true });
        const hints = {};
        moves.forEach(m => {
          const targetPiece = currentGame.get(m.to);
          if (targetPiece) {
            hints[m.to] = {
              background: 'radial-gradient(circle, transparent 30%, rgba(255,0,0,0.4) 30%, rgba(255,0,0,0.4) 50%, transparent 50%)',
              borderRadius: '50%'
            };
          } else {
            hints[m.to] = {
              background: 'radial-gradient(circle, rgba(0,0,0,0.4) 35%, transparent 35%)',
              borderRadius: '50%'
            };
          }
        });
        setOptionSquares(hints);
        console.log('👆 Re-selected:', square);
      } else {
        setMoveFrom(null);
        setOptionSquares({});
      }
      return;
    }
    
    const newFen = chess.fen();
    
    // Clear selection and hints
    setMoveFrom(null);
    setOptionSquares({});
    
    // For CPU: update immediately
    if (currentPlayVsCPU) {
      gameRef.current = chess;
      setGame(new Chess(newFen));
      setFen(newFen);
      setLastMove({ from: moveFrom, to: square });
      
      // Show success toast
      setShowMoveSuccess(true);
      setTimeout(() => setShowMoveSuccess(false), 1000);
      
      if (chess.isGameOver()) {
        setGameStatus('finished');
        if (chess.isCheckmate()) {
          setWinner({ _id: userRef.current?._id, name: userRef.current?.name });
          setResultReason('checkmate');
        }
      }
      return;
    }
    
    // For multiplayer: send to server
    console.log('♟️ Tap-to-move:', moveFrom, '->', square, 'FEN:', newFen);
    socket.emit('makeMove', {
      gameId: gameIdRef.current,
      from: moveFrom,
      to: square,
      fen: newFen,
      userId: userRef.current?._id
    });
    
    // Reset selection immediately (will be re-confirmed by server)
    setMoveFrom(null);
    
    // Show success toast
    setShowMoveSuccess(true);
    setTimeout(() => setShowMoveSuccess(false), 1000);
  }, [moveFrom]);

  // onDrop removed - using click-to-move only (onSquareClick)

  const handleResign = () => {
    if (playVsCPU) {
      setGameStatus('finished');
      setWinner({ _id: 'cpu', name: 'Computer' });
      setResultReason('resign');
      clearRoomFromStorage();
      return;
    }
    if (!gameId) return;
    const winnerId = myColor === 'white' ? players.black?._id : players.white?._id;
    socket.emit('endGame', { gameId, result: 'resign', winnerId, loserId: user._id, userId: user._id, isCPU: false });
    clearRoomFromStorage();
  };

  const resetAll = () => {
    const chess = new Chess();
    gameRef.current = chess;
    setGame(chess);
    setFen(INITIAL_FEN);
    setGameId(null);
    setRoomId(null);
    setGameStatus('idle');
    setPlayers({ white: null, black: null });
    setWinner(null);
    setResultReason(null);
    setLastMove(null);
    setPlayVsCPU(false);
    setError(null);
    setIsHost(false);
    setJoinCode('');
    setIsReconnecting(false);
    setIsLoading(false);
  };

  const exitToMain = () => {
    navigate('/');
  };

  // ============================================
  // DERIVED STATE
  // ============================================
  const currentTurn = game.turn();
  const isMyTurn = (currentTurn === 'w' && myColor === 'white') || (currentTurn === 'b' && myColor === 'black');
  const isCheck = game.isCheck();
  
  // Determine whose king is in check (based on turn, not perspective)
  const kingInDanger = isCheck ? (currentTurn === 'w' ? 'white' : 'black') : null;
  const isMyKingInDanger = kingInDanger === myColor;
  const isOpponentInCheck = isCheck && !isMyKingInDanger;
  
  const winnerIdStr = winner?._id || winner;
  const userIdStr = user?._id;
  const isWinner = winner && String(winnerIdStr) === String(userIdStr);
  const isCPUWinner = playVsCPU && (winnerIdStr === 'cpu' || winnerIdStr === 'Computer');
  const isDraw = resultReason === 'draw' || resultReason === 'stalemate';

  const storedRoom = getStoredRoom();

  const glassCard = `rounded-3xl backdrop-blur-xl border ${
    darkMode ? 'bg-white/5 border-white/10' : 'bg-white/50 border-white/20'
  }`;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="max-w-6xl mx-auto px-3 py-4 min-h-screen">
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/95 backdrop-blur-lg text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 max-w-[90vw]"
          >
            <X className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium text-sm">{error}</p>
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copied Toast */}
      <AnimatePresence>
        {showCopied && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-green-500/95 backdrop-blur-lg text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2"
          >
            <Check className="w-5 h-5" />
            Code Copied!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Move Success Toast */}
      <AnimatePresence>
        {showMoveSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-blue-500/95 backdrop-blur-xl text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <Check className="w-6 h-6" />
            <span className="font-semibold text-lg">Move Made!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Not Your Turn Toast */}
      <AnimatePresence>
        {showNotYourTurn && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-orange-500/95 backdrop-blur-xl text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="font-semibold text-lg">Opponent's Turn</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reconnecting Overlay */}
      <AnimatePresence>
        {isReconnecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-50 flex items-center justify-center"
          >
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold">Reconnecting...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PERSISTENT RETURN BUTTON */}
      {gameStatus === 'idle' && !playVsCPU && storedRoom && (
        <motion.button
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={returnToGame}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 py-3 px-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-green-500/40 animate-pulse flex items-center gap-3"
        >
          <PlayCircle className="w-6 h-6" />
          Return to Game #{storedRoom.roomId}
        </motion.button>
      )}

      <div className="flex flex-col lg:flex-row gap-4 pt-16">
        {/* Left Side - Board */}
        <div className="flex-1 flex flex-col items-center">
          {/* Status Badge */}
          <div className={`w-full max-w-[420px] text-center py-3 px-4 rounded-2xl mb-3 ${glassCard} ${
            gameStatus === 'active' 
              ? (isCheck ? (isMyKingInDanger ? 'bg-red-500/30 border-red-500/40 text-red-400' : 'bg-orange-500/30 border-orange-500/40 text-orange-400') : (isMyTurn ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'))
              : gameStatus === 'waiting'
              ? 'bg-blue-500/20 border-blue-500/30 text-blue-400 animate-pulse'
              : darkMode ? 'text-slate-300' : 'text-gray-600'
          }`}>
            <span className="font-semibold flex items-center justify-center gap-2">
              {gameStatus === 'active' 
                ? isCheck ? (
                    isMyKingInDanger ? (
                      <><AlertTriangle className="w-4 h-4 animate-pulse" /> Your King is in Danger!</>
                    ) : (
                      <><Swords className="w-4 h-4" /> You are Attacking!</>
                    )
                  ) : isMyTurn ? (
                    <><Monitor className="w-4 h-4" /> Your Turn</>
                  ) : playVsCPU ? (
                    aiThinking ? <><Loader2 className="w-4 h-4 animate-spin" /> AI Thinking...</> : <><Cpu className="w-4 h-4" /> Computer Ready</>
                  ) : (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Opponent's Turn</>
                  )
                : gameStatus === 'waiting' ? "Waiting for opponent..."
                : "Chess Arena"}
            </span>
          </div>

          {/* Board */}
          <div className="w-full max-w-[420px]" style={{ userSelect: 'none' }}>
            <Chessboard
              id="chess"
              position={fen}
              onSquareClick={onSquareClick}
              boardWidth={Math.min(420, window.innerWidth - 32)}
              boardStyle={{
                borderRadius: '20px',
                boxShadow: darkMode ? '0 8px 40px rgba(0,0,0,0.6)' : '0 8px 40px rgba(0,0,0,0.15)'
              }}
              orientation={orientation}
              customSquareStyles={{
                ...(lastMove && {
                  [lastMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.5)' },
                  [lastMove.to]: { backgroundColor: 'rgba(255, 255, 0, 0.5)' }
                }),
                ...(moveFrom && {
                  [moveFrom]: { 
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    boxShadow: 'inset 0 0 0 4px rgba(59, 130, 246, 1)'
                  }
                }),
                ...optionSquares,
                ...(isCheck && {
                  ...(() => {
                    const board = game.board();
                    for (let i = 0; i < 8; i++) {
                      for (let j = 0; j < 8; j++) {
                        const piece = board[i][j];
                        if (piece && piece.type === 'k' && piece.color === (currentTurn === 'w' ? 'b' : 'w')) {
                          const files = 'abcdefgh';
                          const squareNotation = files[j] + (8 - i);
                          return { 
                            [squareNotation]: { 
                              backgroundColor: 'rgba(255, 0, 0, 0.5)',
                              boxShadow: 'inset 0 0 20px 5px rgba(255, 50, 0, 0.8), 0 0 30px 10px rgba(255, 0, 0, 0.4)'
                            } 
                          };
                        }
                      }
                    }
                    return {};
                  })()
                })
              }}
              arePiecesDraggable={false}
            />
          </div>

          {/* Game Info */}
          {gameStatus === 'active' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`w-full max-w-[420px] mt-3 p-4 rounded-2xl ${glassCard}`}
            >
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${players.white ? 'bg-white border border-gray-300' : 'bg-gray-400'}`} />
                  <span className={darkMode ? 'text-slate-300' : 'text-gray-700'}>
                    <User className="w-3 h-3 inline mr-1" />
                    {players.white?.name || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${players.black ? 'bg-gray-800' : 'bg-gray-400'}`} />
                  <span className={darkMode ? 'text-slate-300' : 'text-gray-700'}>
                    {players.black?._id === 'cpu' ? <Cpu className="w-3 h-3 inline mr-1" /> : <User className="w-3 h-3 inline mr-1" />}
                    {players.black?.name || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex justify-between text-xs">
                <span className={darkMode ? 'text-slate-500' : 'text-gray-400'}>Moves: {game.history().length}</span>
                {isCheck && (
                  <span className={`font-medium flex items-center gap-1 ${isMyKingInDanger ? 'text-red-400' : 'text-orange-400'}`}>
                    {isMyKingInDanger ? <><AlertTriangle className="w-3 h-3" /> King in Check!</> : <><Swords className="w-3 h-3" /> Attacking!</>}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Side - Controls */}
        <div className="lg:w-96 flex flex-col gap-3">
          
          {/* MAIN MENU */}
          {gameStatus === 'idle' && !playVsCPU && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className={`p-8 rounded-3xl text-center ${glassCard}`}>
                <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                  darkMode ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20' : 'bg-gradient-to-br from-blue-100 to-purple-100'
                }`}>
                  <Trophy className={`w-10 h-10 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Chess Arena</h2>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Challenge a friend or play vs computer</p>
              </div>

              {/* Host Match - FIXED with loading state */}
              <motion.button 
                type="button"
                whileTap={{ scale: isLoading ? 1 : 0.98 }} 
                onClick={handleCreateRoom}
                disabled={isLoading}
                className="w-full py-5 px-6 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 text-white font-bold text-xl rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <PlusSquare className="w-6 h-6" />
                    Host New Match
                  </>
                )}
              </motion.button>

              {/* Join with Code */}
              <div className={`p-4 rounded-2xl ${glassCard}`}>
                <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Enter Room Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className={`w-full py-4 px-4 rounded-xl border text-center text-2xl font-mono font-bold tracking-[0.3em] ${
                    darkMode ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-300'
                  }`}
                  maxLength={6}
                  autoComplete="off"
                />
                <motion.button 
                  type="button"
                  whileTap={{ scale: isLoading ? 1 : 0.98 }} 
                  onClick={() => handleJoinRoom(joinCode)}
                  disabled={joinCode.length !== 6 || isLoading}
                  className={`w-full mt-3 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${
                    joinCode.length === 6 && !isLoading
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90'
                      : darkMode ? 'bg-slate-700 text-slate-500' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      Enter Game
                    </>
                  )}
                </motion.button>
              </div>

              <div className={`flex items-center gap-3 ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>
                <div className="flex-1 h-px bg-current" />
                <span className="text-sm">or</span>
                <div className="flex-1 h-px bg-current" />
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={startCPUGame}
                className={`w-full py-4 px-6 font-semibold rounded-2xl transition-all flex items-center justify-center gap-3 ${
                  darkMode ? 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Cpu className="w-5 h-5" />
                Play vs Computer
              </motion.button>

              <button onClick={exitToMain}
                className={`w-full py-3 flex items-center justify-center gap-2 ${
                  darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                Exit to Main
              </button>
            </motion.div>
          )}

          {/* WAITING ROOM - FIXED UI */}
          {roomId && gameStatus === 'waiting' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              <button onClick={handleBackToMenu}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                  darkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
                Back
              </button>

              <div className={`p-8 rounded-3xl text-center ${glassCard}`}>
                <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Your Room Code</p>
                
                <motion.div
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`text-6xl md:text-7xl font-bold tracking-[0.2em] py-6 px-4 rounded-2xl mb-4 ${
                    darkMode ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-transparent bg-clip-text' : 'bg-gradient-to-br from-blue-600 to-purple-600 text-transparent bg-clip-text'
                  }`}
                >
                  {roomId}
                </motion.div>

                <motion.button whileTap={{ scale: 0.95 }} onClick={() => {
                  navigator.clipboard.writeText(roomId);
                  setShowCopied(true);
                  if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
                  copiedTimeoutRef.current = setTimeout(() => setShowCopied(false), 2000);
                }}
                  className={`w-full py-3 rounded-xl font-medium transition-colors ${
                    darkMode ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                  }`}
                >
                  <Key className="w-4 h-4 inline mr-2" />
                  Copy Code
                </motion.button>
              </div>

              {isHost && (
                <motion.button whileTap={{ scale: 0.98 }} onClick={handleDeleteRoom}
                  className="w-full py-4 px-6 bg-red-500/20 text-red-400 font-semibold rounded-2xl hover:bg-red-500/30 transition-colors flex items-center justify-center gap-3"
                >
                  <XCircle className="w-5 h-5" />
                  Cancel / Close Room
                </motion.button>
              )}
            </motion.div>
          )}

          {/* ACTIVE GAME */}
          {gameStatus === 'active' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {roomId && !playVsCPU && (
                <div className={`p-3 rounded-xl text-center ${glassCard}`}>
                  <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Room: </span>
                  <span className={`font-mono font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{roomId}</span>
                </div>
              )}

              <div className={`p-4 rounded-2xl ${glassCard}`}>
                <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                  <RotateCcw className="w-4 h-4" />
                  Move History
                </h4>
                <div className={`text-xs font-mono max-h-32 overflow-y-auto space-y-1 ${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                  {game.history().length === 0 ? (
                    <p className="italic opacity-50">No moves yet</p>
                  ) : (
                    game.history().map((move, i) => (
                      <span key={i}>
                        {i % 2 === 0 && <span className="text-slate-500 mr-1">{Math.floor(i / 2) + 1}.</span>}
                        {move}{i % 2 !== 0 && <br />}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={handleResign}
                  className="flex-1 py-3 px-4 bg-red-500/20 text-red-400 font-medium rounded-xl hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {playVsCPU ? 'Forfeit' : 'Resign'}
                </button>
                <button onClick={() => { clearRoomFromStorage(); resetAll(); }}
                  className={`flex-1 py-3 px-4 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 ${
                    darkMode ? 'bg-white/10 text-slate-200 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  New Game
                </button>
              </div>

              <button onClick={handleBackToMenu}
                className={`w-full py-2 flex items-center justify-center gap-2 ${
                  darkMode ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Menu
              </button>
            </motion.div>
          )}

          {/* GAME OVER */}
          {gameStatus === 'finished' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className={`p-6 rounded-3xl text-center ${glassCard}`}
            >
              <div className={`w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center ${
                isWinner 
                  ? 'bg-gradient-to-br from-yellow-400/30 to-orange-400/30 border-2 border-yellow-400/50' 
                  : isCPUWinner
                  ? 'bg-red-500/20 border border-red-500/30'
                  : isDraw
                  ? 'bg-gray-500/20 border border-gray-500/30'
                  : darkMode ? 'bg-white/10' : 'bg-gray-200'
              }`}>
                {isWinner ? (
                  <Trophy className="w-12 h-12 text-yellow-400" />
                ) : isCPUWinner ? (
                  <Cpu className="w-12 h-12 text-red-400" />
                ) : isDraw ? (
                  <AlertCircle className="w-12 h-12 text-gray-400" />
                ) : (
                  <Crown className="w-12 h-12 text-slate-400" />
                )}
              </div>
              
              <h3 className={`text-2xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                {isWinner ? 'Victory!' : isCPUWinner ? 'CPU Wins!' : isDraw ? 'Draw!' : 'Game Over'}
              </h3>
              
              {winner && (
                <p className={`text-sm mb-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {winner.name || 'Unknown'}
                </p>
              )}
              
              {resultReason && (
                <p className={`text-xs mb-4 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                  {resultReason === 'checkmate' ? 'Checkmate!' : resultReason === 'resign' ? 'By resignation' : resultReason}
                </p>
              )}

              {isWinner && !playVsCPU && (
                <div className="text-green-400 font-bold text-xl mb-4 flex items-center justify-center gap-2">
                  <Trophy className="w-6 h-6" />
                  +10 Points
                </div>
              )}

              {isCPUWinner && (
                <div className="text-red-400 font-medium text-sm mb-4">
                  Better luck next time!
                </div>
              )}

              <div className="space-y-2">
                <button onClick={handlePlayAgain}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Play Again
                </button>
                <button onClick={() => { clearRoomFromStorage(); resetAll(); }}
                  className={`w-full py-2.5 flex items-center justify-center gap-2 ${
                    darkMode ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Lobby
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChessGame;
