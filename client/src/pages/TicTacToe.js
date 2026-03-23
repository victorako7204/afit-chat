/* eslint-disable */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ChevronLeft,
  Check,
  Loader2,
  X,
  ArrowLeft,
  Circle,
  Wifi,
  WifiOff,
  Zap,
  Cpu
} from 'lucide-react';
import { socket, connectSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';

const STORAGE_KEY = 'afit_ttt_room';

const TicTacToe = () => {
  const { user } = useAuth();
  const { darkMode } = React.useContext(ThemeContext);
  const navigate = useNavigate();
  
  const [mode, setMode] = useState('menu');
  const [isOnline, setIsOnline] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [gameStatus, setGameStatus] = useState('idle');
  const [players, setPlayers] = useState({ X: null, O: null });
  const [winner, setWinner] = useState(null);
  const [mySymbol, setMySymbol] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [board, setBoard] = useState(Array(9).fill(null));
  const [winningPattern, setWinningPattern] = useState(null);
  const [resultReason, setResultReason] = useState(null);
  const [isHost, setIsHost] = useState(false);
  
  const [joinCode, setJoinCode] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [error, setError] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const copiedTimeoutRef = useRef(null);
  const roomIdRef = useRef(roomId);
  const gameIdRef = useRef(gameId);
  const userRef = useRef(user);
  const mySymbolRef = useRef(mySymbol);
  const isMyTurnRef = useRef(isMyTurn);
  const boardRef = useRef(board);
  
  roomIdRef.current = roomId;
  gameIdRef.current = gameId;
  userRef.current = user;
  mySymbolRef.current = mySymbol;
  isMyTurnRef.current = isMyTurn;
  boardRef.current = board;

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

  const glassCard = `rounded-2xl backdrop-blur-xl border ${
    darkMode ? 'bg-white/5 border-white/10' : 'bg-white/50 border-white/20'
  }`;

  useEffect(() => {
    console.log('🔌 Setting up TTT socket listeners');
    connectSocket();
    
    socket.on('roomCreated', ({ roomId: rid, gameType }) => {
      console.log('✅ TTT Room Created:', rid);
      setIsLoading(false);
      setRoomId(rid);
      setGameStatus('waiting');
      setIsHost(true);
      setError(null);
      const stored = { roomId: rid, playerSymbol: 'X', isYourTurn: true, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    });

    socket.on('assignRoles', (data) => {
      console.log('🎨 TTT Roles assigned:', data);
      setMySymbol(data.symbol);
      setIsMyTurn(data.yourTurn);
      const stored = { roomId: roomIdRef.current, playerSymbol: data.symbol, isYourTurn: data.yourTurn, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    });

    socket.on('gameStarted', (data) => {
      console.log('✅ TTT Game Started:', data);
      setIsLoading(false);
      setRoomId(data.roomId);
      setGameId(data.gameId);
      setPlayers({ X: data.whitePlayer, O: data.blackPlayer });
      setBoard(data.board || Array(9).fill(null));
      setGameStatus('active');
      setWinner(null);
      setWinningPattern(null);
      setResultReason(null);
      setCurrentTurn(data.currentTurn);
      
      const currentUser = userRef.current;
      const isX = String(data.whitePlayer?._id) === String(currentUser?._id);
      setMySymbol(isX ? 'X' : 'O');
      setIsMyTurn(isX);
      setIsHost(isX);
      
      socket.emit('joinGameRoom', { gameId: data.gameId });
      
      const stored = { roomId: data.roomId, playerSymbol: isX ? 'X' : 'O', isYourTurn: isX, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    });

    socket.on('roomRestored', (data) => {
      console.log('🔄 TTT Room Restored:', data);
      setIsReconnecting(false);
      setIsOnline(true);
      setMode('online');

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
        setPlayers({ X: data.whitePlayer, O: data.blackPlayer });
        setBoard(data.board || Array(9).fill(null));
        setGameStatus('active');
        setCurrentTurn(data.currentTurn);
        
        const stored = getStoredRoom();
        if (stored?.playerSymbol) {
          setMySymbol(stored.playerSymbol);
          setIsMyTurn(data.currentTurn === stored.playerSymbol);
        }
        
        socket.emit('joinGameRoom', { gameId: data.gameId });
      }
    });

    socket.on('tttUpdateBoard', (data) => {
      console.log('⭕ TTT Board updated:', data);
      if (data.gameId !== gameIdRef.current) return;
      
      setBoard([...data.board]);
      setCurrentTurn(data.currentTurn);
      setIsMyTurn(data.currentTurn === mySymbolRef.current);
      
      if (data.winningPattern) {
        setWinningPattern(data.winningPattern);
      }
    });

    socket.on('tttGameOver', (data) => {
      console.log('🏁 TTT Game Over:', data);
      setGameStatus('finished');
      setResultReason(data.reason);
      
      if (data.winner && data.winner !== 'draw') {
        const winnerPlayer = data.winner === 'X' ? players.X : players.O;
        setWinner(winnerPlayer);
      } else if (data.winner === 'draw') {
        setWinner({ _id: 'draw', name: 'Draw' });
      }
      
      if (data.winningPattern) {
        setWinningPattern(data.winningPattern);
      }
      
      localStorage.removeItem(STORAGE_KEY);
    });

    socket.on('tttMoveError', ({ message }) => {
      console.log('❌ TTT Move error:', message);
      setError('Invalid move: ' + message);
      setTimeout(() => setError(null), 2000);
    });

    socket.on('roomError', ({ message }) => {
      console.log('❌ TTT Room Error:', message);
      setIsLoading(false);
      setError(message);
    });

    socket.on('roomDeleted', () => {
      localStorage.removeItem(STORAGE_KEY);
      resetAll();
    });

    socket.on('playAgainStarted', () => {
      console.log('🔄 TTT Play Again');
      setGameStatus('waiting');
      setWinner(null);
      setResultReason(null);
      setGameId(null);
      setPlayers({ X: null, O: null });
      setBoard(Array(9).fill(null));
      setWinningPattern(null);
    });

    return () => {
      socket.off('roomCreated');
      socket.off('assignRoles');
      socket.off('gameStarted');
      socket.off('roomRestored');
      socket.off('tttUpdateBoard');
      socket.off('tttGameOver');
      socket.off('tttMoveError');
      socket.off('roomError');
      socket.off('roomDeleted');
      socket.off('playAgainStarted');
    };
  }, []);

  useEffect(() => {
    const stored = getStoredRoom();
    if (stored && stored.roomId && gameStatus === 'idle' && mode === 'online') {
      console.log('🔄 TTT Reconnecting to stored room:', stored.roomId);
      setIsReconnecting(true);
      socket.emit('rejoinRoom', { roomId: stored.roomId, userId: user?._id });
    }
  }, [gameStatus, user, getStoredRoom, mode]);

  const setCurrentTurn = (turn) => {
    setIsMyTurn(turn === mySymbolRef.current);
  };

  const handleCreateRoom = () => {
    if (!user) return;
    console.log('🚀 Creating TTT room...');
    setError(null);
    setIsLoading(true);
    socket.emit('createRoom', { userId: user._id, userName: user.name, gameType: 'tictactoe' });
    setTimeout(() => setIsLoading(false), 10000);
  };

  const handleJoinRoom = (code) => {
    if (!user || !code) return;
    console.log('🚀 Joining TTT room:', code);
    setError(null);
    setIsLoading(true);
    socket.emit('joinGameRoomByCode', { code, userId: user._id, userName: user.name });
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
    navigate('/games');
  };

  const handlePlayAgain = () => {
    if (isOnline && roomId) {
      socket.emit('playAgain', { roomId, userId: user._id });
    } else {
      startLocalGame();
    }
  };

  const startLocalGame = () => {
    setBoard(Array(9).fill(null));
    setMySymbol('X');
    setIsMyTurn(true);
    setGameStatus('active');
    setWinner(null);
    setWinningPattern(null);
    setResultReason(null);
    setPlayers({ X: { name: 'Player 1' }, O: { name: 'Computer' } });
  };

  const startOnlineGame = () => {
    setMode('online');
    setIsOnline(true);
    setGameStatus('idle');
  };

  const handleCellClick = (index) => {
    if (gameStatus !== 'active') return;
    if (boardRef.current[index] !== null) return;
    if (!isMyTurnRef.current) {
      setError("Not your turn!");
      setTimeout(() => setError(null), 1500);
      return;
    }

    if (isOnline) {
      console.log('⭕ Online TTT Clicked cell:', index);
      socket.emit('tttMakeMove', {
        roomId: roomIdRef.current,
        index,
        symbol: mySymbolRef.current,
        userId: userRef.current?._id
      });
    } else {
      handleLocalMove(index);
    }
  };

  const handleLocalMove = (index) => {
    const newBoard = [...boardRef.current];
    newBoard[index] = mySymbolRef.current;
    setBoard(newBoard);

    const result = checkLocalWinner(newBoard);
    if (result) {
      setGameStatus('finished');
      setWinningPattern(result.pattern);
      setResultReason(result.winner === 'draw' ? 'draw' : 'win');
      if (result.winner !== 'draw') {
        setWinner(result.winner === 'X' ? { name: 'Player 1' } : { name: 'Computer' });
      }
      return;
    }

    const nextSymbol = mySymbolRef.current === 'X' ? 'O' : 'X';
    setMySymbol(nextSymbol);
    setIsMyTurn(true);

    if (nextSymbol === 'O') {
      setTimeout(() => {
        const emptyIndices = newBoard.map((v, i) => v === null ? i : null).filter(v => v !== null);
        if (emptyIndices.length > 0) {
          const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          const cpuBoard = [...newBoard];
          cpuBoard[randomIndex] = 'O';
          setBoard(cpuBoard);

          const cpuResult = checkLocalWinner(cpuBoard);
          if (cpuResult) {
            setGameStatus('finished');
            setWinningPattern(cpuResult.pattern);
            setResultReason(cpuResult.winner === 'draw' ? 'draw' : 'win');
            if (cpuResult.winner !== 'draw') {
              setWinner(cpuResult.winner === 'X' ? { name: 'Player 1' } : { name: 'Computer' });
            }
          } else {
            setMySymbol('X');
            setIsMyTurn(true);
          }
        }
      }, 500);
    }
  };

  const checkLocalWinner = (board) => {
    const patterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const pattern of patterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], pattern };
      }
    }
    if (board.every(cell => cell !== null)) {
      return { winner: 'draw', pattern: null };
    }
    return null;
  };

  const resetAll = () => {
    setMode('menu');
    setIsOnline(false);
    setRoomId(null);
    setGameId(null);
    setGameStatus('idle');
    setPlayers({ X: null, O: null });
    setWinner(null);
    setResultReason(null);
    setMySymbol(null);
    setIsMyTurn(false);
    setBoard(Array(9).fill(null));
    setWinningPattern(null);
    setIsHost(false);
    setJoinCode('');
    setIsReconnecting(false);
    setIsLoading(false);
  };

  const winnerIdStr = winner?._id || winner;
  const userIdStr = user?._id;
  const isWinner = winner && String(winnerIdStr) === String(userIdStr);
  const isDraw = resultReason === 'draw';

  const renderCell = (index) => {
    const value = board[index];
    const isWinningCell = winningPattern?.includes(index);
    const canClick = gameStatus === 'active' && board[index] === null && isMyTurn && !isOnline;
    const canClickOnline = gameStatus === 'active' && board[index] === null && isMyTurn && isOnline;
    
    return (
      <motion.button
        key={index}
        onClick={() => handleCellClick(index)}
        disabled={!canClick && !canClickOnline}
        whileTap={{ scale: (canClick || canClickOnline) ? 0.95 : 1 }}
        className={`
          w-full aspect-square rounded-xl flex items-center justify-center
          text-6xl md:text-7xl font-bold transition-all
          ${darkMode ? 'bg-white/5' : 'bg-gray-100'}
          ${(canClick || canClickOnline) ? (darkMode ? 'hover:bg-white/10 cursor-pointer' : 'hover:bg-gray-200 cursor-pointer') : 'cursor-not-allowed'}
          ${isWinningCell ? (darkMode ? 'bg-green-500/30' : 'bg-green-200') : ''}
        `}
      >
        {value === 'X' && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            className="text-blue-500 drop-shadow-lg"
          >
            <X className="w-16 h-16 md:w-20 md:h-20" strokeWidth={3} />
          </motion.div>
        )}
        {value === 'O' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-red-500 drop-shadow-lg"
          >
            <Circle className="w-16 h-16 md:w-20 md:h-20" strokeWidth={3} />
          </motion.div>
        )}
      </motion.button>
    );
  };

  return (
    <div className="max-w-lg mx-auto px-3 py-4 min-h-screen">
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/95 backdrop-blur-lg text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3"
          >
            <X className="w-5 h-5" />
            <p className="font-medium text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

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

      <button onClick={handleBackToMenu}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-4 transition-colors ${
          darkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
        }`}
      >
        <ChevronLeft className="w-5 h-5" />
        Back to Games
      </button>

      {mode === 'menu' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className={`p-8 rounded-3xl text-center ${glassCard}`}>
            <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
              darkMode ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-br from-blue-100 to-cyan-100'
            }`}>
              <XCircle className={`w-12 h-12 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Tic-Tac-Toe</h1>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>X vs O Battle</p>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={startLocalGame}
            className={`w-full py-5 px-6 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg transition-all ${
              darkMode
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
            }`}
          >
            <Cpu className="w-6 h-6" />
            Local Play (vs Computer)
          </motion.button>

          <div className={`flex items-center gap-3 ${darkMode ? 'text-slate-600' : 'text-gray-400'}`}>
            <div className="flex-1 h-px bg-current" />
            <span className="text-sm">or</span>
            <div className="flex-1 h-px bg-current" />
          </div>

          <motion.button
            whileTap={{ scale: isLoading ? 1 : 0.98 }}
            onClick={handleCreateRoom}
            disabled={isLoading}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 text-white font-bold text-xl rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {isLoading ? (
              <><Loader2 className="w-6 h-6 animate-spin" /> Creating...</>
            ) : (
              <><PlusSquare className="w-6 h-6" /> Host Online Match</>
            )}
          </motion.button>

          <div className={`p-4 rounded-2xl ${glassCard}`}>
            <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>Join with Code</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className={`w-full py-3 px-4 rounded-xl border text-center text-2xl font-mono font-bold tracking-[0.3em] ${
                darkMode ? 'bg-white/5 border-white/10 text-white placeholder-slate-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-300'
              }`}
              maxLength={6}
            />
            <motion.button
              whileTap={{ scale: joinCode.length === 6 && !isLoading ? 0.98 : 1 }}
              onClick={() => { startOnlineGame(); handleJoinRoom(joinCode); }}
              disabled={joinCode.length !== 6 || isLoading}
              className={`w-full mt-3 py-3 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 ${
                joinCode.length === 6
                  ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                  : darkMode ? 'bg-slate-700 text-slate-500' : 'bg-gray-200 text-gray-400'
              }`}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wifi className="w-5 h-5" />}
              Join Online
            </motion.button>
          </div>
        </motion.div>
      )}

      {mode === 'online' && gameStatus === 'waiting' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
          <div className={`p-8 rounded-3xl text-center ${glassCard}`}>
            <Loader2 className={`w-12 h-12 mx-auto mb-4 animate-spin ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Waiting for opponent...</h2>
            <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Share this code:</p>
          </div>

          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`text-6xl font-bold tracking-[0.2em] py-8 rounded-2xl text-center ${
              darkMode ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 text-transparent bg-clip-text' : 'bg-gradient-to-br from-blue-600 to-cyan-600 text-transparent bg-clip-text'
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
            className={`w-full py-3 rounded-xl font-medium ${
              darkMode ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
            }`}
          >
            <Key className="w-4 h-4 inline mr-2" />
            Copy Code
          </motion.button>

          {isHost && (
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleDeleteRoom}
              className="w-full py-4 bg-red-500/20 text-red-400 font-semibold rounded-2xl hover:bg-red-500/30 flex items-center justify-center gap-3"
            >
              <XCircle className="w-5 h-5" />
              Cancel Room
            </motion.button>
          )}
        </motion.div>
      )}

      {(mode === 'online' || mode === 'menu') && gameStatus === 'active' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {mySymbol && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`p-4 rounded-2xl text-center ${glassCard} ${
                mySymbol === 'X' ? (darkMode ? 'bg-blue-500/20 border-blue-500/30' : 'bg-blue-100 border-blue-200') : (darkMode ? 'bg-red-500/20 border-red-500/30' : 'bg-red-100 border-red-200')
              }`}
            >
              <div className={`flex items-center justify-center gap-3`}>
                {mySymbol === 'X' ? (
                  <X className={`w-10 h-10 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} strokeWidth={3} />
                ) : (
                  <Circle className={`w-10 h-10 ${darkMode ? 'text-red-400' : 'text-red-600'}`} strokeWidth={3} />
                )}
                <span className={`text-xl font-bold ${mySymbol === 'X' ? (darkMode ? 'text-blue-400' : 'text-blue-600') : (darkMode ? 'text-red-400' : 'text-red-600')}`}>
                  You are {mySymbol}
                </span>
              </div>
            </motion.div>
          )}

          <div className={`text-center py-3 px-4 rounded-2xl ${glassCard} ${
            isMyTurn ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
          }`}>
            <span className="font-semibold flex items-center justify-center gap-2">
              {isMyTurn ? (
                <><Zap className="w-5 h-5" /> Your Turn!</>
              ) : (
                <><Loader2 className="w-5 h-5 animate-spin" /> {isOnline ? "Opponent's Turn" : "Computer's Turn"}</>
              )}
            </span>
          </div>

          <div className={`grid grid-cols-3 gap-2 p-4 rounded-2xl ${glassCard}`}>
            {board.map((_, index) => renderCell(index))}
          </div>

          <div className={`flex justify-between items-center p-4 rounded-2xl ${glassCard}`}>
            <div className={`flex items-center gap-2 ${mySymbol === 'X' ? (darkMode ? 'text-blue-400' : 'text-blue-600') : (darkMode ? 'text-slate-500' : 'text-gray-400')}`}>
              <X className="w-6 h-6" strokeWidth={3} />
              <span className="text-sm font-medium">{players.X?.name || 'Player X'}</span>
            </div>
            <div className={`flex items-center gap-2 ${mySymbol === 'O' ? (darkMode ? 'text-red-400' : 'text-red-600') : (darkMode ? 'text-slate-500' : 'text-gray-400')}`}>
              <Circle className="w-6 h-6" strokeWidth={3} />
              <span className="text-sm font-medium">{players.O?.name || 'Player O'}</span>
            </div>
          </div>
        </motion.div>
      )}

      {gameStatus === 'finished' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className={`p-8 rounded-3xl text-center ${glassCard}`}
        >
          <div className={`w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center ${
            isWinner 
              ? 'bg-gradient-to-br from-yellow-400/30 to-orange-400/30 border-2 border-yellow-400/50' 
              : isDraw
              ? 'bg-gray-500/20 border border-gray-500/30'
              : darkMode ? 'bg-white/10' : 'bg-gray-200'
          }`}>
            {isWinner ? (
              <Trophy className="w-12 h-12 text-yellow-400" />
            ) : isDraw ? (
              <XCircle className="w-12 h-12 text-gray-400" />
            ) : (
              <Crown className="w-12 h-12 text-slate-400" />
            )}
          </div>
          
          <h3 className={`text-2xl font-bold mb-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {isWinner ? 'You Won!' : isDraw ? 'Draw!' : 'Game Over'}
          </h3>
          
          {winner && !isDraw && (
            <p className={`text-sm mb-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              {winner.name || 'Unknown'}
            </p>
          )}
          
          {resultReason && (
            <p className={`text-xs mb-4 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
              {resultReason === 'win' ? 'Line completed!' : resultReason}
            </p>
          )}

          {isWinner && (
            <div className="text-green-400 font-bold text-xl mb-4 flex items-center justify-center gap-2">
              <Trophy className="w-6 h-6" />
              +5 Points
            </div>
          )}

          <div className="space-y-2">
            <button onClick={handlePlayAgain}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-cyan-700 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Play Again
            </button>
            <button onClick={resetAll}
              className={`w-full py-2.5 flex items-center justify-center gap-2 ${
                darkMode ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Menu
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TicTacToe;
