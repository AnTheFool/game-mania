import {
  ArrowLeft,
  HelpCircle,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundSynth } from '../game/sound';

export type KakuroDifficulty = 'kids' | 'genius';

interface ModeConfig {
  id: KakuroDifficulty;
  name: string;
  subtitle: string;
  maxDiamond: number;
  minOrb: number;
  maxOrb: number;
  scrambleMoves: number;
}

const MODE_CONFIGS: Record<KakuroDifficulty, ModeConfig> = {
  kids: {
    id: 'kids',
    name: 'Con nít',
    subtitle: 'Tổng hình thoi tối đa 50',
    maxDiamond: 50,
    minOrb: 1,
    maxOrb: 12,
    scrambleMoves: 14,
  },
  genius: {
    id: 'genius',
    name: 'Siêu trí tuệ',
    subtitle: 'Tổng hình thoi tối đa 1000',
    maxDiamond: 1000,
    minOrb: 10,
    maxOrb: 250,
    scrambleMoves: 30,
  },
};

const GRID_N = 3;
const UNIT = 100; // Grid spacing in SVG units
const DIAMOND_SIZE = 58;
const ORB_RADIUS = 29;
const ROTATE_DURATION_MS = 190;
// Top, Right, Bottom, Left in SVG coordinates (Y increases downward)
const BASE_ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

type SlotKey = string; // `${gx},${gy}`

interface DiamondDef {
  id: number;
  gx: number;
  gy: number;
  cx: number;
  cy: number;
  slots: [SlotKey, SlotKey, SlotKey, SlotKey]; // Top, Right, Bottom, Left
}

interface OrbState {
  id: number;
  value: number;
}

interface ActiveRotation {
  diamondId: number;
  direction: 1 | -1; // +1 clockwise, -1 counter-clockwise
  startedAt: number;
  progress: number;
  movingSlotKeys: [SlotKey, SlotKey, SlotKey, SlotKey];
  movingOrbs: [OrbState, OrbState, OrbState, OrbState];
}

interface MoveHistoryEntry {
  diamondId: number;
  direction: 1 | -1;
}

function slotKey(gx: number, gy: number): SlotKey {
  return `${gx},${gy}`;
}

function parseSlotKey(key: SlotKey): { gx: number; gy: number } {
  const [x, y] = key.split(',').map(Number);
  return { gx: x, gy: y };
}

function easeSmoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildLattice(): {
  diamonds: DiamondDef[];
  slots: SlotKey[];
} {
  const diamonds: DiamondDef[] = [];
  const slotSet = new Set<SlotKey>();
  const slots: SlotKey[] = [];

  let id = 0;
  for (let j = 0; j < GRID_N; j++) {
    for (let i = 0; i < GRID_N; i++) {
      const gx = i - j;
      const gy = i + j - (GRID_N - 1);
      const dSlots: [SlotKey, SlotKey, SlotKey, SlotKey] = [
        slotKey(gx, gy - 1),
        slotKey(gx + 1, gy),
        slotKey(gx, gy + 1),
        slotKey(gx - 1, gy),
      ];
      for (const s of dSlots) {
        if (!slotSet.has(s)) {
          slotSet.add(s);
          slots.push(s);
        }
      }
      diamonds.push({
        id: id++,
        gx,
        gy,
        cx: gx * UNIT,
        cy: gy * UNIT,
        slots: dSlots,
      });
    }
  }

  return { diamonds, slots };
}

function rotateMapOnce(
  map: Map<SlotKey, OrbState>,
  diamond: DiamondDef,
  direction: 1 | -1
): Map<SlotKey, OrbState> {
  const next = new Map(map);
  const currentOrbs = diamond.slots.map((s) => map.get(s)!);
  for (let i = 0; i < 4; i++) {
    const targetIdx = (i + direction + 4) % 4;
    next.set(diamond.slots[targetIdx], currentOrbs[i]);
  }
  return next;
}

function computeDiamondSum(
  map: Map<SlotKey, OrbState>,
  diamond: DiamondDef
): number {
  let sum = 0;
  for (const s of diamond.slots) {
    sum += map.get(s)?.value ?? 0;
  }
  return sum;
}

