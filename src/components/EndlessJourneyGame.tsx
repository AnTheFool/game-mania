import {
  ArrowLeft,
  CheckCircle2,
  Eraser,
  HelpCircle,
  Lock,
  Maximize2,
  Play,
  RefreshCw,
  ShieldAlert,
  Undo2,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundSynth } from '../game/sound';
import { VoronoiMapData, generateVoronoiMap } from '../game/voronoi';

type GameColorKey = 'RED' | 'GREEN' | 'BLUE' | 'YELLOW';
type ToolMode = GameColorKey | 'ERASER';
type Phase = 'START' | 'COUNTDOWN' | 'PLAYING' | 'VICTORY';

interface ColorMeta {
  key: GameColorKey;
  label: string;
  shortLabel: string;
  fill: string;
  textOnFill: string;
  ring: string;
}

const COLOR_META: Record<GameColorKey, ColorMeta> = {
  RED: {
    key: 'RED',
    label: 'Đỏ',
    shortLabel: 'ĐỎ',
    fill: '#dc3232',
    textOnFill: '#ffffff',
    ring: '#fca5a5',
  },
  GREEN: {
    key: 'GREEN',
    label: 'Xanh lá',
    shortLabel: 'X.LÁ',
    fill: '#28c74a',
    textOnFill: '#052e16',
    ring: '#86efac',
  },
  BLUE: {
    key: 'BLUE',
    label: 'Xanh dương',
    shortLabel: 'X.DƯƠNG',
    fill: '#3256dc',
    textOnFill: '#ffffff',
    ring: '#93c5fd',
  },
  YELLOW: {
    key: 'YELLOW',
    label: 'Vàng',
    shortLabel: 'VÀNG',
    fill: '#e2cf24',
    textOnFill: '#1e1b04',
    ring: '#fef08a',
  },
};

const ALL_COLORS: GameColorKey[] = ['RED', 'GREEN', 'BLUE', 'YELLOW'];
const EMPTY_CELL_FILL = '#4b5563';
const MAX_CHECKS = 2;
const ERROR_BLINK_DURATION_MS = 20_000;
const BLINK_INTERVAL_MS = 500;

interface UndoEntry {
  cellId: number;
  prevColor: GameColorKey | null;
}

interface EndlessJourneyGameProps {
  onExitToPortal: () => void;
}

