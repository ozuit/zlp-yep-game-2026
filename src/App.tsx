// CSS Styles embedded directly
const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    
    .animate-float {
        animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
    }
`;

// Icons components
const IconTrendingUp = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    <polyline points="17 6 23 6 23 12"></polyline>
  </svg>
);
const IconGift = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 12 20 22 4 22 4 12"></polyline>
    <rect x="2" y="7" width="20" height="5"></rect>
    <line x1="12" y1="22" x2="12" y2="7"></line>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
  </svg>
);
const IconClock = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

import { useEffect, useMemo, useRef, useState } from "react";

type GameDirection = "UP" | "DOWN" | "FLAT";
type GameRoundResult = {
  roundIndex: number; // 0..2
  startPrice: number;
  endPrice: number;
  direction: GameDirection;
};

const SYMBOLS = [
  { label: "BTC/USDT", tvSymbol: "BINANCE:BTCUSDT", apiSymbol: "BTCUSDT" },
  { label: "ETH/USDT", tvSymbol: "BINANCE:ETHUSDT", apiSymbol: "ETHUSDT" },
] as const;

const TOTAL_ROUNDS = 2;
const ROUND_DURATION_SECONDS = 10;

async function fetchPriceFromBinance(apiSymbol: string): Promise<number> {
  const endpoints = [
    "https://api.binance.com/api/v3/ticker/price",
    "https://data-api.binance.vision/api/v3/ticker/price",
  ];

  let lastError: unknown = null;
  for (const base of endpoints) {
    try {
      const url = new URL(base);
      url.searchParams.set("symbol", apiSymbol);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { price?: string };
      const price = Number(data.price);
      if (!Number.isFinite(price)) throw new Error("Invalid price");
      return price;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to fetch price");
}

function formatPrice(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function TradingViewChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "1",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "vi_VN",
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    container.appendChild(script);
  }, [symbol]);

  return (
    <div className="w-full">
      <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden">
        <div className="h-[360px] sm:h-[420px] lg:h-[440px]">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [selectedSymbolKey, _setSelectedSymbolKey] =
    useState<(typeof SYMBOLS)[number]["apiSymbol"]>("BTCUSDT");
  const selectedSymbol = useMemo(() => {
    return SYMBOLS.find((s) => s.apiSymbol === selectedSymbolKey) ?? SYMBOLS[0];
  }, [selectedSymbolKey]);

  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [roundIndex, setRoundIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(ROUND_DURATION_SECONDS);
  const [results, setResults] = useState<GameRoundResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const activeRoundStartPriceRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const roundTimeoutRef = useRef<number | null>(null);

  function clearTimers() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (roundTimeoutRef.current) window.clearTimeout(roundTimeoutRef.current);
    timerRef.current = null;
    roundTimeoutRef.current = null;
  }

  async function startRound(nextRoundIndex: number) {
    clearTimers();
    setError(null);
    setSecondsLeft(ROUND_DURATION_SECONDS);
    setRoundIndex(nextRoundIndex);

    const startPrice = await fetchPriceFromBinance(selectedSymbol.apiSymbol);
    activeRoundStartPriceRef.current = startPrice;

    timerRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    roundTimeoutRef.current = window.setTimeout(async () => {
      try {
        clearTimers();
        const endPrice = await fetchPriceFromBinance(selectedSymbol.apiSymbol);
        const sp = activeRoundStartPriceRef.current ?? startPrice;
        const direction: GameDirection =
          endPrice > sp ? "UP" : endPrice < sp ? "DOWN" : "FLAT";

        setResults((prev) => [
          ...prev,
          {
            roundIndex: nextRoundIndex,
            startPrice: sp,
            endPrice,
            direction,
          },
        ]);

        const finishedRoundCount = nextRoundIndex + 1;
        if (finishedRoundCount >= TOTAL_ROUNDS) {
          setPhase("done");
        } else {
          // Đợi người chơi bấm Bắt đầu lần tiếp theo
          setPhase("idle");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Không thể lấy giá.");
        setPhase("idle");
      }
    }, ROUND_DURATION_SECONDS * 1000);
  }

  function resetGame() {
    clearTimers();
    setPhase("idle");
    setRoundIndex(0);
    setSecondsLeft(ROUND_DURATION_SECONDS);
    setResults([]);
    setError(null);
    activeRoundStartPriceRef.current = null;
  }

  async function handleStartClick() {
    // Đang chạy thì không cho bấm tiếp (dùng nút Dừng / Reset)
    if (phase === "playing") return;

    const isNewGame = phase === "done" || results.length >= TOTAL_ROUNDS;
    if (isNewGame) {
      resetGame();
    }

    const nextRoundIndex = isNewGame ? 0 : results.length;
    setPhase("playing");

    try {
      await startRound(nextRoundIndex);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể lấy giá.");
      setPhase("idle");
    }
  }

  useEffect(() => {
    // if user changes symbol while playing, reset to avoid mismatch
    resetGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbolKey]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans text-white bg-slate-900">
      <style>{styles}</style>

      {/* Hero Section */}
      <header className="relative bg-gradient-to-b from-purple-900 via-slate-900 to-slate-900 pt-10 pb-2 px-4 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-10 left-10 text-9xl text-green-500 animate-float">
            📈
          </div>
          <div
            className="absolute bottom-20 right-10 text-9xl text-red-500 animate-float"
            style={{ animationDelay: "1s" }}
          >
            📉
          </div>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block bg-yellow-500 text-slate-900 font-bold px-4 py-1 rounded-full text-sm mb-4 uppercase tracking-wider animate-bounce">
            Mỗi lượt chỉ 10k
          </div>
          <h1 className="text-3xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-sm">
            Vào Lệnh Không Run
          </h1>
          <p className="text-xl text-slate-300 mb-3 mx-auto">
            Thử tài dự đoán thị trường tài chính siêu tốc trong{" "}
            <span className="text-yellow-400 font-bold">20 giây</span> và giành
            lấy phần quà hấp dẫn!
          </p>
          <p className="text-xl text-slate-300 mb-8 mx-auto font-bold">
            "Đủ 2 hộp mù vào vòng chung kết, người cuối cùng đoán đúng sẽ giành
            giải đặc biệt"
          </p>
        </div>
      </header>

      {/* Main Content: 2 Columns Layout */}
      <section className="bg-slate-900 pb-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left Column: How to play + Rewards */}
            <div className="bg-slate-800 rounded-3xl p-3 lg:p-4 border border-slate-700 aspect-square flex flex-col">
              <h2 className="text-xl lg:text-2xl font-bold mb-2 lg:mb-3 text-center text-blue-400">
                Cách Chơi
              </h2>
              <div className="space-y-1.5 lg:space-y-2 mb-2 lg:mb-3 flex-1">
                {[
                  {
                    icon: IconTrendingUp,
                    title: "1. Dự Đoán",
                    desc: "Bạn nhận định 10s tới thị trường Tăng/Giảm/Không đổi?",
                  },
                  {
                    icon: IconClock,
                      title: "2. Ghi Nhận trong 20s",
                      desc: "Đoán liên tiếp 2 lần. Mỗi lần là 10s biến động.",
                  },
                  {
                    icon: IconGift,
                    title: "3. Chốt Kết Quả",
                    desc: "Tổng kết số lần dự đoán đúng và nhận quà ngay!",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/50 p-2.5 lg:p-3 rounded-xl flex items-center gap-2 lg:gap-3 border border-slate-700/50 transition hover:bg-slate-700 hover:border-blue-500/50 shadow-md"
                  >
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-600 text-purple-400 shadow-lg">
                      <item.icon className="w-4 h-4 lg:w-5 lg:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm lg:text-base font-bold mb-0.5 text-white">
                        {item.title}
                      </h4>
                      <p className="text-slate-400 text-[10px] lg:text-xs leading-tight">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rewards Section */}
              <div className="mt-2 lg:mt-3 pt-2 lg:pt-3 border-t border-slate-700">
                <div className="bg-white text-slate-900 rounded-xl p-2 lg:p-2.5 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>

                  <div className="space-y-1.5 lg:space-y-2">
                    {/* Reward 1: 2 correct */}
                    <div className="flex items-center gap-2 lg:gap-3 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-1.5 lg:p-2 transition hover:scale-105 shadow-sm">
                      <div className="bg-yellow-500 text-white w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex flex-col items-center justify-center font-bold shadow-lg shrink-0">
                        <span className="text-base lg:text-lg leading-none">
                          2
                        </span>
                        <span className="text-[7px] lg:text-[8px] uppercase font-bold opacity-90">
                          Lần Đúng
                        </span>
                      </div>
                      <div className="text-left flex-1 pl-1 min-w-0">
                        <h3 className="font-black text-xs lg:text-sm text-slate-800 leading-tight mb-0.5">
                          Hộp mù Zootopia/Tết
                        </h3>
                        <p className="text-slate-600 text-[10px] lg:text-xs font-medium">
                          Mô hình nhân vật cực hot
                        </p>
                      </div>
                      <div className="text-xl lg:text-2xl shrink-0">🦊</div>
                    </div>

                    {/* Reward 2: 1 correct */}
                    <div className="flex items-center gap-2 lg:gap-3 bg-blue-50 border-2 border-blue-200 rounded-lg p-1.5 lg:p-2 transition hover:scale-105 shadow-sm">
                      <div className="bg-blue-500 text-white w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex flex-col items-center justify-center font-bold shadow-lg shrink-0">
                        <span className="text-sm lg:text-base leading-none">
                          1
                        </span>
                        <span className="text-[7px] lg:text-[8px] uppercase font-bold opacity-90">
                          Lần Đúng
                        </span>
                      </div>
                      <div className="text-left flex-1 pl-1 min-w-0">
                        <h3 className="font-black text-xs lg:text-sm text-slate-800 leading-tight mb-0.5">
                          Túi mù Tết
                        </h3>
                        <p className="text-slate-600 text-[10px] lg:text-xs font-medium">
                          May mắn đầu năm
                        </p>
                      </div>
                      <div className="text-xl lg:text-2xl shrink-0">🧧</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Banner */}
            <div className="bg-slate-800 rounded-3xl border border-slate-700 aspect-square overflow-hidden flex items-center justify-center">
              <img
                src={`${import.meta.env.BASE_URL}special-prize-banner.png`}
                alt="Special Prize Banner"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Play + Chart Section */}
      <section className="bg-slate-900 pb-12 lg:pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-700 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
              <div className="lg:col-span-3 flex flex-col">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-center lg:text-left text-green-400">
                      Chơi Ngay
                    </h2>
                    <p className="text-slate-300 mt-1.5 text-sm leading-relaxed">
                      Mỗi lần bấm{" "}
                      <span className="font-bold text-white">Bắt đầu 10s</span>,
                      hệ thống sẽ tự động ghi nhận 1 lần biến động giá trong{" "}
                      <span className="font-bold text-yellow-400">10 giây</span>{" "}
                      với kết quả{" "}
                      <span className="font-bold text-white">Tăng</span>,{" "}
                      <span className="font-bold text-white">Giảm</span> hoặc{" "}
                      <span className="font-bold text-white">Không đổi</span>.
                      Bấm đủ{" "}
                      <span className="font-bold text-yellow-400">
                        {TOTAL_ROUNDS} lần
                      </span>{" "}
                      để hoàn thành 1 lượt chơi.
                    </p>
                  </div>

                  <div className="mt-3 lg:mt-0 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    {phase !== "playing" ? (
                      <button
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition whitespace-nowrap text-center"
                        onClick={() => handleStartClick()}
                      >
                        Bắt đầu 10s
                      </button>
                    ) : (
                      <button
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-6 py-3 rounded-2xl shadow-lg transition whitespace-nowrap text-center"
                        onClick={() => resetGame()}
                      >
                        Dừng / Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-slate-300 text-sm">
                        Lượt hiện tại
                      </div>
                      <div className="text-white font-black text-lg">
                        {phase === "done"
                          ? "Kết thúc"
                          : `${roundIndex + 1}/${TOTAL_ROUNDS}`}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-slate-300 text-sm">Đếm ngược</div>
                      <div className="text-yellow-400 font-black text-xl tabular-nums">
                        {phase === "playing" ? `${secondsLeft}s` : "--"}
                      </div>
                    </div>
                    <div className="mt-3 text-slate-400 text-xs">
                      Kết quả dựa trên giá ticker realtime (so sánh giá sau 10
                      giây).
                    </div>
                  </div>

                  <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-4">
                    <div className="text-slate-300 text-sm mb-2">
                      Lần ghi nhận
                    </div>
                    <div className="mt-1 text-white font-black text-3xl tabular-nums">
                      {results.length}/{TOTAL_ROUNDS}
                    </div>
                    <div className="mt-2 text-slate-400 text-xs">
                      Mỗi lần bấm Bắt đầu, hệ thống sẽ ghi lại 1 lần biến động
                      giá sau 10 giây. Ghi đủ {TOTAL_ROUNDS} lần để hoàn tất 1
                      lượt chơi.
                    </div>
                  </div>
                </div>

                {error ? (
                  <div className="mt-3 text-red-300 text-sm">
                    Lỗi khi lấy dữ liệu giá: {error}
                  </div>
                ) : null}
              </div>

              <div className="lg:col-span-1">
                <div className="h-full flex items-center justify-center bg-slate-900/70 border border-slate-700/80 rounded-2xl p-4">
                  <div className="bg-white rounded-2xl p-2 shadow-2xl">
                    <img
                      src={`${import.meta.env.BASE_URL}qr-thanh-toan.png`}
                      alt="QR thanh toán VIETQR - Zalopay"
                      className="w-40 h-40 lg:w-44 lg:h-44 object-contain rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
            {results.length ? (
              <div className="mt-4 bg-slate-900/30 border border-slate-700/50 rounded-2xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                  <div className="text-slate-300 text-sm font-bold">
                    Lịch sử {TOTAL_ROUNDS} lần ghi nhận (mỗi lần 10 giây)
                  </div>
                  <div className="text-slate-400 text-xs">
                    Đã ghi:{" "}
                    <span className="text-white font-bold">{results.length}</span>
                    /{TOTAL_ROUNDS}
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {results.map((r) => {
                    const label =
                      r.direction === "UP"
                        ? "Tăng"
                        : r.direction === "DOWN"
                        ? "Giảm"
                        : "Không đổi";
                    const colorClass =
                      r.direction === "UP"
                        ? "text-green-400"
                        : r.direction === "DOWN"
                        ? "text-red-400"
                        : "text-slate-300";

                    return (
                      <div
                        key={r.roundIndex}
                        className="bg-slate-900 border border-slate-700 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-bold">
                            Lần {r.roundIndex + 1}
                          </div>
                          <div className={`${colorClass} font-black`}>
                            {label}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-slate-400 space-y-1">
                          <div>
                            Giá:{" "}
                            <span className="text-white font-bold">
                              {formatPrice(r.startPrice)}
                            </span>{" "}
                            →{" "}
                            <span className="text-white font-bold">
                              {formatPrice(r.endPrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <TradingViewChart symbol={selectedSymbol.tvSymbol} />
        </div>
      </section>
    </div>
  );
}
