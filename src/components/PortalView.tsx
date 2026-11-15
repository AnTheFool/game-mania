import { ArrowLeft, ArrowRight, Grid3X3, Layers, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GAMES_CATALOG, GameCatalogItem, GameId } from '../data/gamesCatalog';

type PortalViewMode = 'spotlight' | 'tabular';

interface PortalViewProps {
  onLaunchGame: (id: GameId) => void;
}

function GameIconTile({
  game,
  sizeClass,
  paddingClass,
}: {
  game: GameCatalogItem;
  sizeClass: string;
  paddingClass: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-2xl ${paddingClass} ${sizeClass}`}
      style={{ backgroundColor: game.frameColor }}
    >
      <div className="relative w-full h-full overflow-hidden rounded-xl bg-[#0d1f30]">
        {game.id === 'hanh-trinh-vo-dinh' ? (
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full select-none"
            aria-label={game.title}
          >
            <rect width="200" height="200" fill="#13192b" />
            <g stroke="#0f172a" strokeWidth="3.5" strokeLinejoin="round">
              <polygon points="16,18 82,14 68,66 14,72" fill="#dc3232" />
              <polygon points="82,14 148,22 126,74 68,66" fill="#28c74a" />
              <polygon points="148,22 186,18 182,84 126,74" fill="#3256dc" />
              <polygon points="14,72 68,66 86,118 22,126" fill="#e2cf24" />
              <polygon points="68,66 126,74 136,128 86,118" fill="#3256dc" />
              <polygon points="126,74 182,84 186,136 136,128" fill="#dc3232" />
              <polygon points="22,126 86,118 72,182 18,176" fill="#28c74a" />
              <polygon points="86,118 136,128 128,184 72,182" fill="#e2cf24" />
              <polygon points="136,128 186,136 180,182 128,184" fill="#28c74a" />
            </g>
            {/* Highlighted locked center Voronoi cell */}
            <polygon
              points="68,66 126,74 136,128 86,118"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            {/* Jagged outer boundary */}
            <polygon
              points="16,18 82,14 148,22 186,18 182,84 186,136 180,182 128,184 72,182 18,176 22,126 14,72"
              fill="none"
              stroke="#ef4444"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
        ) : game.id === 'kakuro-xoay-chuyen' ? (
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full select-none"
            aria-label={game.title}
          >
            <rect width="200" height="200" fill="#f1f5f9" />
            <circle
              cx="100"
              cy="100"
              r="62"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2.5"
              strokeDasharray="6 5"
            />
            {/* Center Dual Diamond */}
            <polygon points="100,62 138,100 62,100" fill="#108a3e" />
            <polygon points="62,100 138,100 100,138" fill="#0b0f19" />
            <polygon
              points="100,62 138,100 100,138 62,100"
              fill="none"
              stroke="#0b0f19"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <text
              x="100"
              y="87"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize="16"
              fontWeight="700"
              fontFamily="monospace"
            >
              36
            </text>
            <text
              x="100"
              y="115"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#ffffff"
              fontSize="16"
              fontWeight="700"
              fontFamily="monospace"
            >
              36
            </text>
            {/* 4 Surrounding Orbs */}
            {[
              { x: 100, y: 34, val: 12 },
              { x: 166, y: 100, val: 8 },
              { x: 100, y: 166, val: 9 },
              { x: 34, y: 100, val: 7 },
            ].map((orb, idx) => (
              <g key={idx} transform={`translate(${orb.x}, ${orb.y})`}>
                <circle
                  r="19"
                  fill="#d5d9e0"
                  stroke="#64748b"
                  strokeWidth="2.5"
                />
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#0f172a"
                  fontSize="14"
                  fontWeight="700"
                  fontFamily="monospace"
                >
                  {orb.val}
                </text>
              </g>
            ))}
          </svg>
        ) : game.id === 'so-lien-tranh-ba' ? (
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full select-none"
            aria-label={game.title}
          >
            <rect width="200" height="200" fill="#0b1530" />
            {/* 3-segment orthogonal connection line */}
            <polyline
              points="52,54 52,24 148,24 148,144"
              fill="none"
              stroke="#fb923c"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Number tiles */}
            <g>
              <rect
                x="26"
                y="34"
                width="52"
                height="48"
                rx="8"
                fill="#fbbf24"
                stroke="#ffffff"
                strokeWidth="3"
              />
              <text
                x="52"
                y="58"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#0f172a"
                fontSize="21"
                fontWeight="700"
                fontFamily="monospace"
              >
                36
              </text>

              <rect
                x="122"
                y="120"
                width="52"
                height="48"
                rx="8"
                fill="#fbbf24"
                stroke="#ffffff"
                strokeWidth="3"
              />
              <text
                x="148"
                y="144"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#0f172a"
                fontSize="21"
                fontWeight="700"
                fontFamily="monospace"
              >
                48
              </text>

              <rect
                x="26"
                y="120"
                width="52"
                height="48"
                rx="8"
                fill="#1a2547"
                stroke="#4c72b0"
                strokeWidth="2.5"
              />
              <text
                x="52"
                y="144"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="20"
                fontWeight="700"
                fontFamily="monospace"
              >
                25
              </text>

              <rect
                x="122"
                y="34"
                width="52"
                height="48"
                rx="8"
                fill="#1a2547"
                stroke="#4c72b0"
                strokeWidth="2.5"
              />
              <text
                x="148"
                y="58"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="20"
                fontWeight="700"
                fontFamily="monospace"
              >
                14
              </text>
            </g>
          </svg>
        ) : !imgFailed && game.iconSrc ? (
          <img
            src={game.iconSrc}
            alt={game.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover select-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-[#0e2433] to-[#081322]">
            <span className="font-display text-lg font-bold text-cyan-300 uppercase">
              {game.title}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PortalView({ onLaunchGame }: PortalViewProps) {
  const [viewMode, setViewMode] = useState<PortalViewMode>('spotlight');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState<GameCatalogItem | null>(
    null
  );

  const touchStartX = useRef<number | null>(null);
  const currentGame = GAMES_CATALOG[activeIndex];

  const goPrev = () => {
    setActiveIndex(
      (idx) => (idx - 1 + GAMES_CATALOG.length) % GAMES_CATALOG.length
    );
  };

  const goNext = () => {
    setActiveIndex((idx) => (idx + 1) % GAMES_CATALOG.length);
  };

  useEffect(() => {
    if (viewMode !== 'spotlight' || pendingConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onLaunchGame(GAMES_CATALOG[activeIndex].id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, onLaunchGame, pendingConfirm, viewMode]);

  return (
    <div
      className="relative w-screen h-screen flex flex-col overflow-hidden text-white"
      style={{
        background:
          'linear-gradient(155deg, #5d629c 0%, #4b5086 52%, #3a3f6b 100%)',
      }}
    >
      {/* Top Bar: 3-zone contract */}
      <header className="relative z-10 flex items-center justify-between gap-8 border-b border-white/15 bg-[#2d3157]/75 px-5 sm:px-8 py-3.5">
        <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Kho Trò Chơi Trí Tuệ
        </span>

        {/* View Mode Switcher */}
        <div
          className="flex items-center gap-1 rounded-lg bg-[#1e2240]/85 p-1 border border-white/10"
          role="tablist"
          aria-label="Chế độ hiển thị trò chơi"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'spotlight'}
            onClick={() => setViewMode('spotlight')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'spotlight'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Tiêu điểm</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'tabular'}
            onClick={() => setViewMode('tabular')}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'tabular'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <Grid3X3 className="h-4 w-4" />
            <span>Bảng 3 ô</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onLaunchGame('menh-lenh-tuyet-doi')}
          className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-[#2eff14] px-4 py-2 text-xs sm:text-sm font-bold text-slate-950 hover:bg-[#5cff47] transition-colors whitespace-nowrap shrink-0"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Mệnh Lệnh Tuyệt Đối</span>
        </button>
      </header>

      {/* Main Content */}
      {viewMode === 'spotlight' ? (
        <main
          className="flex-1 flex flex-col items-center justify-center px-4 py-6 select-none"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const diff = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (diff > 45) goPrev();
            else if (diff < -45) goNext();
          }}
        >
          <div className="flex items-center justify-center gap-4 sm:gap-12 w-full max-w-4xl">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Trò chơi trước"
              className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full border border-white/25 bg-[#23274a]/70 text-white hover:bg-[#23274a] hover:border-white/60 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-white"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center text-center">
              <GameIconTile
                game={currentGame}
                sizeClass="w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80"
                paddingClass="p-3 sm:p-4"
              />

              <h1 className="mt-6 font-display text-2xl sm:text-4xl font-bold tracking-wide text-white uppercase text-balance">
                {currentGame.title}
              </h1>

              <p className="mt-1.5 text-xs sm:text-sm text-indigo-100/85">
                {currentGame.genre} · {currentGame.specLine}
              </p>

              <button
                type="button"
                onClick={() => onLaunchGame(currentGame.id)}
                className="mt-5 inline-flex items-center justify-center bg-[#2eff14] hover:bg-[#5cff47] active:scale-[0.98] text-slate-950 font-display text-lg sm:text-xl font-bold tracking-wider uppercase px-16 sm:px-20 py-2.5 sm:py-3 rounded-sm shadow-lg transition-all focus-visible:outline-2 focus-visible:outline-white"
              >
                CHƠI
              </button>
            </div>

            <button
              type="button"
              onClick={goNext}
              aria-label="Trò chơi tiếp theo"
              className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full border border-white/25 bg-[#23274a]/70 text-white hover:bg-[#23274a] hover:border-white/60 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-white"
            >
              <ArrowRight className="h-6 w-6" />
            </button>
          </div>

          {/* Index selector */}
          <div className="mt-8 flex items-center gap-3 text-xs font-mono tabular-nums">
            {GAMES_CATALOG.map((g, idx) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  idx === activeIndex
                    ? 'bg-white text-slate-950 font-bold'
                    : 'text-indigo-100/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {String(idx + 1).padStart(2, '0')}
              </button>
            ))}
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-white">
                Danh sách trò chơi
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100/80">
                Rà chuột vào biểu tượng và bấm Chơi để xác nhận tham gia · Cuộn hoặc vuốt lên xuống để xem thêm
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
              {GAMES_CATALOG.map((game) => (
                <div
                  key={game.id}
                  className="group flex flex-col items-center text-center"
                >
                  <div className="relative">
                    <GameIconTile
                      game={game}
                      sizeClass="w-56 h-56 sm:w-60 sm:h-60"
                      paddingClass="p-2.5"
                    />

                    {/* Hover/Focus Reveal Overlay with CHƠI button */}
                    <div className="absolute inset-0 rounded-2xl bg-[#070d20]/75 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center p-4 gap-3">
                      <p className="text-xs text-slate-200 leading-relaxed line-clamp-3">
                        {game.summary}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPendingConfirm(game)}
                        className="inline-flex items-center justify-center bg-[#2eff14] hover:bg-[#5cff47] text-slate-950 font-display text-base font-bold tracking-wider uppercase px-10 py-2.5 rounded-sm shadow-lg transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
                      >
                        CHƠI
                      </button>
                    </div>
                  </div>

                  <h2 className="mt-3.5 font-display text-lg font-bold tracking-wide text-white uppercase">
                    {game.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-indigo-100/80">
                    {game.genre} · {game.specLine}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* Confirmation Dialog for Tabular "Chơi" */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#060a18]/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-play-title"
        >
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-[#1a2042] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-4">
              <GameIconTile
                game={pendingConfirm}
                sizeClass="w-20 h-20 shrink-0"
                paddingClass="p-1.5"
              />
              <div className="space-y-1">
                <p className="text-xs font-medium text-cyan-300">
                  Xác nhận chơi trò chơi
                </p>
                <h3
                  id="confirm-play-title"
                  className="font-display text-xl font-bold uppercase text-white"
                >
                  {pendingConfirm.title}
                </h3>
                <p className="text-xs text-indigo-100/80">
                  {pendingConfirm.genre} · {pendingConfirm.specLine}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed">
              {pendingConfirm.summary}
            </p>

            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="rounded-lg border border-white/20 bg-[#262d57] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-[#313a6e] whitespace-nowrap"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = pendingConfirm.id;
                  setPendingConfirm(null);
                  onLaunchGame(targetId);
                }}
                className="rounded-lg bg-[#2eff14] px-5 py-2 text-sm font-bold uppercase tracking-wide text-slate-950 hover:bg-[#5cff47] whitespace-nowrap"
              >
                Xác nhận chơi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
