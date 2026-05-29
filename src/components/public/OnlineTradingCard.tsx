'use client'

export default function OnlineTradingCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-[#1a2744] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#E8A020]/50 hover:shadow-lg">
      <span className="mb-4 block text-center text-5xl">📈</span>
      <p className="mb-1 text-center text-xs uppercase tracking-widest text-gray-400">
        GLOBAL MARKETS
      </p>
      <h3 className="mb-3 text-center text-xl font-bold text-white">Online Trading</h3>
      <p className="flex-1 text-center text-sm text-gray-300">
        Learn forex, stock market trading, and digital investment strategies for global financial
        markets.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {['Forex', 'Stocks', 'Crypto'].map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300"
          >
            {tag}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => alert('More details coming soon! Contact us at info@epiccampus.lk')}
        className="mt-6 cursor-pointer border-none bg-transparent text-center text-sm font-semibold text-[#E8A020] transition-colors hover:text-[#d4911c]"
      >
        More Details Coming Soon →
      </button>
    </div>
  )
}
