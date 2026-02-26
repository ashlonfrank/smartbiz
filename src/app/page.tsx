import PlaidConnect from '@/components/PlaidConnect';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080B14] font-sans">
      {/* Subtle gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute -top-20 right-0 h-[400px] w-[400px] rounded-full bg-violet-600/8 blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-900/10 blur-[80px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-lg shadow-indigo-500/30">
            S
          </div>
          <span className="text-sm font-semibold text-white">SmartBiz</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Sandbox Mode</span>
        </div>
      </nav>

      {/* Main content */}
      <main className="relative z-10">
        <PlaidConnect />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-6 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} SmartBiz · Built with Next.js & Plaid
      </footer>
    </div>
  );
}
