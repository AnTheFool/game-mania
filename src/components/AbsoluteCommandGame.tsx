import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine, generatePuzzle, keyOf } from '../game/engine';
import { soundSynth } from '../game/sound';
import {
  CellKey,
  Coord,
  DIRECTIONS,
  DirectionName,
  ModalState,
  PuzzleData,
  STEP_DURATION_MS,
  TOTAL_CELLS,
  TrackSegment,
} from '../game/types';
import { GameHUD } from './GameHUD';
import { ActiveSlideSegment, GridViewport3D } from './GridViewport3D';
import { MenuOverlay } from './MenuOverlay';

interface AbsoluteCommandGameProps {
  onExitToPortal: () => void;
}

export function AbsoluteCommandGame({
  onExitToPortal,
}: AbsoluteCommandGameProps) {
  const initialPuzzle = useMemo(() => generatePuzzle(), []);
  const engineRef = useRef<GameEngine>(
    new GameEngine(
      initialPuzzle.start,
      initialPuzzle.yellow,
      initialPuzzle.numbers
    )
  );

  const [puzzle, setPuzzle] = useState<PuzzleData>(initialPuzzle);
  const [menuOpen, setMenuOpen] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  const [bestSteps, setBestSteps] = useState<number | null>(null);
  const [steps, setSteps] = useState(0);
  const [progress, setProgress] = useState(1);
  const [currentPos, setCurrentPos] = useState<Coord>(initialPuzzle.start);
  const [visitedSet, setVisitedSet] = useState<Set<CellKey>>(
    () => new Set([keyOf(initialPuzzle.start)])
  );
  const [numbersMap, setNumbersMap] = useState<Map<CellKey, number>>(
    () =>
      new Map(
        Object.entries(initialPuzzle.numbers).map(([k, v]) => [k, v])
      )
  );
  const [redSet, setRedSet] = useState<Set<CellKey>>(() => new Set());
  const [trackSegments, setTrackSegments] = useState<TrackSegment[]>([]);
  const [activeSlide, setActiveSlide] = useState<ActiveSlideSegment | null>(
    null
  );

  const [isMoving, setIsMoving] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [hoveredDir, setHoveredDir] = useState<DirectionName | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [muted, setMuted] = useState(() => soundSynth.isMuted());
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [resetViewNonce, setResetViewNonce] = useState(0);

  const yellowSet = useMemo(() => new Set(puzzle.yellow), [puzzle.yellow]);

  const animTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  const clearAnimationTimer = useCallback(() => {
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  }, []);

  const flash = useCallback((msg: string, ms = 2200) => {
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
    }
    setStatusMessage(msg);
    flashTimerRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      flashTimerRef.current = null;
    }, ms);
  }, []);

  useEffect(() => {
    return () => {
      clearAnimationTimer();
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, [clearAnimationTimer]);

  const syncFromEngine = useCallback(() => {
    const snap = engineRef.current.snapshot();
    setCurrentPos(snap.pos);
    setVisitedSet(snap.visited);
    setNumbersMap(snap.numbers);
    setRedSet(snap.red);
    setSteps(snap.steps);
    setProgress(snap.progress);
  }, []);

  const loadPuzzle = useCallback(
    (puz: PuzzleData, resetBest: boolean) => {
      clearAnimationTimer();
      const eng = new GameEngine(puz.start, puz.yellow, puz.numbers);
      engineRef.current = eng;
      setPuzzle(puz);
      if (resetBest) setBestSteps(null);
      setIsMoving(false);
      setIsFinished(false);
      setActiveSlide(null);
      setHoveredDir(null);
      setTrackSegments([]);
      setStatusMessage(null);
      setModal(null);
      const snap = eng.snapshot();
      setCurrentPos(snap.pos);
      setVisitedSet(snap.visited);
      setNumbersMap(snap.numbers);
      setRedSet(snap.red);
      setSteps(snap.steps);
      setProgress(snap.progress);
    },
    [clearAnimationTimer]
  );

  const handleNewPuzzle = useCallback(() => {
    const next = generatePuzzle();
    loadPuzzle(next, true);
    setMenuOpen(false);
    setHasStarted(true);
    setResetViewNonce((n) => n + 1);
    flash('Đã tạo màn chơi mới');
  }, [flash, loadPuzzle]);

  const handleRestartPuzzle = useCallback(() => {
    loadPuzzle(puzzle, false);
    flash('Đã đặt lại màn chơi về trạng thái ban đầu');
  }, [flash, loadPuzzle, puzzle]);

  const handleMove = useCallback(
    (dirName: DirectionName) => {
      if (isMoving || menuOpen || modal !== null || isFinished) return;

      const eng = engineRef.current;
      const vec = DIRECTIONS[dirName].vector;
      const planned = eng.plan(vec);

      if (planned.length === 0) {
        soundSynth.playBlocked();
        flash('Không thể trượt theo hướng này');
        return;
      }

      const rec = eng.apply(vec);
      if (!rec) return;

      setHoveredDir(null);
      setIsMoving(true);

      const path = rec.path;
      const startFrom = rec.prev;

      const runStep = (idx: number) => {
        const fromCoord = idx === 0 ? startFrom : path[idx - 1];
        const toCoord = path[idx];

        setActiveSlide({
          from: fromCoord,
          to: toCoord,
          startedAt: performance.now(),
          durationMs: STEP_DURATION_MS,
        });

        animTimerRef.current = window.setTimeout(() => {
          const k = keyOf(toCoord);
          const numEntry = rec.numsChanged.find(([ck]) => ck === k);

          setVisitedSet((prev) => {
            const next = new Set(prev);
            next.add(k);
            return next;
          });

          if (numEntry) {
            const remainingAfter = numEntry[1] - 1;
            setNumbersMap((prevNums) => {
              const nextNums = new Map(prevNums);
              nextNums.set(k, remainingAfter);
              return nextNums;
            });
            if (remainingAfter <= 0) {
              setRedSet((prevRed) => {
                const nextRed = new Set(prevRed);
                nextRed.add(k);
                return nextRed;
              });
            }
            soundSynth.playNumberTick(remainingAfter);
          } else if (idx === path.length - 1 && yellowSet.has(k)) {
            soundSynth.playSwampStop();
          } else {
            soundSynth.playStep(idx);
          }

          setTrackSegments((prev) => [...prev, { from: fromCoord, to: toCoord }]);
          setCurrentPos(toCoord);

          if (idx + 1 < path.length) {
            runStep(idx + 1);
          } else {
            animTimerRef.current = null;
            setActiveSlide(null);
            setIsMoving(false);
            syncFromEngine();
            if (eng.complete()) {
              soundSynth.playVictory();
              flash(
                `Đã đi qua ${TOTAL_CELLS}/${TOTAL_CELLS} ô — bấm "Xác nhận hoàn thành"`,
                4200
              );
            }
          }
        }, STEP_DURATION_MS);
      };

      runStep(0);
    },
    [flash, isFinished, isMoving, menuOpen, modal, syncFromEngine, yellowSet]
  );

  const handleUndo = useCallback(() => {
    if (isMoving || menuOpen || modal !== null || isFinished) return;
    const rec = engineRef.current.undo();
    if (!rec) {
      flash('Không còn bước nào để hoàn tác');
      return;
    }
    soundSynth.playUndo();
    setTrackSegments((prev) =>
      prev.slice(0, Math.max(0, prev.length - rec.path.length))
    );
    syncFromEngine();
  }, [flash, isFinished, isMoving, menuOpen, modal, syncFromEngine]);

  const handleConfirmSubmit = useCallback(() => {
    const eng = engineRef.current;
    if (eng.complete()) {
      const totalSteps = eng.history.length;
      setIsFinished(true);
      setBestSteps((prev) =>
        prev === null || totalSteps < prev ? totalSteps : prev
      );
      soundSynth.playVictory();
      if (totalSteps <= puzzle.refSteps) {
        setModal({
          type: 'result-optimal',
          steps: totalSteps,
          refSteps: puzzle.refSteps,
        });
      } else {
        setModal({
          type: 'result-suboptimal',
          steps: totalSteps,
          refSteps: puzzle.refSteps,
        });
      }
    } else {
      setModal({
        type: 'result-incomplete',
        progress: eng.progress(),
        remainingNumbers: eng.remainingNumberCells(),
      });
    }
  }, [puzzle.refSteps]);

  const handleKeepOptimizing = useCallback(() => {
    setIsFinished(false);
    setModal(null);
    flash('Dùng Hoàn tác (Z) hoặc Chơi lại để tối ưu số bước ngắn hơn', 4000);
  }, [flash]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundSynth.setMuted(next);
      return next;
    });
  }, []);

  const previewPath = useMemo(() => {
    if (!hoveredDir || isMoving || menuOpen || modal !== null || isFinished) {
      return null;
    }
    const path = engineRef.current.plan(DIRECTIONS[hoveredDir].vector);
    return path.length > 0 ? path : null;
  }, [hoveredDir, isFinished, isMoving, menuOpen, modal]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (modal !== null) {
          setModal(null);
          return;
        }
        if (menuOpen && hasStarted) {
          setMenuOpen(false);
          return;
        }
      }

      if (menuOpen || modal !== null) return;

      const keyMap: Record<string, DirectionName> = {
        ArrowLeft: 'Trái',
        ArrowRight: 'Phải',
        ArrowUp: 'Tiến',
        ArrowDown: 'Lùi',
        w: 'Lên',
        W: 'Lên',
        s: 'Xuống',
        S: 'Xuống',
      };

      if (e.key in keyMap) {
        e.preventDefault();
        handleMove(keyMap[e.key]);
        return;
      }

      if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        if (!isMoving) setModal({ type: 'confirm-new' });
        return;
      }

      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleMove, handleUndo, hasStarted, isMoving, menuOpen, modal]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060d1f] select-none">
      <GridViewport3D
        startCell={puzzle.start}
        yellowSet={yellowSet}
        visitedSet={visitedSet}
        numbersMap={numbersMap}
        redSet={redSet}
        currentPos={currentPos}
        trackSegments={trackSegments}
        activeSlide={activeSlide}
        previewPath={previewPath}
        resetViewNonce={resetViewNonce}
        autoOrbit={menuOpen}
      />

      {!menuOpen && (
        <GameHUD
          bestSteps={bestSteps}
          steps={steps}
          progress={progress}
          currentPos={currentPos}
          isMoving={isMoving}
          isFinished={isFinished}
          canUndo={steps > 0}
          statusMessage={statusMessage}
          muted={muted}
          dockCollapsed={dockCollapsed}
          modal={modal}
          onMove={handleMove}
          onHoverDirection={setHoveredDir}
          onUndo={handleUndo}
          onAskReset={() => {
            if (!isMoving && modal === null) setModal({ type: 'confirm-reset' });
          }}
          onResetView={() => setResetViewNonce((n) => n + 1)}
          onAskNewPuzzle={() => {
            if (!isMoving && modal === null) setModal({ type: 'confirm-new' });
          }}
          onAskSubmit={() => {
            if (!isMoving && modal === null && !isFinished) {
              setModal({ type: 'confirm-submit' });
            }
          }}
          onOpenMenu={() => setMenuOpen(true)}
          onExitToPortal={onExitToPortal}
          onToggleMute={handleToggleMute}
          onToggleDock={() => setDockCollapsed((prev) => !prev)}
          onModalConfirmReset={handleRestartPuzzle}
          onModalConfirmNew={handleNewPuzzle}
          onModalConfirmSubmit={handleConfirmSubmit}
          onModalKeepOptimizing={handleKeepOptimizing}
          onModalClose={() => setModal(null)}
        />
      )}

      {menuOpen && (
        <MenuOverlay
          hasStarted={hasStarted}
          onStartOrResume={() => {
            setMenuOpen(false);
            if (!hasStarted) {
              setHasStarted(true);
              setResetViewNonce((n) => n + 1);
            }
          }}
          onNewPuzzle={handleNewPuzzle}
          onExitToPortal={onExitToPortal}
          onClose={hasStarted ? () => setMenuOpen(false) : undefined}
        />
      )}
    </div>
  );
}