function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(
    s
  ).padStart(2, '0')}`;
}

export function EndlessJourneyGame({
  onExitToPortal,
}: EndlessJourneyGameProps) {
  const [phase, setPhase] = useState<Phase>('START');
  const [cellPreset, setCellPreset] = useState<100 | 200 | 250>(200);
  const [mapData, setMapData] = useState<VoronoiMapData | null>(null);
  const [cellColors, setCellColors] = useState<Map<number, GameColorKey | null>>(
    () => new Map()
  );
  const [lockedCellId, setLockedCellId] = useState<number | null>(null);
  const [targetColor, setTargetColor] = useState<GameColorKey>('YELLOW');
  const [otherColors, setOtherColors] = useState<GameColorKey[]>([
    'RED',
    'GREEN',
    'BLUE',
  ]);
  const [selectedTool, setSelectedTool] = useState<ToolMode>('RED');
  const [checksRemaining, setChecksRemaining] = useState(MAX_CHECKS);
  const [countdown, setCountdown] = useState(3);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [muted, setMuted] = useState(() => soundSynth.isMuted());
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Error / feedback states
  const [errorCellIds, setErrorCellIds] = useState<Set<number>>(
    () => new Set()
  );
  const [blinkVisible, setBlinkVisible] = useState(true);
  const [errorBlinkEndsAt, setErrorBlinkEndsAt] = useState<number | null>(null);
  const [flashUncolored, setFlashUncolored] = useState(false);
  const [banner, setBanner] = useState<{
    tone: 'info' | 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const [hoveredCellId, setHoveredCellId] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  // Viewport zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    moved: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const bannerTimerRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoom((z) => Math.min(4, Math.max(0.85, +(z + delta).toFixed(2))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [phase]);

  const showBanner = useCallback(
    (tone: 'info' | 'success' | 'warning' | 'error', text: string, ms = 4000) => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
      setBanner({ tone, text });
      bannerTimerRef.current = window.setTimeout(() => {
        setBanner(null);
        bannerTimerRef.current = null;
      }, ms);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const resetViewport = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const startNewGame = useCallback(
    (numCells = cellPreset) => {
      const seed = Math.floor(Math.random() * 100000) + 1;
      const generated = generateVoronoiMap(numCells, seed);

      const chosenTarget =
        ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)];
      const others = ALL_COLORS.filter((c) => c !== chosenTarget);

      const initialColors = new Map<number, GameColorKey | null>();
      for (const cell of generated.cells) {
        initialColors.set(cell.id, null);
      }

      let lockedId: number | null = null;
      if (generated.cells.length > 0) {
        const randomCell =
          generated.cells[Math.floor(Math.random() * generated.cells.length)];
        const initialFill = others[Math.floor(Math.random() * others.length)];
        initialColors.set(randomCell.id, initialFill);
        lockedId = randomCell.id;
      }

      setMapData(generated);
      setCellColors(initialColors);
      setLockedCellId(lockedId);
      setTargetColor(chosenTarget);
      setOtherColors(others);
      setSelectedTool(others[0]);
      setChecksRemaining(MAX_CHECKS);
      setErrorCellIds(new Set());
      setErrorBlinkEndsAt(null);
      setBlinkVisible(true);
      setFlashUncolored(false);
      setBanner(null);
      setUndoStack([]);
      setElapsedSeconds(0);
      setCountdown(3);
      setShowRulesModal(false);
      resetViewport();
      setPhase('COUNTDOWN');
      soundSynth.playStep(1);
    },
    [cellPreset, resetViewport]
  );

  // Countdown timer
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    if (countdown <= 0) {
      setPhase('PLAYING');
      soundSynth.playStep(5);
      return;
    }
    const id = window.setTimeout(() => {
      setCountdown((c) => c - 1);
      if (countdown > 1) soundSynth.playStep(2);
    }, 850);
    return () => window.clearTimeout(id);
  }, [countdown, phase]);

  // Game elapsed timer
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    const id = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Error blink loop (20 seconds, 0.5s interval)
  useEffect(() => {
    if (!errorBlinkEndsAt) return;
    const intervalId = window.setInterval(() => {
      if (Date.now() >= errorBlinkEndsAt) {
        setErrorCellIds(new Set());
        setErrorBlinkEndsAt(null);
        setBlinkVisible(true);
        return;
      }
      setBlinkVisible((v) => !v);
    }, BLINK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [errorBlinkEndsAt]);

  // Find adjacent color conflicts
  const findConflicts = useCallback(
    (colorsMap: Map<number, GameColorKey | null>): Set<number> => {
      const conflicts = new Set<number>();
      if (!mapData) return conflicts;

      for (const cell of mapData.cells) {
        const myColor = colorsMap.get(cell.id);
        if (!myColor) continue;
        for (const nid of cell.neighbors) {
          if (colorsMap.get(nid) === myColor) {
            conflicts.add(cell.id);
            conflicts.add(nid);
          }
        }
      }
      return conflicts;
    },
    [mapData]
  );

  const handlePaintCell = useCallback(
    (cellId: number, forceClear = false) => {
      if (phase !== 'PLAYING') return;
      if (cellId === lockedCellId) {
        soundSynth.playBlocked();
        showBanner('warning', 'Ô này đã được khóa cố định ngay từ đầu.', 2200);
        return;
      }

      setCellColors((prev) => {
        const current = prev.get(cellId) ?? null;
        let nextColor: GameColorKey | null;

        if (forceClear || selectedTool === 'ERASER') {
          nextColor = null;
        } else if (current === selectedTool) {
          // Clicking with the same selected color toggles it off (matches Python game)
          nextColor = null;
        } else {
          nextColor = selectedTool;
        }

        if (current === nextColor) return prev;

        const nextMap = new Map(prev);
        nextMap.set(cellId, nextColor);
        setUndoStack((stack) => [...stack.slice(-99), { cellId, prevColor: current }]);

        if (nextColor === null) {
          soundSynth.playUndo();
        } else {
          soundSynth.playStep(ALL_COLORS.indexOf(nextColor) + 1);
        }

        // If error highlight is currently active, keep only remaining actual conflicts
        if (errorBlinkEndsAt && mapData) {
          const remaining = findConflicts(nextMap);
          setErrorCellIds(remaining);
          if (remaining.size === 0) {
            setErrorBlinkEndsAt(null);
          }
        }

        return nextMap;
      });
    },
    [
      errorBlinkEndsAt,
      findConflicts,
      lockedCellId,
      mapData,
      phase,
      selectedTool,
      showBanner,
    ]
  );

  const handleUndo = useCallback(() => {
    if (phase !== 'PLAYING' || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setCellColors((prev) => {
      const next = new Map(prev);
      next.set(last.cellId, last.prevColor);
      if (errorBlinkEndsAt) {
        const remaining = findConflicts(next);
        setErrorCellIds(remaining);
        if (remaining.size === 0) setErrorBlinkEndsAt(null);
      }
      return next;
    });
    soundSynth.playUndo();
  }, [errorBlinkEndsAt, findConflicts, phase, undoStack]);

  const handleCheck = useCallback(() => {
    if (phase !== 'PLAYING' || checksRemaining <= 0) return;

    setChecksRemaining((c) => c - 1);
    const conflicts = findConflicts(cellColors);

    if (conflicts.size > 0) {
      soundSynth.playBlocked();
      setErrorCellIds(conflicts);
      setBlinkVisible(true);
      setErrorBlinkEndsAt(Date.now() + ERROR_BLINK_DURATION_MS);
      showBanner(
        'error',
        `Phát hiện ${conflicts.size} vùng kề nhau đang trùng màu! Các vùng lỗi sẽ nhấp nháy vàng trong 20 giây.`,
        5500
      );
    } else {
      soundSynth.playStep(6);
      setErrorCellIds(new Set());
      setErrorBlinkEndsAt(null);
      showBanner(
        'success',
        'Kiểm tra hợp lệ: Hiện chưa có 2 vùng kề nhau nào trùng màu!',
        3500
      );
    }
  }, [cellColors, checksRemaining, findConflicts, phase, showBanner]);

  const handleSubmit = useCallback(() => {
    if (phase !== 'PLAYING' || !mapData) return;

    let uncoloredCount = 0;
    for (const cell of mapData.cells) {
      if (!cellColors.get(cell.id)) uncoloredCount++;
    }

    if (uncoloredCount > 0) {
      soundSynth.playBlocked();
      setFlashUncolored(true);
      window.setTimeout(() => setFlashUncolored(false), 1800);
      showBanner(
        'warning',
        `Còn ${uncoloredCount} vùng chưa được tô màu. Hãy tô kín toàn bộ bản đồ trước khi nộp bài.`,
        4000
      );
      return;
    }

    const conflicts = findConflicts(cellColors);
    if (conflicts.size > 0) {
      soundSynth.playBlocked();
      setErrorCellIds(conflicts);
      setBlinkVisible(true);
      setErrorBlinkEndsAt(Date.now() + 5000);
      showBanner(
        'error',
        `Vẫn còn ${conflicts.size} vùng kề nhau bị trùng màu! Hãy sửa các vùng nhấp nháy trước khi nộp.`,
        4500
      );
      return;
    }

    soundSynth.playVictory();
    setPhase('VICTORY');
  }, [cellColors, findConflicts, mapData, phase, showBanner]);

  // Derived statistics
  const stats = useMemo(() => {
    const counts: Record<GameColorKey, number> = {
      RED: 0,
      GREEN: 0,
      BLUE: 0,
      YELLOW: 0,
    };
    let colored = 0;
    const total = mapData?.cells.length ?? 0;

    if (mapData) {
      for (const cell of mapData.cells) {
        const c = cellColors.get(cell.id);
        if (c) {
          counts[c]++;
          colored++;
        }
      }
    }

    const targetUsed = counts[targetColor];
    return {
      total,
      colored,
      uncolored: total - colored,
      counts,
      targetUsed,
      score: targetUsed * 1000,
    };
  }, [cellColors, mapData, targetColor]);

  // Keyboard shortcuts
  const orderedPalette = useMemo(
    () => [...otherColors, targetColor],
    [otherColors, targetColor]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showRulesModal) {
        if (e.key === 'Escape') setShowRulesModal(false);
        return;
      }
      if (phase === 'START' && e.key === 'Enter') {
        e.preventDefault();
        startNewGame();
        return;
      }
      if (phase !== 'PLAYING') return;

      if (e.key === '1' && orderedPalette[0]) {
        setSelectedTool(orderedPalette[0]);
      } else if (e.key === '2' && orderedPalette[1]) {
        setSelectedTool(orderedPalette[1]);
      } else if (e.key === '3' && orderedPalette[2]) {
        setSelectedTool(orderedPalette[2]);
      } else if (e.key === '4' && orderedPalette[3]) {
        setSelectedTool(orderedPalette[3]);
      } else if (e.key === 'e' || e.key === 'E' || e.key === '0') {
        setSelectedTool('ERASER');
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'c' || e.key === 'C') {
        handleCheck();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleCheck,
    handleSubmit,
    handleUndo,
    orderedPalette,
    phase,
    showRulesModal,
    startNewGame,
  ]);

  const toggleMute = () => {
    const next = !muted;
    soundSynth.setMuted(next);
    setMuted(next);
  };

  return (
    <div className="h-screen w-screen bg-[#060d1f] text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Top Bar: 3-Zone Contract */}
      <header className="relative z-20 flex items-center justify-between gap-6 border-b border-slate-800/90 bg-[#071024] px-4 sm:px-6 py-3">
        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-white hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 uppercase"
        >
          Hành Trình Vô Định
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
            onClick={() => startNewGame()}
            className="inline-flex items-center gap-1.5 hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Ván mới</span>
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
          {phase === 'PLAYING' ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2eff14] px-4 py-2 text-xs sm:text-sm font-bold text-slate-950 hover:bg-[#5cff47] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Nộp bài</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startNewGame()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2eff14] px-4 py-2 text-xs sm:text-sm font-bold text-slate-950 hover:bg-[#5cff47] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Bắt đầu</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      {phase === 'START' && (
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl border border-slate-700/75 bg-[#0b1730] p-6 sm:p-10 shadow-2xl space-y-7">
            <div className="space-y-2 text-center">
              <p className="text-xs font-mono text-cyan-300">
                Bản đồ Voronoi · Định lý 4 màu · Tối ưu màu mục tiêu
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-wide text-white text-balance">
                Hành Trình Vô Định
              </h1>
              <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
                Tô màu toàn bộ bản đồ đa giác sao cho không có hai vùng kề nhau nào trùng màu, đồng thời hạn chế tối đa số lần sử dụng màu mục tiêu.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-200 border-y border-slate-800 py-5">
              <div className="space-y-1.5">
                <h2 className="font-display text-sm font-semibold text-cyan-300">
                  Quy tắc tô màu
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  Chọn 1 trong 4 màu (Đỏ, Xanh lá, Xanh dương, Vàng) rồi nhấp vào từng vùng. Nhấp lại cùng màu hoặc chuột phải để xóa màu.
                </p>
              </div>
              <div className="space-y-1.5">
                <h2 className="font-display text-sm font-semibold text-cyan-300">
                  Kiểm tra & Điểm số
                </h2>
                <p className="text-slate-300 leading-relaxed">
                  Bạn có <strong className="text-white">2 lượt kiểm tra</strong> để phát hiện các cặp vùng trùng màu. Điểm = Số ô màu mục tiêu × 1.000 (càng ít càng tốt).
                </p>
              </div>
            </div>

            {/* Map density selector */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-xs font-medium text-slate-400">
                  Quy mô bản đồ Voronoi
                </p>
                <div className="inline-flex items-center gap-1 rounded-lg bg-[#060d1f] p-1 border border-slate-800">
                  {([100, 200, 250] as const).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setCellPreset(count)}
                      className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                        cellPreset === count
                          ? 'bg-cyan-400 text-slate-950 font-semibold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {count} vùng
                      {count === 200 ? ' (Chuẩn)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => startNewGame(cellPreset)}
                className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#2eff14] hover:bg-[#5cff47] text-slate-950 font-display text-base sm:text-lg font-bold tracking-wider uppercase px-10 py-3.5 shadow-lg transition-transform active:scale-[0.98] whitespace-nowrap min-h-[48px]"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>Bắt đầu chơi</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {phase === 'COUNTDOWN' && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <p className="text-sm text-slate-300">
            Đang khởi tạo bản đồ {cellPreset} vùng... Chuẩn bị bắt đầu
          </p>
          <div className="font-display text-7xl sm:text-8xl font-bold text-[#2eff14] tabular-nums">
            {Math.max(1, countdown)}
          </div>
          <p className="text-xs text-slate-400">
            Màu mục tiêu cần hạn chế:{' '}
            <strong
              className="px-2 py-0.5 rounded font-semibold"
              style={{
                backgroundColor: COLOR_META[targetColor].fill,
                color: COLOR_META[targetColor].textOnFill,
              }}
            >
              {COLOR_META[targetColor].label}
            </strong>
          </p>
        </main>
      )}

      {(phase === 'PLAYING' || phase === 'VICTORY') && mapData && (
        <main className="flex-1 flex flex-col min-h-0">
          {/* Telemetry & Utility Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 bg-[#08132a] px-4 sm:px-6 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm font-mono tabular-nums text-slate-200">
              <span>
                <span className="text-slate-400">Thời gian: </span>
                <strong className="text-white">
                  {formatDuration(elapsedSeconds)}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <span className="text-slate-400">Đã tô: </span>
                <strong
                  className={
                    stats.uncolored === 0 ? 'text-emerald-400' : 'text-cyan-300'
                  }
                >
                  {stats.colored}/{stats.total}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <span className="text-slate-400">Màu mục tiêu ({COLOR_META[targetColor].label}): </span>
                <strong className="text-amber-300">{stats.targetUsed} ô</strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <span className="text-slate-400">Kiểm tra còn lại: </span>
                <strong
                  className={
                    checksRemaining > 0 ? 'text-emerald-300' : 'text-slate-400'
                  }
                >
                  {checksRemaining}/{MAX_CHECKS}
                </strong>
              </span>
            </div>

            {/* Zoom & Quick Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={phase !== 'PLAYING' || undoStack.length === 0}
                title="Hoàn tác (Z)"
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hoàn tác (Z)</span>
              </button>
              <button
                type="button"
                onClick={handleCheck}
                disabled={phase !== 'PLAYING' || checksRemaining <= 0}
                className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/50 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40 whitespace-nowrap"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Kiểm tra ({checksRemaining})</span>
              </button>

              <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.85, +(z - 0.25).toFixed(2)))}
                aria-label="Thu nhỏ bản đồ"
                className="rounded-md border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono text-xs tabular-nums text-slate-300 w-11 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                aria-label="Phóng to bản đồ"
                className="rounded-md border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={resetViewport}
                aria-label="Đặt lại góc nhìn"
                title="Đặt lại góc nhìn"
                className="rounded-md border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Map Canvas Area */}
          <div
            ref={viewportRef}
            className="relative flex-1 min-h-0 bg-[#1a1f2e] overflow-hidden flex items-center justify-center p-2 sm:p-4"
            onPointerDown={(e) => {
              if (e.button !== 0 && e.button !== 1) return;
              dragRef.current = {
                active: true,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                originPanX: pan.x,
                originPanY: pan.y,
                moved: false,
              };
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d || !d.active || d.pointerId !== e.pointerId) return;
              const dx = e.clientX - d.startX;
              const dy = e.clientY - d.startY;
              if (!d.moved && Math.hypot(dx, dy) > 6) {
                d.moved = true;
              }
              if (d.moved) {
                setPan({ x: d.originPanX + dx, y: d.originPanY + dy });
              }
            }}
            onPointerUp={(e) => {
              const d = dragRef.current;
              if (d && d.pointerId === e.pointerId) {
                if (d.moved) {
                  suppressNextClickRef.current = true;
                  window.setTimeout(() => {
                    suppressNextClickRef.current = false;
                  }, 40);
                }
                dragRef.current = null;
              }
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            {/* Status Banner */}
            {banner && (
              <div
                className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 rounded-lg border px-4 py-2 text-xs sm:text-sm font-medium shadow-xl max-w-xl text-center ${
                  banner.tone === 'error'
                    ? 'border-red-400/70 bg-red-950/95 text-red-100'
                    : banner.tone === 'warning'
                    ? 'border-amber-400/70 bg-amber-950/95 text-amber-100'
                    : banner.tone === 'success'
                    ? 'border-emerald-400/70 bg-emerald-950/95 text-emerald-100'
                    : 'border-cyan-400/70 bg-slate-900/95 text-cyan-100'
                }`}
              >
                {banner.text}
              </div>
            )}

            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            >
              <svg
                viewBox={mapData.viewBox}
                className="w-full h-full max-w-[1260px] max-h-[720px] drop-shadow-2xl"
                onContextMenu={(e) => e.preventDefault()}
              >
                {/* Map cells */}
                {mapData.cells.map((cell) => {
                  const colorKey = cellColors.get(cell.id) ?? null;
                  const isLocked = cell.id === lockedCellId;
                  const isError = errorCellIds.has(cell.id);
                  const isHovered = hoveredCellId === cell.id;
                  const uncoloredFlash = flashUncolored && colorKey === null;

                  const fill = colorKey
                    ? COLOR_META[colorKey].fill
                    : uncoloredFlash
                    ? '#64748b'
                    : EMPTY_CELL_FILL;

                  let stroke = '#0f172a';
                  let strokeWidth = 2.2;

                  if (isError && blinkVisible) {
                    stroke = '#fde047';
                    strokeWidth = 6.5;
                  } else if (isLocked) {
                    stroke = '#ffffff';
                    strokeWidth = 5.5;
                  } else if (uncoloredFlash) {
                    stroke = '#38bdf8';
                    strokeWidth = 4;
                  } else if (isHovered) {
                    stroke = '#ffffff';
                    strokeWidth = 4;
                  }

                  return (
                    <g key={cell.id}>
                      <path
                        d={cell.pathD}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeLinejoin="round"
                        className="cursor-pointer transition-opacity duration-100"
                        opacity={isHovered && !isLocked ? 0.92 : 1}
                        onMouseEnter={() => setHoveredCellId(cell.id)}
                        onMouseLeave={() =>
                          setHoveredCellId((cur) =>
                            cur === cell.id ? null : cur
                          )
                        }
                        onClick={() => {
                          if (suppressNextClickRef.current) return;
                          handlePaintCell(cell.id, false);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handlePaintCell(cell.id, true);
                        }}
                      />
                    </g>
                  );
                })}

                {/* Outer jagged boundary border (drawn over cell edges like Python game) */}
                <path
                  d={mapData.boundaryPathD}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={3.5}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />

                {/* Locked cell indicator glyph */}
                {lockedCellId !== null &&
                  (() => {
                    const lockedCell = mapData.cells.find(
                      (c) => c.id === lockedCellId
                    );
                    if (!lockedCell) return null;
                    return (
                      <g
                        transform={`translate(${lockedCell.centroid.x}, ${lockedCell.centroid.y})`}
                        pointerEvents="none"
                      >
                        <circle
                          r={16}
                          fill="rgba(15, 23, 42, 0.78)"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                        <Lock
                          x={-9}
                          y={-9}
                          width={18}
                          height={18}
                          color="#ffffff"
                          strokeWidth={2.3}
                        />
                      </g>
                    );
                  })()}
              </svg>
            </div>
          </div>

          {/* Bottom Color Palette Dock */}
          <footer className="border-t border-slate-800 bg-[#071024] px-4 sm:px-6 py-3">
            <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
              {/* Left: 3 standard colors + Eraser */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <span className="text-xs font-medium text-slate-400 hidden sm:inline mr-1">
                  Màu tự do:
                </span>
                {otherColors.map((colorKey, idx) => {
                  const meta = COLOR_META[colorKey];
                  const active = selectedTool === colorKey;
                  return (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setSelectedTool(colorKey)}
                      className={`relative flex items-center gap-2.5 rounded-lg px-3.5 py-2 min-h-[46px] font-display text-xs sm:text-sm font-bold tracking-wide transition-all whitespace-nowrap ${
                        active
                          ? 'ring-3 ring-white scale-[1.03] shadow-lg'
                          : 'opacity-90 hover:opacity-100 border border-white/25'
                      }`}
                      style={{
                        backgroundColor: meta.fill,
                        color: meta.textOnFill,
                      }}
                    >
                      <span>{meta.label}</span>
                      <span className="font-mono text-[11px] opacity-80">
                        [{idx + 1}]
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setSelectedTool('ERASER')}
                  className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 min-h-[46px] text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    selectedTool === 'ERASER'
                      ? 'border-white bg-slate-700 text-white ring-2 ring-white'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Eraser className="h-4 w-4" />
                  <span>Tẩy [E]</span>
                </button>
              </div>

              {/* Right: Separated Target Color */}
              <div className="flex items-center gap-3 sm:pl-6 sm:border-l sm:border-slate-800">
                <div className="text-right">
                  <p className="text-[11px] font-medium text-amber-300">
                    Màu mục tiêu (hạn chế)
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-400">
                    Đã dùng: {stats.targetUsed} ô
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTool(targetColor)}
                  className={`flex items-center gap-2.5 rounded-lg px-4 py-2 min-h-[46px] font-display text-xs sm:text-sm font-bold tracking-wide transition-all whitespace-nowrap ${
                    selectedTool === targetColor
                      ? 'ring-3 ring-white scale-[1.03] shadow-lg'
                      : 'opacity-90 hover:opacity-100 border border-white/30'
                  }`}
                  style={{
                    backgroundColor: COLOR_META[targetColor].fill,
                    color: COLOR_META[targetColor].textOnFill,
                  }}
                >
                  <span>{COLOR_META[targetColor].label}</span>
                  <span className="font-mono text-[11px] opacity-80">[4]</span>
                </button>
              </div>
            </div>
          </footer>
        </main>
      )}

      {/* Victory Overlay */}
      {phase === 'VICTORY' && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#040916]/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="victory-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-emerald-400/50 bg-[#0b1730] p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="space-y-1.5">
              <p className="text-xs font-mono text-emerald-300">
                Hoàn thành bản đồ {stats.total} vùng không trùng màu
              </p>
              <h2
                id="victory-title"
                className="font-display text-3xl font-bold uppercase text-emerald-400"
              >
                CHIẾN THẮNG!
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-3 border-y border-slate-800 py-4 font-mono tabular-nums">
              <div>
                <p className="text-[11px] font-sans text-slate-400">
                  Màu mục tiêu
                </p>
                <p className="mt-1 text-xl font-bold text-amber-300">
                  {stats.targetUsed} ô
                </p>
              </div>
              <div>
                <p className="text-[11px] font-sans text-slate-400">
                  Điểm số
                </p>
                <p className="mt-1 text-xl font-bold text-white">
                  {stats.score.toLocaleString('vi-VN')}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-sans text-slate-400">
                  Thời gian
                </p>
                <p className="mt-1 text-xl font-bold text-cyan-300">
                  {formatDuration(elapsedSeconds)}
                </p>
              </div>
            </div>

            {/* Color distribution breakdown */}
            <div className="space-y-2 text-left">
              <p className="text-xs font-medium text-slate-400">
                Thống kê số vùng theo từng màu (mục tiêu: dùng ít{' '}
                <span className="text-amber-300">
                  {COLOR_META[targetColor].label}
                </span>{' '}
                nhất)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono tabular-nums">
                {ALL_COLORS.map((ck) => (
                  <div
                    key={ck}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#071024] px-3 py-2"
                  >
                    <span className="flex items-center gap-2 font-sans text-slate-200">
                      <span
                        className="h-3 w-3 rounded-xs shrink-0"
                        style={{ backgroundColor: COLOR_META[ck].fill }}
                      />
                      <span>{COLOR_META[ck].label}</span>
                    </span>
                    <strong className="text-white">{stats.counts[ck]}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={onExitToPortal}
                className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
              >
                Về cổng game
              </button>
              <button
                type="button"
                onClick={() => startNewGame()}
                className="rounded-lg bg-[#2eff14] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-950 hover:bg-[#5cff47] whitespace-nowrap"
              >
                Chơi ván mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040916]/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-modal-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#0b1730] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="rules-modal-title"
                className="font-display text-xl font-bold uppercase text-white"
              >
                Luật chơi Hành Trình Vô Định
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
                <strong className="text-white">Định lý 4 màu:</strong> Tô màu toàn bộ các vùng trên bản đồ sao cho không có 2 vùng kề cạnh nhau dùng cùng một màu.
              </li>
              <li>
                <strong className="text-white">Ô khóa ban đầu:</strong> Hệ thống tô sẵn và khóa 1 vùng ngẫu nhiên (viền trắng + biểu tượng ổ khóa) làm điểm tựa.
              </li>
              <li>
                <strong className="text-white">Màu mục tiêu:</strong> Hãy cố gắng sử dụng càng ít màu mục tiêu càng tốt. Điểm số được tính bằng{' '}
                <span className="font-mono text-amber-300">
                  Số ô màu mục tiêu × 1.000
                </span>
                .
              </li>
              <li>
                <strong className="text-white">Thao tác nhanh:</strong> Phím{' '}
                <span className="font-mono text-cyan-300">1–4</span> chọn màu,{' '}
                <span className="font-mono text-cyan-300">E</span> chọn tẩy, chuột phải để xóa màu ô,{' '}
                <span className="font-mono text-cyan-300">Z</span> hoàn tác, cuộn chuột để phóng to/thu nhỏ và kéo để di chuyển bản đồ.
              </li>
              <li>
                <strong className="text-white">Kiểm tra:</strong> Bạn có tối đa 2 lượt kiểm tra lỗi trùng màu lân cận trong mỗi ván.
              </li>
            </ul>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="rounded-lg bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
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