function generateBoard(
  mode: KakuroDifficulty,
  diamonds: DiamondDef[],
  slots: SlotKey[]
): {
  initialOrbs: Map<SlotKey, OrbState>;
  targets: Map<number, number>;
} {
  const cfg = MODE_CONFIGS[mode];

  // 1) Assign random orb values in [minOrb, maxOrb] such that 4 * maxOrb <= maxDiamond
  // For kids: 4 * 12 = 48 <= 50 (we also allow up to two 13s so 50 is reachable while guaranteeing max sum <= 50)
  let orbMap = new Map<SlotKey, OrbState>();
  slots.forEach((s, idx) => {
    orbMap.set(s, {
      id: idx,
      value: randInt(cfg.minOrb, cfg.maxOrb),
    });
  });

  if (mode === 'kids') {
    // Optionally bump up to 2 random orbs to 13 (max possible sum of any 4 orbs = 13+13+12+12 = 50)
    const shuffledSlots = [...slots].sort(() => Math.random() - 0.5);
    let bumped = 0;
    for (const s of shuffledSlots) {
      if (bumped >= 2) break;
      const cur = orbMap.get(s)!;
      if (cur.value >= 10) {
        orbMap.set(s, { ...cur, value: 13 });
        bumped++;
      }
    }
  }

  // 2) Record solved target sum for every diamond (guaranteed <= cfg.maxDiamond)
  const targets = new Map<number, number>();
  for (const d of diamonds) {
    targets.set(d.id, computeDiamondSum(orbMap, d));
  }

  // 3) Scramble by random valid rotations so solution is always guaranteed
  let lastDiamondId = -1;
  let lastDir = 0;
  let count = 0;

  const countSolved = (m: Map<SlotKey, OrbState>) =>
    diamonds.filter((d) => computeDiamondSum(m, d) === targets.get(d.id)).length;

  while (count < cfg.scrambleMoves || (countSolved(orbMap) > 2 && count < 400)) {
    const d = diamonds[Math.floor(Math.random() * diamonds.length)];
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    if (d.id === lastDiamondId && dir === -lastDir) continue;
    orbMap = rotateMapOnce(orbMap, d, dir);
    lastDiamondId = d.id;
    lastDir = dir;
    count++;
  }

  return {
    initialOrbs: orbMap,
    targets,
  };
}

interface KakuroRotateGameProps {
  onExitToPortal: () => void;
}

