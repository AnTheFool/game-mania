import { ArrowLeft, Flag, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GameId } from '../data/gamesCatalog';
import { soundSynth } from '../game/sound';

interface MiniGameShellProps {
  title: string;
  subtitle: string;
  onExit: () => void;
  onRestart: () => void;
  children: React.ReactNode;
}

function MiniGameShell({
  title,
  subtitle,
  onExit,
  onRestart,
  children,
}: MiniGameShellProps) {
  return (
    <div className="min-h-screen w-full bg-[#091226] text-slate-100 flex flex-col">
      <header className="flex items-center justify-between gap-6 border-b border-slate-800 bg-[#060d1f] px-5 py-3.5">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Về cổng game</span>
        </button>

        <div className="text-center min-w-0">
          <h1 className="font-display text-base sm:text-lg font-bold tracking-wide text-white uppercase truncate">
            {title}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block truncate">
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Chơi lại</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

/* 1. MA TRẬN ÁNH SÁNG (5x5 Lights Out) */
function LightsOutGame({ onExit }: { onExit: () => void }) {
  const createBoard = useCallback(() => {
    const grid = Array.from({ length: 5 }, () => Array(5).fill(false));
    const toggle = (g: boolean[][], r: number, c: number) => {
      const dirs = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
          g[nr][nc] = !g[nr][nc];
        }
      }
    };
    for (let i = 0; i < 9; i++) {
      toggle(grid, Math.floor(Math.random() * 5), Math.floor(Math.random() * 5));
    }
    if (grid.every((row) => row.every((cell) => !cell))) {
      toggle(grid, 2, 2);
    }
    return grid;
  }, []);

  const [grid, setGrid] = useState<boolean[][]>(createBoard);
  const [moves, setMoves] = useState(0);

  const solved = grid.every((row) => row.every((c) => !c));
  const litCount = grid.flat().filter(Boolean).length;

  const handleClick = (r: number, c: number) => {
    if (solved) return;
    soundSynth.playStep(moves);
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      const dirs = [
        [0, 0],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
          next[nr][nc] = !next[nr][nc];
        }
      }
      if (next.every((row) => row.every((cell) => !cell))) {
        soundSynth.playVictory();
      }
      return next;
    });
    setMoves((m) => m + 1);
  };

  const restart = () => {
    setGrid(createBoard());
    setMoves(0);
  };

  return (
    <MiniGameShell
      title="Ma Trận Ánh Sáng"
      subtitle="Chạm vào một ô để đảo trạng thái sáng/tối của ô đó và 4 ô kề cạnh. Mục tiêu: tắt toàn bộ đèn."
      onExit={onExit}
      onRestart={restart}
    >
      <div className="space-y-5 text-center">
        <div className="flex items-center justify-center gap-6 font-mono text-sm tabular-nums text-slate-300">
          <span>
            Số bước: <strong className="text-white">{moves}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Đèn còn sáng: <strong className="text-cyan-300">{litCount}</strong>
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2.5 p-4 rounded-xl border border-slate-800 bg-[#0d1933]">
          {grid.map((row, r) =>
            row.map((on, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleClick(r, c)}
                aria-label={`Ô ${r + 1}-${c + 1} ${on ? 'đang sáng' : 'đang tắt'}`}
                className={`h-12 w-12 sm:h-14 sm:w-14 rounded-lg border transition-colors ${
                  on
                    ? 'bg-cyan-400 border-cyan-200 shadow-lg shadow-cyan-500/30'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                }`}
              />
            ))
          )}
        </div>

        {solved && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-5 py-3 text-sm text-emerald-300">
            Hoàn thành xuất sắc sau{' '}
            <span className="font-mono font-bold">{moves}</span> bước!
          </div>
        )}
      </div>
    </MiniGameShell>
  );
}

