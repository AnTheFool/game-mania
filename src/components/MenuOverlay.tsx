import { ArrowLeft, Play, RefreshCw, X } from 'lucide-react';

interface MenuOverlayProps {
  hasStarted: boolean;
  onStartOrResume: () => void;
  onNewPuzzle: () => void;
  onExitToPortal: () => void;
  onClose?: () => void;
}

export function MenuOverlay({
  hasStarted,
  onStartOrResume,
  onNewPuzzle,
  onExitToPortal,
  onClose,
}: MenuOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#040916]/88 p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-game-title"
    >
      <div className="w-full max-w-4xl rounded-xl border border-slate-700/70 bg-[#0a152b] shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5 sm:px-8 sm:py-6">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-cyan-400 font-mono tabular-nums">
              Không gian lưới 8 × 8 × 3 · 192 ô · Giải đố trượt thẳng
            </p>
            <h1
              id="menu-game-title"
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance uppercase"
            >
              Mệnh Lệnh Tuyệt Đối
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Điều hướng điểm sáng trượt thẳng qua toàn bộ khối lưới ba chiều với chuỗi lệnh tối ưu nhất. Địa hình bên trong sẽ biến đổi trực tiếp theo từng bước đi của bạn.
            </p>
          </div>
          {hasStarted && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg border border-slate-700 bg-slate-900/70 p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
              aria-label="Đóng bảng hướng dẫn"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Two-column Rules & Special Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-6 sm:px-8">
          <section className="space-y-4">
            <h2 className="font-display text-base font-semibold text-cyan-300">
              Luật chơi và cơ chế di chuyển
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Thử thách diễn ra trong một không gian lưới 3D gồm nhiều loại ô chức năng khác nhau.
            </p>
            <dl className="space-y-3.5 text-sm">
              <div>
                <dt className="font-semibold text-slate-100">
                  Hệ thống 6 hướng lệnh
                </dt>
                <dd className="mt-1 text-slate-300 leading-relaxed">
                  Tuyển thủ sử dụng 6 lệnh cơ bản gồm{' '}
                  <span className="font-medium text-white">
                    Lên, Xuống, Trái, Phải, Tiến, Lùi
                  </span>{' '}
                  (hoặc phím mũi tên và W/S) để điều hướng trong không gian.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-100">
                  Cơ chế trượt thẳng
                </dt>
                <dd className="mt-1 text-slate-300 leading-relaxed">
                  Khi nhận một lệnh, điểm di chuyển sẽ tự động đi thẳng theo hướng đó cho đến khi chạm biên giới, gặp tường chắn hoặc rơi vào ô đầm lầy mới dừng lại.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-100">
                  Mục tiêu hoàn thành
                </dt>
                <dd className="mt-1 text-slate-300 leading-relaxed">
                  Tuyển thủ bắt buộc phải đi qua tất cả 192 ô trong không gian (được phép đi lặp lại các ô đã qua) bằng chuỗi lệnh ngắn nhất có thể.
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-base font-semibold text-cyan-300">
              Các loại ô địa hình đặc biệt
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Địa hình trong khối không gian không cố định mà thay đổi dựa trên lộ trình di chuyển của người chơi.
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 rounded-sm bg-emerald-500 border border-emerald-300"
                />
                <div>
                  <span className="font-semibold text-emerald-300">
                    Ô màu xanh lá (Xuất phát)
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    Đây là vị trí xuất phát ban đầu được chương trình chỉ định sẵn.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 rounded-sm bg-yellow-400 border border-yellow-200"
                />
                <div>
                  <span className="font-semibold text-yellow-300">
                    Ô màu vàng (Đầm lầy)
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    Các ô này có sẵn từ đầu và đóng vai trò như điểm hãm phanh, khiến điểm di chuyển lập tức dừng lại ngay khi bước vào.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 rounded-sm bg-slate-800 border border-red-400 text-[10px] font-mono font-bold text-red-400 flex items-center justify-center"
                >
                  3
                </span>
                <div>
                  <span className="font-semibold text-slate-100">
                    Ô số nguyên dương (1–4)
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    Mỗi khi điểm di chuyển đi qua ô này, giá trị số trên ô sẽ tự động giảm đi 1 đơn vị.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 h-4 w-4 shrink-0 rounded-sm bg-red-500 border border-red-300"
                />
                <div>
                  <span className="font-semibold text-red-300">
                    Ô màu đỏ (Tường chắn)
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    Khi giá trị của một ô số bị giảm về 0, ô đó lập tức biến thành tường đỏ và chặn đứng mọi hướng đi qua nó ở các bước sau.
                  </p>
                </div>
              </li>
            </ul>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 bg-[#071024] px-6 py-4 sm:px-8 rounded-b-xl">
          <button
            type="button"
            onClick={onExitToPortal}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Về danh sách game</span>
          </button>
          <div className="flex items-center gap-3">
            {hasStarted && (
              <button
                type="button"
                onClick={onNewPuzzle}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Tạo màn mới</span>
              </button>
            )}
            <button
              type="button"
              onClick={onStartOrResume}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2eff14] px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-[#5cff47] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{hasStarted ? 'Tiếp tục chơi' : 'Bắt đầu chơi'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