export function KakuroRotateGame({ onExitToPortal }: KakuroRotateGameProps) {
  const { diamonds, slots } = useMemo(() => buildLattice(), []);

  const [difficulty, setDifficulty] = useState<KakuroDifficulty>('kids');
  const [hasStarted, setHasStarted] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [muted, setMuted] = useState(() => soundSynth.isMuted());

  const [startSnapshot, setStartSnapshot] = useState<Map<SlotKey, OrbState>>(
    () => new Map()
  );
  const [orbs, setOrbs] = useState<Map<SlotKey, OrbState>>(() => new Map());
  const [targets, setTargets] = useState<Map<number, number>>(() => new Map());
  const [moves, setMoves] = useState(0);
  const [history, setHistory] = useState<MoveHistoryEntry[]>([]);
  const [won, setWon] = useState(false);

  // Click direction toggle for touch/single-button convenience (Right-click always counter-clockwise)
  const [clickDirection, setClickDirection] = useState<1 | -1>(1);
  const [hoveredDiamondId, setHoveredDiamondId] = useState<number | null>(null);
  const [activeRotation, setActiveRotation] = useState<ActiveRotation | null>(
    null
  );

  const rafRef = useRef<number | null>(null);

  const startNewGame = useCallback(
    (targetMode: KakuroDifficulty = difficulty) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const { initialOrbs, targets: nextTargets } = generateBoard(
        targetMode,
        diamonds,
        slots
      );
      setDifficulty(targetMode);
      setStartSnapshot(new Map(initialOrbs));
      setOrbs(new Map(initialOrbs));
      setTargets(nextTargets);
      setActiveRotation(null);
      setMoves(0);
      setHistory([]);
      setWon(false);
      setHasStarted(true);
      soundSynth.playStep(2);
    },
    [diamonds, difficulty, slots]
  );

  // Initialize board on mount so preview/ready state exists immediately
  useEffect(() => {
    const { initialOrbs, targets: nextTargets } = generateBoard(
      'kids',
      diamonds,
      slots
    );
    setStartSnapshot(new Map(initialOrbs));
    setOrbs(new Map(initialOrbs));
    setTargets(nextTargets);
  }, [diamonds, slots]);

  const resetCurrentGame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setOrbs(new Map(startSnapshot));
    setActiveRotation(null);
    setMoves(0);
    setHistory([]);
    setWon(false);
    soundSynth.playUndo();
  }, [startSnapshot]);

  const triggerRotate = useCallback(
    (diamond: DiamondDef, direction: 1 | -1, recordHistory = true) => {
      if (activeRotation || won || !hasStarted) return;
      if (orbs.size === 0) return;

      const movingOrbs: [OrbState, OrbState, OrbState, OrbState] = [
        orbs.get(diamond.slots[0])!,
        orbs.get(diamond.slots[1])!,
        orbs.get(diamond.slots[2])!,
        orbs.get(diamond.slots[3])!,
      ];

      soundSynth.playStep(direction > 0 ? 4 : 2);

      const startedAt = performance.now();
      setActiveRotation({
        diamondId: diamond.id,
        direction,
        startedAt,
        progress: 0,
        movingSlotKeys: diamond.slots,
        movingOrbs,
      });

      const step = (now: number) => {
        const rawProgress = Math.min(
          1,
          (now - startedAt) / ROTATE_DURATION_MS
        );
        if (rawProgress < 1) {
          setActiveRotation((prev) =>
            prev ? { ...prev, progress: rawProgress } : null
          );
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          setOrbs((prev) => {
            const next = rotateMapOnce(prev, diamond, direction);
            const allSolved = diamonds.every(
              (d) => computeDiamondSum(next, d) === targets.get(d.id)
            );
            if (allSolved) {
              setWon(true);
              soundSynth.playVictory();
            }
            return next;
          });
          setActiveRotation(null);
          if (recordHistory) {
            setMoves((m) => m + 1);
            setHistory((h) => [
              ...h,
              { diamondId: diamond.id, direction },
            ]);
          }
        }
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [activeRotation, diamonds, hasStarted, orbs, targets, won]
  );

  const handleUndo = useCallback(() => {
    if (activeRotation || won || !hasStarted || history.length === 0) return;
    const last = history[history.length - 1];
    const d = diamonds.find((item) => item.id === last.diamondId);
    if (!d) return;

    setHistory((h) => h.slice(0, -1));
    setMoves((m) => Math.max(0, m - 1));
    setOrbs((prev) => rotateMapOnce(prev, d, (last.direction * -1) as 1 | -1));
    soundSynth.playUndo();
  }, [activeRotation, diamonds, hasStarted, history, won]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showRulesModal) {
        if (e.key === 'Escape') setShowRulesModal(false);
        return;
      }
      if (!hasStarted && e.key === 'Enter') {
        e.preventDefault();
        startNewGame(difficulty);
        return;
      }
      if (!hasStarted) return;

      if (e.key === 'n' || e.key === 'N') {
        startNewGame(difficulty);
      } else if (e.key === 'r' || e.key === 'R') {
        resetCurrentGame();
      } else if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === ' ') {
        e.preventDefault();
        setClickDirection((d) => (d === 1 ? -1 : 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    difficulty,
    handleUndo,
    hasStarted,
    resetCurrentGame,
    showRulesModal,
    startNewGame,
  ]);

  const solvedCount = useMemo(() => {
    if (orbs.size === 0) return 0;
    return diamonds.filter(
      (d) => computeDiamondSum(orbs, d) === targets.get(d.id)
    ).length;
  }, [diamonds, orbs, targets]);

  const toggleMute = () => {
    const next = !muted;
    soundSynth.setMuted(next);
    setMuted(next);
  };

  // Compute screen coordinates for all orbs (stationary + moving)
  const renderedOrbs = useMemo(() => {
    if (orbs.size === 0) return [];
    const movingSlotSet = new Set<SlotKey>(
      activeRotation ? activeRotation.movingSlotKeys : []
    );

    const items: Array<{
      key: string;
      value: number;
      x: number;
      y: number;
      isMoving: boolean;
    }> = [];

    for (const [sKey, orb] of orbs.entries()) {
      if (movingSlotSet.has(sKey)) continue;
      const { gx, gy } = parseSlotKey(sKey);
      items.push({
        key: `static-${orb.id}`,
        value: orb.value,
        x: gx * UNIT,
        y: gy * UNIT,
        isMoving: false,
      });
    }

    if (activeRotation) {
      const d = diamonds[activeRotation.diamondId];
      const angleOff =
        activeRotation.direction *
        easeSmoothstep(activeRotation.progress) *
        (Math.PI / 2);
      activeRotation.movingOrbs.forEach((orb, idx) => {
        const angle = BASE_ANGLES[idx] + angleOff;
        items.push({
          key: `moving-${orb.id}`,
          value: orb.value,
          x: d.cx + UNIT * Math.cos(angle),
          y: d.cy + UNIT * Math.sin(angle),
          isMoving: true,
        });
      });
    }

    return items;
  }, [activeRotation, diamonds, orbs]);

  const cfg = MODE_CONFIGS[difficulty];

  return (
    <div className="h-screen w-screen bg-[#060d1f] text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Top Bar: 3-zone contract */}
      <header className="relative z-20 flex items-center justify-between gap-6 border-b border-slate-800/90 bg-[#071024] px-4 sm:px-6 py-3">
        <button
          type="button"
          onClick={() => setShowRulesModal(true)}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-white hover:text-emerald-300 transition-colors whitespace-nowrap shrink-0 uppercase"
        >
          Kakuro Xoay Chuyển
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
            onClick={resetCurrentGame}
            disabled={!hasStarted || Boolean(activeRotation)}
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
            onClick={() => startNewGame(difficulty)}
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
          <div className="w-full max-w-2xl rounded-xl border border-slate-700/75 bg-[#0b1730] p-6 sm:p-10 shadow-2xl space-y-7">
            <div className="space-y-2 text-center">
              <p className="text-xs font-mono text-emerald-300">
                Lưới hình thoi 3 × 3 · 24 tinh cầu · Giải đố số học
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-wide text-white text-balance">
                Kakuro Xoay Chuyển
              </h1>
              <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
                Nhấp vào từng hình thoi để xoay 4 tinh cầu xung quanh theo hoặc ngược chiều kim đồng hồ sao cho tổng hiện tại (nửa trên) khớp hoàn toàn với tổng mục tiêu (nửa dưới) trên cả 9 hình thoi.
              </p>
            </div>

            {/* 2 Modes: Con nít (max 50) & Siêu trí tuệ (max 1000) */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-slate-400 text-center">
                Chọn chế độ thử thách
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['kids', 'genius'] as const).map((modeKey) => {
                  const m = MODE_CONFIGS[modeKey];
                  const active = difficulty === modeKey;
                  return (
                    <button
                      key={modeKey}
                      type="button"
                      onClick={() => setDifficulty(modeKey)}
                      className={`flex flex-col items-start text-left rounded-xl border p-4 transition-all ${
                        active
                          ? 'border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-400/50'
                          : 'border-slate-700 bg-[#071024] hover:border-slate-500'
                      }`}
                    >
                      <span className="font-display text-lg font-bold text-white">
                        {m.name}
                      </span>
                      <span className="mt-1 text-xs font-mono text-emerald-300 tabular-nums">
                        {m.subtitle}
                      </span>
                      <span className="mt-2 text-xs text-slate-300 leading-relaxed">
                        {modeKey === 'kids'
                          ? 'Tinh cầu từ 1–13, xáo trộn vừa phải, phù hợp làm quen và rèn nhẩm nhanh.'
                          : 'Tinh cầu từ 10–250, xáo trộn sâu 30 bước, đòi hỏi tư duy toán học và chiến lược cao.'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => startNewGame(difficulty)}
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
          {/* HUD & Mode Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 bg-[#08132a] px-4 sm:px-6 py-2.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm font-mono tabular-nums text-slate-200">
              <span>
                <span className="text-slate-400">Chế độ: </span>
                <strong className="text-emerald-300 font-sans">
                  {cfg.name} (≤ {cfg.maxDiamond})
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <span className="text-slate-400">Số lần xoay: </span>
                <strong className="text-white">{moves}</strong>
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                <span className="text-slate-400">Đã đạt: </span>
                <strong
                  className={
                    solvedCount === diamonds.length
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                  }
                >
                  {solvedCount}/{diamonds.length}
                </strong>
              </span>
            </div>

            {/* Mode Segmented Switcher + Rotation Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1 rounded-lg bg-[#060d1f] p-1 border border-slate-800"
                role="tablist"
                aria-label="Chuyển chế độ chơi"
              >
                {(['kids', 'genius'] as const).map((modeKey) => (
                  <button
                    key={modeKey}
                    type="button"
                    role="tab"
                    aria-selected={difficulty === modeKey}
                    onClick={() => startNewGame(modeKey)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      difficulty === modeKey
                        ? 'bg-emerald-400 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {MODE_CONFIGS[modeKey].name} (≤
                    {MODE_CONFIGS[modeKey].maxDiamond})
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setClickDirection((d) => (d === 1 ? -1 : 1))}
                title="Đổi chiều xoay khi nhấp chuột trái (Phím Space)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-400/60 hover:text-white whitespace-nowrap"
              >
                {clickDirection === 1 ? (
                  <>
                    <RotateCw className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Nhấp: Thuận chiều</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 text-amber-300" />
                    <span>Nhấp: Ngược chiều</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleUndo}
                disabled={Boolean(activeRotation) || won || history.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Hoàn tác (Z)</span>
              </button>
            </div>
          </div>

          {/* Center SVG Puzzle Canvas */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6 bg-[#f1f5f9]">
            <svg
              viewBox="-355 -355 710 710"
              className="w-full h-full max-w-[660px] max-h-[660px]"
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* Subtle orbital ring guide around hovered or active diamond */}
              {(() => {
                const guideId = activeRotation
                  ? activeRotation.diamondId
                  : hoveredDiamondId;
                if (guideId === null || won) return null;
                const d = diamonds[guideId];
                if (!d) return null;
                return (
                  <circle
                    cx={d.cx}
                    cy={d.cy}
                    r={UNIT}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 6"
                    pointerEvents="none"
                  />
                );
              })()}

              {/* 9 Dual Diamonds */}
              {diamonds.map((d) => {
                const currentSum =
                  orbs.size > 0 ? computeDiamondSum(orbs, d) : 0;
                const targetVal = targets.get(d.id) ?? 0;
                const isSolved = currentSum === targetVal && targetVal > 0;
                const isHovered = hoveredDiamondId === d.id && !won;
                const isAnimatingThis = activeRotation?.diamondId === d.id;

                const topPt = `${d.cx},${d.cy - DIAMOND_SIZE}`;
                const rightPt = `${d.cx + DIAMOND_SIZE},${d.cy}`;
                const bottomPt = `${d.cx},${d.cy + DIAMOND_SIZE}`;
                const leftPt = `${d.cx - DIAMOND_SIZE},${d.cy}`;

                const topColor = isSolved ? '#108a3e' : '#ef2323';
                const textOffset = Math.round(DIAMOND_SIZE * 0.37);

                return (
                  <g
                    key={d.id}
                    className={
                      won || activeRotation ? 'cursor-default' : 'cursor-pointer'
                    }
                    onMouseEnter={() => setHoveredDiamondId(d.id)}
                    onMouseLeave={() =>
                      setHoveredDiamondId((cur) => (cur === d.id ? null : cur))
                    }
                    onClick={() => triggerRotate(d, clickDirection)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      triggerRotate(d, (clickDirection * -1) as 1 | -1);
                    }}
                  >
                    {/* Upper triangle: current sum */}
                    <polygon
                      points={`${topPt} ${rightPt} ${leftPt}`}
                      fill={topColor}
                    />
                    {/* Lower triangle: target sum */}
                    <polygon
                      points={`${leftPt} ${rightPt} ${bottomPt}`}
                      fill="#0b0f19"
                    />
                    {/* Diamond outline */}
                    <polygon
                      points={`${topPt} ${rightPt} ${bottomPt} ${leftPt}`}
                      fill="none"
                      stroke={
                        isAnimatingThis || isHovered ? '#f59e0b' : '#0b0f19'
                      }
                      strokeWidth={isAnimatingThis || isHovered ? 3.5 : 1.5}
                      strokeLinejoin="round"
                    />
                    {/* Current sum text */}
                    <text
                      x={d.cx}
                      y={d.cy - textOffset}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize={difficulty === 'genius' ? 20 : 23}
                      fontWeight={700}
                      fontFamily="var(--font-mono), monospace"
                      pointerEvents="none"
                    >
                      {currentSum}
                    </text>
                    {/* Target sum text */}
                    <text
                      x={d.cx}
                      y={d.cy + textOffset}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize={difficulty === 'genius' ? 20 : 23}
                      fontWeight={700}
                      fontFamily="var(--font-mono), monospace"
                      pointerEvents="none"
                    >
                      {targetVal}
                    </text>
                  </g>
                );
              })}

              {/* 24 Orbs */}
              {renderedOrbs.map((orb) => (
                <g
                  key={orb.key}
                  transform={`translate(${orb.x}, ${orb.y})`}
                  pointerEvents="none"
                >
                  <circle
                    r={ORB_RADIUS}
                    fill={orb.isMoving ? '#e2e8f0' : '#d5d9e0'}
                    stroke={orb.isMoving ? '#f59e0b' : '#94a3b8'}
                    strokeWidth={orb.isMoving ? 2.5 : 2}
                  />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#0f172a"
                    fontSize={difficulty === 'genius' && orb.value >= 100 ? 18 : 21}
                    fontWeight={700}
                    fontFamily="var(--font-mono), monospace"
                  >
                    {orb.value}
                  </text>
                </g>
              ))}
            </svg>

            {/* Victory Overlay */}
            {won && (
              <div
                className="absolute inset-0 z-30 flex items-center justify-center bg-white/85 backdrop-blur-xs p-4"
                role="dialog"
                aria-modal="true"
              >
                <div className="w-full max-w-md rounded-xl border border-emerald-500/40 bg-[#0b1730] p-6 sm:p-8 text-center shadow-2xl space-y-5">
                  <div className="space-y-1.5">
                    <p className="text-xs font-mono text-emerald-300">
                      Chế độ {cfg.name} (≤ {cfg.maxDiamond})
                    </p>
                    <h2 className="font-display text-3xl font-bold uppercase text-emerald-400">
                      CHIẾN THẮNG!
                    </h2>
                    <p className="text-sm text-slate-300">
                      Bạn đã cân bằng toàn bộ 9 hình thoi sau{' '}
                      <strong className="font-mono text-white">
                        {moves}
                      </strong>{' '}
                      lần xoay.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={onExitToPortal}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                    >
                      Về cổng game
                    </button>
                    <button
                      type="button"
                      onClick={() => startNewGame(difficulty)}
                      className="rounded-lg bg-[#2eff14] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-950 hover:bg-[#5cff47] whitespace-nowrap"
                    >
                      Chơi ván mới
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Helper Bar */}
          <footer className="border-t border-slate-800 bg-[#071024] px-4 py-2.5 text-center text-xs text-slate-400">
            Chuột trái: xoay theo chiều đã chọn · Chuột phải: xoay chiều ngược lại · Phím Space: đảo chiều mặc định · Z: hoàn tác · R: chơi lại · N: ván mới
          </footer>
        </main>
      )}

      {/* Rules Modal */}
      {showRulesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040916]/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kakuro-rules-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#0b1730] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="kakuro-rules-title"
                className="font-display text-xl font-bold uppercase text-white"
              >
                Luật chơi Kakuro Xoay Chuyển
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
                Mỗi hình thoi hiển thị <strong className="text-white">tổng hiện tại</strong> của 4 tinh cầu xung quanh ở nửa trên (đỏ khi chưa khớp, xanh lá khi đã khớp) và <strong className="text-white">tổng mục tiêu</strong> ở nửa dưới (nền đen).
              </li>
              <li>
                Nhấp vào bất kỳ hình thoi nào để xoay 4 tinh cầu xung quanh nó một góc 90°. Vì các hình thoi dùng chung tinh cầu, mỗi lần xoay sẽ ảnh hưởng tới các hình thoi lân cận.
              </li>
              <li>
                <strong className="text-emerald-300">Chế độ Con nít:</strong> Giá trị mỗi hình thoi tối đa 50, phù hợp làm quen và nhẩm nhanh.
              </li>
              <li>
                <strong className="text-amber-300">Chế độ Siêu trí tuệ:</strong> Giá trị mỗi hình thoi tối đa 1000, xáo trộn 30 nước phức tạp.
              </li>
            </ul>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="rounded-lg bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
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