/* 2. XẾP SỐ CỔ ĐIỂN (15-Puzzle) */
function FifteenPuzzleGame({ onExit }: { onExit: () => void }) {
  const createSolved = () => [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0,
  ];

  const createShuffled = useCallback(() => {
    const arr = createSolved();
    let emptyIdx = 15;
    let prevIdx = -1;
    for (let i = 0; i < 140; i++) {
      const r = Math.floor(emptyIdx / 4);
      const c = emptyIdx % 4;
      const neighbors: number[] = [];
      if (r > 0) neighbors.push(emptyIdx - 4);
      if (r < 3) neighbors.push(emptyIdx + 4);
      if (c > 0) neighbors.push(emptyIdx - 1);
      if (c < 3) neighbors.push(emptyIdx + 1);
      const filtered = neighbors.filter((n) => n !== prevIdx);
      const pick = filtered[Math.floor(Math.random() * filtered.length)];
      [arr[emptyIdx], arr[pick]] = [arr[pick], arr[emptyIdx]];
      prevIdx = emptyIdx;
      emptyIdx = pick;
    }
    return arr;
  }, []);

  const [tiles, setTiles] = useState<number[]>(createShuffled);
  const [moves, setMoves] = useState(0);

  const solved = tiles.every((v, i) => (i === 15 ? v === 0 : v === i + 1));

  const moveTile = (idx: number) => {
    if (solved) return;
    const emptyIdx = tiles.indexOf(0);
    const r1 = Math.floor(idx / 4);
    const c1 = idx % 4;
    const r2 = Math.floor(emptyIdx / 4);
    const c2 = emptyIdx % 4;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;

    const next = [...tiles];
    [next[idx], next[emptyIdx]] = [next[emptyIdx], next[idx]];
    setTiles(next);
    setMoves((m) => m + 1);
    if (next.every((v, i) => (i === 15 ? v === 0 : v === i + 1))) {
      soundSynth.playVictory();
    } else {
      soundSynth.playStep(moves % 8);
    }
  };

  return (
    <MiniGameShell
      title="Xếp Số Cổ Điển"
      subtitle="Nhấp vào ô kề khoảng trống để trượt và sắp xếp các số từ 1 đến 15 theo đúng thứ tự."
      onExit={onExit}
      onRestart={() => {
        setTiles(createShuffled());
        setMoves(0);
      }}
    >
      <div className="space-y-5 text-center">
        <div className="font-mono text-sm tabular-nums text-slate-300">
          Số lần trượt: <strong className="text-white">{moves}</strong>
        </div>

        <div className="grid grid-cols-4 gap-2.5 p-4 rounded-xl border border-slate-800 bg-[#0d1933]">
          {tiles.map((val, idx) =>
            val === 0 ? (
              <div
                key="empty"
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-lg bg-slate-950/70 border border-slate-800/70"
              />
            ) : (
              <button
                key={val}
                type="button"
                onClick={() => moveTile(idx)}
                className={`h-14 w-14 sm:h-16 sm:w-16 rounded-lg border font-display text-xl font-bold tabular-nums transition-colors ${
                  val === idx + 1
                    ? 'bg-amber-500/20 border-amber-400/70 text-amber-200'
                    : 'bg-slate-800 border-slate-600 text-white hover:border-cyan-400'
                }`}
              >
                {val}
              </button>
            )
          )}
        </div>

        {solved && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-5 py-3 text-sm text-emerald-300">
            Bạn đã xếp hoàn chỉnh bảng số trong{' '}
            <span className="font-mono font-bold">{moves}</span> lượt!
          </div>
        )}
      </div>
    </MiniGameShell>
  );
}

