import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Compass,
  MoveDown,
  MoveUp,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import {
  Coord,
  DIRECTIONS,
  DirectionName,
  ModalState,
  TOTAL_CELLS,
} from '../game/types';

interface GameHUDProps {
  bestSteps: number | null;
  steps: number;
  progress: number;
  currentPos: Coord;
  isMoving: boolean;
  isFinished: boolean;
  canUndo: boolean;
  statusMessage: string | null;
  muted: boolean;
  dockCollapsed: boolean;
  modal: ModalState;
  onMove: (dir: DirectionName) => void;
  onHoverDirection: (dir: DirectionName | null) => void;
  onUndo: () => void;
  onAskReset: () => void;
  onResetView: () => void;
  onAskNewPuzzle: () => void;
  onAskSubmit: () => void;
  onOpenMenu: () => void;
  onExitToPortal: () => void;
  onToggleMute: () => void;
  onToggleDock: () => void;
  onModalConfirmReset: () => void;
  onModalConfirmNew: () => void;
  onModalConfirmSubmit: () => void;
  onModalKeepOptimizing: () => void;
  onModalClose: () => void;
}

export function GameHUD({
  bestSteps,
  steps,
  progress,
  currentPos,
  isMoving,
  isFinished,
  canUndo,
  statusMessage,
  muted,
  dockCollapsed,
  modal,
  onMove,
  onHoverDirection,
  onUndo,
  onAskReset,
  onResetView,
  onAskNewPuzzle,
  onAskSubmit,
  onOpenMenu,
  onExitToPortal,
  onToggleMute,
  onToggleDock,
  onModalConfirmReset,
  onModalConfirmNew,
  onModalConfirmSubmit,
  onModalKeepOptimizing,
  onModalClose,
}: GameHUDProps) {
  const locked = isMoving || isFinished || modal !== null;

  const dirButton = (
    dir: DirectionName,
    icon: React.ReactNode,
    className = ''
  ) => {
    const meta = DIRECTIONS[dir];
    return (
      <button
        type="button"
        disabled={locked}
        onClick={() => onMove(dir)}
        onMouseEnter={() => onHoverDirection(dir)}
        onMouseLeave={() => onHoverDirection(null)}
        onFocus={() => onHoverDirection(dir)}
        onBlur={() => onHoverDirection(null)}
        className={`group flex items-center justify-center gap-2 rounded-lg border border-slate-700/80 bg-[#0d1d3d] px-3 py-2 text-sm font-medium text-slate-100 hover:border-cyan-400/70 hover:bg-[#132956] active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 min-h-[40px] focus-visible:outline-2 focus-visible:outline-cyan-400 ${className}`}
      >
        <span className="text-cyan-300 group-hover:text-cyan-200">{icon}</span>
        <span>{meta.name}</span>
        <span className="font-mono text-[11px] text-slate-400">
          {meta.shortcutLabel}
        </span>
      </button>
    );
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
      {/* Top Bar: strict 3-zone contract */}
      <header className="pointer-events-auto flex items-center justify-between gap-8 border-b border-slate-800/90 bg-[#060d1f]/95 px-5 py-3">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="font-display text-lg font-bold tracking-tight text-white hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 uppercase focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          Mệnh Lệnh Tuyệt Đối
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={onExitToPortal}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Cổng game
          </button>
          <button
            type="button"
            onClick={onOpenMenu}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Luật chơi
          </button>
          <button
            type="button"
            onClick={onAskNewPuzzle}
            disabled={isMoving}
            className="hover:text-white hover:underline underline-offset-4 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            Màn mới
          </button>
          <button
            type="button"
            onClick={onResetView}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Góc nhìn chuẩn
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            {muted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật'}
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onAskSubmit}
            disabled={isMoving || isFinished}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 min-h-[40px] focus-visible:outline-2 focus-visible:outline-white"
          >
            Xác nhận hoàn thành
          </button>
        </div>
      </header>

      {/* Top-Left Compact Telemetry (unboxed tabular figures) */}
      <div className="pointer-events-none px-5 pt-3 flex items-start justify-between">
        <div className="rounded-lg border border-slate-800/80 bg-[#071126]/90 px-4 py-3 text-xs sm:text-sm space-y-1">
          <div className="flex items-center gap-4 font-mono tabular-nums text-slate-200">
            <span>
              <span className="text-slate-400">Tối ưu: </span>
              <span className="font-semibold text-cyan-300">
                {bestSteps === null ? '—' : bestSteps}
              </span>
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>
              <span className="text-slate-400">Số bước: </span>
              <span className="font-semibold text-white">{steps}</span>
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono tabular-nums text-slate-200">
            <span>
              <span className="text-slate-400">Hoàn thành: </span>
              <span
                className={`font-semibold ${
                  progress === TOTAL_CELLS ? 'text-emerald-400' : 'text-white'
                }`}
              >
                {progress}/{TOTAL_CELLS}
              </span>
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>
              <span className="text-slate-400">Vị trí: </span>
              <span className="text-amber-300">
                ({currentPos[0]}, {currentPos[1]}, {currentPos[2]})
              </span>
            </span>
          </div>
          {statusMessage && (
            <p className="pt-1 text-xs font-medium text-amber-300">
              {statusMessage}
            </p>
          )}
        </div>

        {/* Mobile compact menu trigger */}
        <div className="pointer-events-auto flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={onExitToPortal}
            className="rounded-lg border border-slate-700 bg-[#071126]/90 px-3 py-2 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            Cổng
          </button>
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded-lg border border-slate-700 bg-[#071126]/90 px-3 py-2 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            Luật chơi
          </button>
          <button
            type="button"
            onClick={onAskNewPuzzle}
            disabled={isMoving}
            className="rounded-lg border border-slate-700 bg-[#071126]/90 px-3 py-2 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 min-h-[40px]"
          >
            Màn mới
          </button>
        </div>
      </div>

      {/* Spacer keeping center 3D scene completely open */}
      <div className="flex-1" />

      {/* Bottom Collapsible Control Dock */}
      <div className="pointer-events-none flex flex-col items-center px-3 pb-4">
        <button
          type="button"
          onClick={onToggleDock}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#08132b]/95 px-3 py-1 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap shrink-0"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Hiện điều khiển (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Thu gọn (H)</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-[940px] rounded-xl border border-slate-700/75 bg-[#08132b]/95 px-4 py-3.5 shadow-2xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* 6 Directional Controls */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <div />
                  {dirButton('Tiến', <ArrowUp className="h-4 w-4" />)}
                  <div />
                  {dirButton('Trái', <ArrowLeft className="h-4 w-4" />)}
                  {dirButton('Lùi', <ArrowDown className="h-4 w-4" />)}
                  {dirButton('Phải', <ArrowRight className="h-4 w-4" />)}
                </div>

                <div className="h-12 w-px bg-slate-800 hidden sm:block mx-1" />

                <div className="flex sm:flex-col gap-1.5">
                  {dirButton('Lên', <MoveUp className="h-4 w-4" />)}
                  {dirButton('Xuống', <MoveDown className="h-4 w-4" />)}
                </div>
              </div>

              {/* Action Controls & Legend */}
              <div className="flex flex-col items-center lg:items-end gap-2.5">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={locked || !canUndo}
                    onClick={onUndo}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
                  >
                    <Undo2 className="h-4 w-4" />
                    <span>Hoàn tác</span>
                    <span className="font-mono text-[11px] text-slate-400">
                      Z
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={isMoving || modal !== null}
                    onClick={onAskReset}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Chơi lại</span>
                  </button>
                  <button
                    type="button"
                    onClick={onResetView}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
                  >
                    <Compass className="h-4 w-4" />
                    <span>Góc chuẩn</span>
                  </button>
                </div>

                {/* Clean unboxed color + label legend */}
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                    <span>Xuất phát</span>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-blue-500" />
                    <span>Đã đi</span>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-yellow-400" />
                    <span>Đầm lầy (dừng)</span>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-red-500" />
                    <span>Tường chắn</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation / Result Modal */}
      {modal && (
        <div
          className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#040916]/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-cyan-500/40 bg-[#0a162e] p-6 shadow-2xl space-y-5">
            {modal.type === 'confirm-reset' && (
              <>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-semibold text-white">
                    Chơi lại từ đầu
                  </h3>
                  <p className="text-sm text-slate-300">
                    Đưa toàn bộ màn chơi hiện tại về trạng thái ban đầu? Kỷ lục tối ưu của bạn ở màn này vẫn được giữ lại.
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onModalClose}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    onClick={onModalConfirmReset}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 whitespace-nowrap"
                  >
                    Đồng ý
                  </button>
                </div>
              </>
            )}

            {modal.type === 'confirm-new' && (
              <>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-semibold text-white">
                    Tạo màn chơi mới
                  </h3>
                  <p className="text-sm text-slate-300">
                    Sinh một khối không gian 8 × 8 × 3 mới với vị trí xuất phát, đầm lầy và ô số hoàn toàn mới?
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onModalClose}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    onClick={onModalConfirmNew}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 whitespace-nowrap"
                  >
                    Đồng ý
                  </button>
                </div>
              </>
            )}

            {modal.type === 'confirm-submit' && (
              <>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-semibold text-white">
                    Xác nhận nộp bài
                  </h3>
                  <p className="text-sm text-slate-300">
                    Kiểm tra tiến độ và ghi nhận số bước cho màn chơi hiện tại?
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onModalClose}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    onClick={onModalConfirmSubmit}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 whitespace-nowrap"
                  >
                    Đồng ý
                  </button>
                </div>
              </>
            )}

            {modal.type === 'result-optimal' && (
              <>
                <div className="space-y-2">
                  <h3 className="font-display text-xl font-bold text-emerald-400">
                    Chúc mừng! Đạt số bước tối ưu
                  </h3>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    Bạn đã chinh phục toàn bộ {TOTAL_CELLS} ô trong{' '}
                    <span className="font-mono font-semibold text-cyan-300">
                      {modal.steps} bước
                    </span>{' '}
                    — đạt chuẩn tối ưu của màn chơi này!
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onModalKeepOptimizing}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                  >
                    Xem lại
                  </button>
                  <button
                    type="button"
                    onClick={onModalConfirmNew}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 whitespace-nowrap"
                  >
                    Màn mới
                  </button>
                </div>
              </>
            )}

            {modal.type === 'result-suboptimal' && (
              <>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-bold text-cyan-300">
                    Hoàn thành trong {modal.steps} bước
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Bạn đã đi qua toàn bộ {TOTAL_CELLS} ô (mốc tham chiếu tối ưu: ≤{' '}
                    <span className="font-mono text-white">{modal.refSteps}</span>{' '}
                    bước). Bạn có muốn hoàn tác hoặc chơi lại để tối ưu đường đi ngắn hơn không?
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onModalConfirmNew}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
                  >
                    Màn mới
                  </button>
                  <button
                    type="button"
                    onClick={onModalKeepOptimizing}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 whitespace-nowrap"
                  >
                    Tối ưu thêm
                  </button>
                </div>
              </>
            )}

            {modal.type === 'result-incomplete' && (
              <>
                <div className="space-y-2">
                  <h3 className="font-display text-lg font-semibold text-amber-300">
                    Chưa hoàn thành màn chơi
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Mới hoàn thành{' '}
                    <span className="font-mono font-semibold text-white">
                      {modal.progress}/{TOTAL_CELLS}
                    </span>{' '}
                    ô.
                    {modal.remainingNumbers > 0 && (
                      <>
                        {' '}
                        Vẫn còn{' '}
                        <span className="font-mono font-semibold text-red-300">
                          {modal.remainingNumbers}
                        </span>{' '}
                        ô số chưa giảm về 0 để chuyển thành tường đỏ.
                      </>
                    )}
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onModalClose}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 whitespace-nowrap"
                  >
                    Tiếp tục
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
