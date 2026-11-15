import {
  ArrowLeft,
  HelpCircle,
  Lightbulb,
  Play,
  RefreshCw,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GridCoord,
  NUMBER_LINK_MODES,
  NumberGrid,
  NumberLinkModeId,
  applyGcdRule,
  countRemainingCells,
  findConnectionPath,
  findValidPair,
  gcd,
  generateNumberLinkBoard,
} from '../game/numberLink';
import { soundSynth } from '../game/sound';

interface HistorySnapshot {
  grid: NumberGrid;
  score: number;
}

interface NumberLinkGameProps {
  onExitToPortal: () => void;
}

function formatTimeMMSS(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function cloneGrid(grid: NumberGrid): NumberGrid {
  return grid.map((row) => [...row]);
}

export function NumberLinkGame({ onExitToPortal }: NumberLinkGameProps) {
  const [mode, setMode] = useState<NumberLinkModeId>('HARD');
  const [hasStarted, setHasStarted] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [muted, setMuted] = useState(() => soundSynth.isMuted());

  const [initialGrid, setInitialGrid] = useState<NumberGrid>(() =>
    generateNumberLinkBoard('HARD')
  );
  const [grid, setGrid] = useState<NumberGrid>(() => cloneGrid(initialGrid));
  const [selected, setSelected] = useState<GridCoord | null>(null);
  const [score, setScore] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [message, setMessage] = useState(
    'Chọn ô số đầu tiên để bắt đầu nối.'
  );
  const [connectionPath, setConnectionPath] = useState<GridCoord[] | null>(
    null
  );
  const [hintPair, setHintPair] = useState<[GridCoord, GridCoord] | null>(null);
  const [history, setHistory] = useState<HistorySnapshot[]>([]);

  const pathTimerRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (pathTimerRef.current !== null) {
      window.clearTimeout(pathTimerRef.current);
      pathTimerRef.current = null;
    }
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const startNewGame = useCallback(
    (targetMode: NumberLinkModeId = mode) => {
      clearTimers();
      const nextBoard = generateNumberLinkBoard(targetMode);
      setMode(targetMode);
      setInitialGrid(cloneGrid(nextBoard));
      setGrid(nextBoard);
      setSelected(null);
      setScore(0);
      setElapsedSeconds(0);
      setStatus('playing');
      setConnectionPath(null);
      setHintPair(null);
      setHistory([]);
      setHasStarted(true);
      setMessage('Chọn 2 ô có thể nối (tối đa 3 đoạn) và có ƯCLN > 1.');
      soundSynth.playStep(2);
    },
    [clearTimers, mode]
  );

  const restartCurrentGame = useCallback(() => {
    clearTimers();
    setGrid(cloneGrid(initialGrid));
    setSelected(null);
    setScore(0);
    setElapsedSeconds(0);
    setStatus('playing');
    setConnectionPath(null);
    setHintPair(null);
    setHistory([]);
    setMessage('Đã đặt lại bàn cờ hiện tại.');
    soundSynth.playUndo();
  }, [clearTimers, initialGrid]);

  // Timer
  useEffect(() => {
    if (!hasStarted || status !== 'playing') return;
    const id = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [hasStarted, status]);

  const handleUndo = useCallback(() => {
    if (!hasStarted || status !== 'playing' || history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setGrid(cloneGrid(prev.grid));
    setScore(prev.score);
    setSelected(null);
    setConnectionPath(null);
    setHintPair(null);
    setMessage('Đã hoàn tác nước đi vừa rồi.');
    soundSynth.playUndo();
  }, [hasStarted, history, status]);

  const handleHint = useCallback(() => {
    if (!hasStarted || status !== 'playing') return;
    const found = findValidPair(grid);
    if (!found) {
      setMessage('Không còn nước đi hợp lệ nào trên bảng.');
      return;
    }
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
    }
    setHintPair([found.p1, found.p2]);
    const v1 = grid[found.p1.r][found.p1.c];
    const v2 = grid[found.p2.r][found.p2.c];
    setMessage(`Gợi ý: Có thể nối cặp số ${v1} và ${v2}.`);
    soundSynth.playStep(3);
    hintTimerRef.current = window.setTimeout(() => {
      setHintPair(null);
      hintTimerRef.current = null;
    }, 2800);
  }, [grid, hasStarted, status]);

  const handleCellClick = useCallback(
    (pos: GridCoord) => {
      if (!hasStarted || status !== 'playing') return;
      const clickedVal = grid[pos.r][pos.c];
      if (clickedVal === null) return;

      setHintPair(null);

      if (!selected) {
        setSelected(pos);
        setMessage(`Đã chọn ô có giá trị ${clickedVal}.`);
        soundSynth.playStep(1);
        return;
      }

      if (selected.r === pos.r && selected.c === pos.c) {
        setSelected(null);
        setMessage('Đã bỏ chọn ô.');
        return;
      }

      const val1 = grid[selected.r][selected.c];
      if (val1 === null) {
        setSelected(pos);
        return;
      }

      const path = findConnectionPath(grid, selected, pos);
      if (!path) {
        soundSynth.playBlocked();
        setMessage(
          'Không thể nối 2 ô này theo đường tối đa 3 đoạn thẳng.'
        );
        setSelected(pos);
        return;
      }

      const g = gcd(val1, clickedVal);
      if (val1 !== clickedVal && g <= 1) {
        soundSynth.playBlocked();
        setMessage(
          `Không thể nối ${val1} và ${clickedVal}: ƯCLN = 1 (nguyên tố cùng nhau).`
        );
        setSelected(pos);
        return;
      }

      // Valid connection!
      const { newVal1, newVal2, gcdVal, points } = applyGcdRule(
        val1,
        clickedVal
      );

      setHistory((prev) => [
        ...prev.slice(-49),
        { grid: cloneGrid(grid), score },
      ]);

      const nextGrid = cloneGrid(grid);
      nextGrid[selected.r][selected.c] = newVal1;
      nextGrid[pos.r][pos.c] = newVal2;

      const nextScore = score + points;
      setGrid(nextGrid);
      setScore(nextScore);
      setSelected(null);

      // Show connection line
      if (pathTimerRef.current !== null) {
        window.clearTimeout(pathTimerRef.current);
      }
      setConnectionPath(path);
      pathTimerRef.current = window.setTimeout(() => {
        setConnectionPath(null);
        pathTimerRef.current = null;
      }, 480);

      // Build clear feedback message
      if (val1 === clickedVal) {
        setMessage(
          `Nối ${val1} = ${clickedVal} — Cả 2 ô biến mất! +${points} điểm`
        );
      } else if (newVal1 === null && newVal2 === null) {
        setMessage(
          `Nối ${val1} và ${clickedVal} (ƯCLN=${gcdVal}) — Cả 2 biến mất! +${points} điểm`
        );
      } else if (newVal1 === null) {
        setMessage(
          `Nối ${val1} và ${clickedVal} (ƯCLN=${gcdVal}) — ${val1} biến mất, ${clickedVal}→${newVal2}! +${points} điểm`
        );
      } else if (newVal2 === null) {
        setMessage(
          `Nối ${val1} và ${clickedVal} (ƯCLN=${gcdVal}) — ${clickedVal} biến mất, ${val1}→${newVal1}! +${points} điểm`
        );
      } else {
        setMessage(
          `Nối ${val1} và ${clickedVal} (ƯCLN=${gcdVal}) — ${val1}→${newVal1}, ${clickedVal}→${newVal2}! +${points} điểm`
        );
      }

      // Check win / lose
      const rem = countRemainingCells(nextGrid);
      if (rem === 0) {
        setStatus('won');
        soundSynth.playVictory();
        setMessage(`CHIẾN THẮNG! Đã xóa sạch bảng với ${nextScore} điểm.`);
      } else if (findValidPair(nextGrid) === null) {
        setStatus('lost');
        soundSynth.playBlocked();
        setMessage(
          `THUA CUỘC! Không còn nước đi hợp lệ (còn ${rem} ô).`
        );
      } else {
        soundSynth.playStep(newVal1 === null || newVal2 === null ? 6 : 3);
      }
    },
    [grid, hasStarted, score, selected, status]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showRulesModal) {
        if (e.key === 'Escape') setShowRulesModal(false);
        return;
      }
      if (!hasStarted && e.key === 'Enter') {
        e.preventDefault();
        startNewGame(mode);
        return;
      }
      if (!hasStarted) return;

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'h' || e.key === 'H') {
        handleHint();
      } else if (e.key === 'r' || e.key === 'R') {
        restartCurrentGame();
      } else if (e.key === 'n' || e.key === 'N') {
        startNewGame(mode);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleHint,
    handleUndo,
    hasStarted,
    mode,
    restartCurrentGame,
    showRulesModal,
    startNewGame,
  ]);

  const remainingCells = useMemo(() => countRemainingCells(grid), [grid]);
  const totalCells = grid.length * grid.length;
  const cfg = NUMBER_LINK_MODES[mode];

  const toggleMute = () => {
    const next = !muted;
    soundSynth.setMuted(next);
    setMuted(next);
  };

  return (
    <div className="h-screen w-screen bg-[#060d1f] text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Top Bar: 3-zone contract */}
      <header className="relative z-20 flex items-center justify-between gap-6 border-b border-slate-800/90 bg-[#071024] px-4 sm:px-6 py-3">
        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-white hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 uppercase"
        >
          Số Liên Tranh Bá
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={onExitToPortal}
            className="inline-flex items-center gap-1.5 hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Cổng game</span>
          </button>
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="inline-flex items-center gap-1.5 hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Luật chơi</span>
          </button>
          <button
            type="button"
            onClick={restartCurrentGame}
            disabled={!hasStarted}
            className="inline-flex items-center gap-1.5 hover:text-white hover:underline underline-offset-4 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Chơi lại (R)</span>
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex items-center gap-1.5 hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            <span>{muted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật'}</span>
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onExitToPortal}
            className="md:hidden rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 whitespace-nowrap"
          >
            Cổng game
          </button>
          <button
            type="button"
            onClick={() => startNewGame(mode)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2eff14] px-4 py-2 text-xs sm:text-sm font-bold text-slate-950 hover:bg-[#5cff47] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Ván mới (N)</span>
          </button>
        </div>
      </header>

      {/* Start / Mode Selection Screen */}
      {!hasStarted ? (
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl border border-slate-700/75 bg-[#0b1730] p-6 sm:p-10 shadow-2xl space-y-6">
            <div className="space-y-2 text-center">
              <p className="text-xs font-mono text-amber-300">
                Nối thú số học · Đường gấp khúc ≤ 3 đoạn · Triệt tiêu bằng ƯCLN
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-wide text-white text-balance">
                Số Liên Tranh Bá
              </h1>
              <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Chọn 2 ô số nối được với nhau theo đường gấp khúc tối đa 3 đoạn thẳng. Nếu giống nhau cả hai biến mất; nếu khác nhau, mỗi số chia cho ƯCLN của cả hai (thương bằng 1 sẽ biến mất).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm border-y border-slate-800 py-5">
              <div className="space-y-1">
                <h2 className="font-display text-sm font-semibold text-cyan-300">
                  Quy tắc nối & Triệt tiêu
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  Hai số giống nhau hoặc có <strong className="text-white">ƯCLN &gt; 1</strong> mới nối được. Cặp số nguyên tố cùng nhau (ƯCLN = 1) không thể nối.
                </p>
              </div>
              <div className="space-y-1">
                <h2 className="font-display text-sm font-semibold text-cyan-300">
                  Điều kiện thắng & thua
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  Xóa sạch toàn bộ ô số trên bàn cờ để chiến thắng. Nếu bảng còn số nhưng không còn nước nối hợp lệ nào, lượt thi kết thúc.
                </p>
              </div>
            </div>

            {/* Difficulty Selection */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-slate-400 text-center">
                Chọn kích thước bàn cờ và độ khó
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const).map(
                  (key) => {
                    const m = NUMBER_LINK_MODES[key];
                    const active = mode === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setMode(key)}
                        className={`flex flex-col items-start text-left rounded-xl border p-3.5 transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/50'
                            : 'border-slate-700 bg-[#071024] hover:border-slate-500'
                        }`}
                      >
                        <span className="font-display text-sm sm:text-base font-bold text-white">
                          {m.name}
                        </span>
                        <span className="mt-1 text-[11px] font-mono text-amber-300 tabular-nums">
                          {m.size} × {m.size} ({m.size * m.size} ô)
                        </span>
                        <span className="mt-0.5 text-[11px] text-slate-400">
                          Số {m.minValue}–{m.maxValue}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => startNewGame(mode)}
                className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#2eff14] hover:bg-[#5cff47] text-slate-950 font-display text-base sm:text-lg font-bold tracking-wider uppercase px-12 py-3.5 shadow-lg transition-transform active:scale-[0.98] whitespace-nowrap min-h-[48px]"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>Bắt đầu chơi</span>
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col min-h-0">
          {/* HUD & Utility Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 bg-[#08132a] px-4 sm:px-6 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm font-mono tabular-nums text-slate-200">
              <span>
                <span className="text-slate-400">Bàn cờ: </span>
                <strong className="text-cyan-300 font-sans">
                  {cfg.name} ({cfg.size}×{cfg.size})
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <span className="text-slate-400">Điểm: </span>
                <strong className="text-emerald-400">{score}</strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <span className="text-slate-400">Thời gian: </span>
                <strong className="text-amber-300">
                  {formatTimeMMSS(elapsedSeconds)}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <span className="text-slate-400">Ô còn lại: </span>
                <strong className="text-white">
                  {remainingCells}/{totalCells}
                </strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="hidden lg:flex items-center gap-1 rounded-lg bg-[#060d1f] p-1 border border-slate-800"
                role="tablist"
                aria-label="Độ khó"
              >
                {(['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={mode === key}
                    onClick={() => startNewGame(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      mode === key
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {NUMBER_LINK_MODES[key].size}×{NUMBER_LINK_MODES[key].size}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleUndo}
                disabled={status !== 'playing' || history.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Hoàn tác (Z)</span>
              </button>

              <button
                type="button"
                onClick={handleHint}
                disabled={status !== 'playing'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40 whitespace-nowrap"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Gợi ý (H)</span>
              </button>
            </div>
          </div>

          {/* Board Workspace */}
          <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center p-2 sm:p-4 bg-[#070f23]">
            {/* (size + 2) x (size + 2) unified square grid so outer U-turn paths align identically */}
            <div
              className="relative aspect-square w-full max-w-[min(70vh,620px)]"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${grid.length + 2}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${grid.length + 2}, minmax(0, 1fr))`,
              }}
            >
              {/* Subtle inner board frame */}
              <div
                className="pointer-events-none rounded-lg border border-slate-800/80 bg-[#0b1530]/60"
                style={{
                  gridColumn: `2 / ${grid.length + 2}`,
                  gridRow: `2 / ${grid.length + 2}`,
                }}
              />

              {/* Number Tiles */}
              {grid.map((row, r) =>
                row.map((val, c) => {
                  const isSelected =
                    selected !== null && selected.r === r && selected.c === c;
                  const isHint =
                    hintPair !== null &&
                    ((hintPair[0].r === r && hintPair[0].c === c) ||
                      (hintPair[1].r === r && hintPair[1].c === c));

                  return (
                    <div
                      key={`${r}-${c}`}
                      style={{
                        gridColumn: c + 2,
                        gridRow: r + 2,
                      }}
                      className="p-[2px] sm:p-[3px] z-10"
                    >
                      {val !== null ? (
                        <button
                          type="button"
                          onClick={() => handleCellClick({ r, c })}
                          className={`w-full h-full rounded-md border-2 font-mono font-bold tabular-nums flex items-center justify-center transition-all duration-100 focus-visible:outline-2 focus-visible:outline-white ${
                            grid.length >= 10
                              ? 'text-xs sm:text-sm'
                              : grid.length >= 8
                              ? 'text-sm sm:text-base'
                              : 'text-base sm:text-xl'
                          } ${
                            isSelected
                              ? 'bg-amber-400 border-white text-slate-950 scale-[1.04] shadow-lg shadow-amber-500/30'
                              : isHint
                              ? 'bg-cyan-500/30 border-cyan-300 text-cyan-100 ring-2 ring-cyan-400'
                              : 'bg-[#1a2547] border-[#4c72b0] text-white hover:bg-[#273869] hover:border-cyan-300'
                          }`}
                        >
                          {val}
                        </button>
                      ) : (
                        <div className="w-full h-full rounded-md bg-slate-950/20" />
                      )}
                    </div>
                  );
                })
              )}

              {/* Connection Path SVG Overlay */}
              {connectionPath && connectionPath.length >= 2 && (
                <svg
                  viewBox={`0 0 ${grid.length + 2} ${grid.length + 2}`}
                  className="pointer-events-none absolute inset-0 w-full h-full z-20"
                >
                  <polyline
                    fill="none"
                    stroke="#fb923c"
                    strokeWidth={0.14}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={connectionPath
                      .map((p) => `${p.c + 1.5},${p.r + 1.5}`)
                      .join(' ')}
                  />
                  <circle
                    cx={connectionPath[0].c + 1.5}
                    cy={connectionPath[0].r + 1.5}
                    r={0.18}
                    fill="#fde047"
                  />
                  <circle
                    cx={connectionPath[connectionPath.length - 1].c + 1.5}
                    cy={connectionPath[connectionPath.length - 1].r + 1.5}
                    r={0.18}
                    fill="#fde047"
                  />
                </svg>
              )}
            </div>

            {/* End-of-game Overlay */}
            {status !== 'playing' && (
              <div
                className="absolute inset-0 z-30 flex items-center justify-center bg-[#040916]/85 p-4"
                role="dialog"
                aria-modal="true"
              >
                <div
                  className={`w-full max-w-md rounded-xl border bg-[#0b1730] p-6 sm:p-8 text-center shadow-2xl space-y-5 ${
                    status === 'won'
                      ? 'border-emerald-400/50'
                      : 'border-red-400/50'
                  }`}
                >
                  <div className="space-y-1.5">
                    <p className="text-xs font-mono text-slate-400">
                      {cfg.name} · {cfg.size}×{cfg.size}
                    </p>
                    <h2
                      className={`font-display text-3xl font-bold uppercase ${
                        status === 'won' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {status === 'won' ? 'CHIẾN THẮNG!' : 'THẤT BẠI!'}
                    </h2>
                    <p className="text-sm text-slate-300">
                      {status === 'won'
                        ? 'Bạn đã triệt tiêu toàn bộ các ô số trên bàn cờ.'
                        : `Không còn nước đi hợp lệ nào (còn ${remainingCells} ô trên bảng).`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-y border-slate-800 py-3 font-mono tabular-nums">
                    <div>
                      <p className="text-[11px] font-sans text-slate-400">
                        Điểm số
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald-300">
                        {score}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-sans text-slate-400">
                        Thời gian
                      </p>
                      <p className="mt-1 text-xl font-bold text-amber-300">
                        {formatTimeMMSS(elapsedSeconds)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {status === 'lost' && history.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const prev = history[history.length - 1];
                          setHistory((h) => h.slice(0, -1));
                          setGrid(cloneGrid(prev.grid));
                          setScore(prev.score);
                          setStatus('playing');
                          setMessage('Đã hoàn tác về nước trước đó.');
                        }}
                        className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-200 hover:bg-cyan-500/25 whitespace-nowrap"
                      >
                        Hoàn tác 1 bước
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onExitToPortal}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                    >
                      Về cổng game
                    </button>
                    <button
                      type="button"
                      onClick={() => startNewGame(mode)}
                      className="rounded-lg bg-[#2eff14] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-950 hover:bg-[#5cff47] whitespace-nowrap"
                    >
                      Chơi ván mới
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Status Message Footer */}
          <footer className="border-t border-slate-800 bg-[#071024] px-4 py-2.5 text-center text-xs sm:text-sm text-slate-200">
            {message}
          </footer>
        </main>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040916]/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="number-link-rules-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#0b1730] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="number-link-rules-title"
                className="font-display text-xl font-bold uppercase text-white"
              >
                Luật chơi Số Liên Tranh Bá
              </h2>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300 hover:text-white"
              >
                Đóng
              </button>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-300 leading-relaxed list-disc pl-5">
              <li>
                <strong className="text-white">Bàn cờ thử thách:</strong> Mặc định là bảng vuông <strong className="text-cyan-300">8 × 8 (64 ô)</strong> (có thể chọn thêm 4×4, 6×6, 10×10).
              </li>
              <li>
                <strong className="text-white">Quy tắc nối số:</strong> Chọn 2 ô số có thể nối với nhau theo đường gấp khúc tối đa <strong className="text-white">3 đoạn thẳng</strong> (tương tự luật Nối thú, được phép đi vòng ngoài biên bảng).
              </li>
              <li>
                <strong className="text-white">Cơ chế triệt tiêu:</strong> Nếu 2 số giống hệt nhau, cả 2 ô biến mất (+100 điểm). Nếu khác nhau và có <strong className="text-amber-300">ƯCLN &gt; 1</strong>, mỗi số tự chia cho ƯCLN: thương bằng 1 sẽ biến mất, thương &gt; 1 giữ nguyên giá trị mới.
              </li>
              <li>
                <strong className="text-white">Hoàn thành:</strong> Xóa sạch toàn bộ ô số để chiến thắng. Hết nước nối hợp lệ mà bảng vẫn còn số sẽ tính là thất bại.
              </li>
            </ul>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