/* 3. MẬT MÃ THỊ GIÁC (Memory Pattern Grid) */
function MemoryPatternGame({ onExit }: { onExit: () => void }) {
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<'memorize' | 'recall' | 'won' | 'lost'>(
    'memorize'
  );
  const [target, setTarget] = useState<Set<number>>(() => new Set());
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);

  const gridSize = level >= 4 ? 5 : 4;
  const totalCells = gridSize * gridSize;
  const targetCount = Math.min(3 + level, totalCells - 2);

  const setupRound = useCallback((lvl: number) => {
    const size = lvl >= 4 ? 5 : 4;
    const total = size * size;
    const count = Math.min(3 + lvl, total - 2);
    const indices = Array.from({ length: total }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setTarget(new Set(indices.slice(0, count)));
    setPicked(new Set());
    setWrongIdx(null);
    setPhase('memorize');
  }, []);

  useEffect(() => {
    setupRound(level);
  }, [level, setupRound]);

  useEffect(() => {
    if (phase !== 'memorize') return;
    const id = window.setTimeout(() => setPhase('recall'), 1800);
    return () => window.clearTimeout(id);
  }, [phase]);

  const handleCellClick = (idx: number) => {
    if (phase !== 'recall' || picked.has(idx)) return;
    if (target.has(idx)) {
      const next = new Set(picked);
      next.add(idx);
      setPicked(next);
      soundSynth.playStep(next.size);
      if (next.size === target.size) {
        soundSynth.playVictory();
        setPhase('won');
      }
    } else {
      soundSynth.playBlocked();
      setWrongIdx(idx);
      setPhase('lost');
    }
  };

  return (
    <MiniGameShell
      title="Mật Mã Thị Giác"
      subtitle="Ghi nhớ các ô phát sáng trong 1.8 giây rồi chọn lại đúng toàn bộ vị trí đó."
      onExit={onExit}
      onRestart={() => {
        setLevel(1);
        setupRound(1);
      }}
    >
      <div className="space-y-5 text-center">
        <div className="flex items-center justify-center gap-6 font-mono text-sm tabular-nums text-slate-300">
          <span>
            Cấp độ: <strong className="text-emerald-300">{level}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Cần nhớ: <strong className="text-white">{targetCount} ô</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {phase === 'memorize'
              ? 'Đang ghi nhớ...'
              : phase === 'recall'
              ? `Đã chọn ${picked.size}/${target.size}`
              : phase === 'won'
              ? 'Chính xác!'
              : 'Sai vị trí!'}
          </span>
        </div>

        <div
          className="grid gap-2.5 p-4 rounded-xl border border-slate-800 bg-[#0d1933]"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: totalCells }, (_, idx) => {
            const isLit =
              (phase === 'memorize' && target.has(idx)) ||
              picked.has(idx) ||
              (phase === 'lost' && target.has(idx));
            const isWrong = wrongIdx === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleCellClick(idx)}
                className={`h-12 w-12 sm:h-14 sm:w-14 rounded-lg border transition-colors ${
                  isWrong
                    ? 'bg-red-500 border-red-300'
                    : isLit
                    ? 'bg-emerald-400 border-emerald-200'
                    : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                }`}
              />
            );
          })}
        </div>

        {phase === 'won' && (
          <button
            type="button"
            onClick={() => setLevel((l) => l + 1)}
            className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Qua cấp {level + 1}
          </button>
        )}
        {phase === 'lost' && (
          <button
            type="button"
            onClick={() => setupRound(level)}
            className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Thử lại cấp {level}
          </button>
        )}
      </div>
    </MiniGameShell>
  );
}

/* 4. GIẢI MÃ BỐN SỐ (4-Digit Deduction) */
function CodeBreakerGame({ onExit }: { onExit: () => void }) {
  const genSecret = useCallback(() => {
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    return digits.slice(0, 4).join('');
  }, []);

  const [secret, setSecret] = useState(genSecret);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ guess: string; exact: number; misplaced: number }>
  >([]);

  const won = history.some((h) => h.exact === 4);
  const lost = !won && history.length >= 10;

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (won || lost) return;
    if (!/^\d{4}$/.test(input)) {
      setError('Vui lòng nhập đúng 4 chữ số.');
      return;
    }
    if (new Set(input.split('')).size !== 4) {
      setError('4 chữ số phải khác nhau hoàn toàn.');
      return;
    }
    setError(null);
    let exact = 0;
    let misplaced = 0;
    for (let i = 0; i < 4; i++) {
      if (input[i] === secret[i]) exact += 1;
      else if (secret.includes(input[i])) misplaced += 1;
    }
    if (exact === 4) soundSynth.playVictory();
    else soundSynth.playStep(exact + 1);

    setHistory((prev) => [{ guess: input, exact, misplaced }, ...prev]);
    setInput('');
  };

  return (
    <MiniGameShell
      title="Giải Mã Bốn Số"
      subtitle="Đoán mật mã gồm 4 chữ số khác nhau trong tối đa 10 lượt thử."
      onExit={onExit}
      onRestart={() => {
        setSecret(genSecret());
        setHistory([]);
        setInput('');
        setError(null);
      }}
    >
      <div className="w-full max-w-md space-y-5">
        <form onSubmit={submitGuess} className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={input}
            disabled={won || lost}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))}
            placeholder="Nhập 4 số (vd: 4821)"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 font-mono text-base tracking-widest text-white placeholder:text-slate-500 placeholder:tracking-normal focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={won || lost}
            className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40 whitespace-nowrap"
          >
            Kiểm tra
          </button>
        </form>

        {error && <p className="text-xs text-amber-300">{error}</p>}

        {won && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 p-3.5 text-sm text-emerald-300">
            Phá khóa thành công mật mã <strong className="font-mono">{secret}</strong> sau{' '}
            <strong className="font-mono">{history.length}</strong> lượt!
          </div>
        )}
        {lost && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/50 p-3.5 text-sm text-red-300">
            Hết lượt! Mật mã chính xác là{' '}
            <strong className="font-mono">{secret}</strong>.
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-[#0d1933] divide-y divide-slate-800 max-h-72 overflow-y-auto">
          {history.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">
              Còn 10 lượt thử. Hãy nhập dãy 4 chữ số khác nhau đầu tiên.
            </p>
          ) : (
            history.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-2.5 text-sm font-mono tabular-nums"
              >
                <span className="text-white font-bold tracking-widest">
                  {item.guess}
                </span>
                <span className="text-xs text-slate-300">
                  <span className="text-emerald-400">{item.exact} đúng chỗ</span>
                  {' · '}
                  <span className="text-amber-300">
                    {item.misplaced} sai chỗ
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </MiniGameShell>
  );
}

/* 5. DÒ MÌN CHIẾN THUẬT (9x9 Minesweeper) */
function MinesweeperGame({ onExit }: { onExit: () => void }) {
  const ROWS = 9;
  const COLS = 9;
  const MINES = 10;

  interface Cell {
    mine: boolean;
    revealed: boolean;
    flagged: boolean;
    adj: number;
  }

  const createEmpty = (): Cell[][] =>
    Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({
        mine: false,
        revealed: false,
        flagged: false,
        adj: 0,
      }))
    );

  const [board, setBoard] = useState<Cell[][]>(createEmpty);
  const [initialized, setInitialized] = useState(false);
  const [flagMode, setFlagMode] = useState(false);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');

  const plantMines = (safeR: number, safeC: number): Cell[][] => {
    const next = createEmpty();
    let placed = 0;
    while (placed < MINES) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (
        !next[r][c].mine &&
        !(Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1)
      ) {
        next[r][c].mine = true;
        placed += 1;
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (next[r][c].mine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && next[nr][nc].mine) {
              count += 1;
            }
          }
        }
        next[r][c].adj = count;
      }
    }
    return next;
  };

  const revealFlood = (grid: Cell[][], sr: number, sc: number) => {
    const stack = [[sr, sc]];
    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      const cell = grid[r][c];
      if (cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      if (cell.adj === 0 && !cell.mine) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
              if (!grid[nr][nc].revealed) stack.push([nr, nc]);
            }
          }
        }
      }
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (status !== 'playing') return;
    if (flagMode) {
      toggleFlag(r, c);
      return;
    }

    let working = board.map((row) => row.map((cell) => ({ ...cell })));
    if (!initialized) {
      working = plantMines(r, c);
      setInitialized(true);
    }

    if (working[r][c].flagged || working[r][c].revealed) return;

    if (working[r][c].mine) {
      for (const row of working) {
        for (const cell of row) {
          if (cell.mine) cell.revealed = true;
        }
      }
      soundSynth.playBlocked();
      setBoard(working);
      setStatus('lost');
      return;
    }

    revealFlood(working, r, c);
    const safeRemaining = working
      .flat()
      .filter((cell) => !cell.mine && !cell.revealed).length;

    if (safeRemaining === 0) {
      soundSynth.playVictory();
      setStatus('won');
    } else {
      soundSynth.playStep(1);
    }
    setBoard(working);
  };

  const toggleFlag = (r: number, c: number) => {
    if (status !== 'playing' || board[r][c].revealed) return;
    setBoard((prev) => {
      const next = prev.map((row) => row.map((cell) => ({ ...cell })));
      next[r][c].flagged = !next[r][c].flagged;
      return next;
    });
  };

  const flaggedCount = board.flat().filter((c) => c.flagged).length;

  return (
    <MiniGameShell
      title="Dò Mìn Chiến Thuật"
      subtitle="Mở toàn bộ ô an toàn. Chuột phải hoặc bật chế độ Cắm cờ để đánh dấu vị trí mìn."
      onExit={onExit}
      onRestart={() => {
        setBoard(createEmpty());
        setInitialized(false);
        setStatus('playing');
      }}
    >
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-4 text-sm font-mono tabular-nums text-slate-300">
          <span>
            Cờ: <strong className="text-red-300">{flaggedCount}/{MINES}</strong>
          </span>
          <button
            type="button"
            onClick={() => setFlagMode((f) => !f)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-sans font-medium transition-colors ${
              flagMode
                ? 'bg-red-500/20 border-red-400 text-red-200'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <Flag className="h-3.5 w-3.5" />
            <span>{flagMode ? 'Đang cắm cờ' : 'Chế độ cắm cờ'}</span>
          </button>
        </div>

        <div className="grid grid-cols-9 gap-1.5 p-3 rounded-xl border border-slate-800 bg-[#0d1933]">
          {board.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleFlag(r, c);
                }}
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-md border font-mono text-sm font-bold flex items-center justify-center transition-colors ${
                  cell.revealed
                    ? cell.mine
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-slate-950/70 border-slate-800 text-cyan-300'
                    : cell.flagged
                    ? 'bg-slate-800 border-red-400/70 text-red-400'
                    : 'bg-slate-800 border-slate-600 hover:border-cyan-400'
                }`}
              >
                {cell.revealed
                  ? cell.mine
                    ? '✕'
                    : cell.adj > 0
                    ? cell.adj
                    : ''
                  : cell.flagged
                  ? '⚑'
                  : ''}
              </button>
            ))
          )}
        </div>

        {status === 'won' && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-5 py-3 text-sm text-emerald-300">
            Xuất sắc! Bạn đã gỡ sạch toàn bộ bãi mìn.
          </div>
        )}
        {status === 'lost' && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-5 py-3 text-sm text-red-300">
            Đã chạm phải mìn! Nhấn Chơi lại để bắt đầu ván mới.
          </div>
        )}
      </div>
    </MiniGameShell>
  );
}

export function MiniGameHost({
  gameId,
  onExit,
}: {
  gameId: Exclude<
    GameId,
    | 'menh-lenh-tuyet-doi'
    | 'hanh-trinh-vo-dinh'
    | 'kakuro-xoay-chuyen'
    | 'so-lien-tranh-ba'
  >;
  onExit: () => void;
}) {
  switch (gameId) {
    case 'ma-tran-anh-sang':
      return <LightsOutGame onExit={onExit} />;
    case 'xep-so-co-dien':
      return <FifteenPuzzleGame onExit={onExit} />;
    case 'mat-ma-thi-giac':
      return <MemoryPatternGame onExit={onExit} />;
    case 'giai-ma-bon-so':
      return <CodeBreakerGame onExit={onExit} />;
    case 'do-min-chien-thuat':
      return <MinesweeperGame onExit={onExit} />;
  }
}
