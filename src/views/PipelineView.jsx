import { ArrowRight, Target } from 'lucide-react';

export function PipelineView({ isDarkMode = false }) {
  return (
    <div className={`h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-50'}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section
          className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.18)] sm:p-8 ${
            isDarkMode
              ? 'border-white/10 bg-[linear-gradient(145deg,rgba(20,20,22,0.96),rgba(11,11,13,0.98))] text-white'
              : 'border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] text-slate-900'
          }`}
        >
          <div className={`absolute -right-16 -top-20 h-44 w-44 rounded-full blur-3xl ${isDarkMode ? 'bg-orange-500/12' : 'bg-orange-200/60'}`}></div>
          <div className={`absolute -left-12 bottom-0 h-36 w-36 rounded-full blur-3xl ${isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-100/70'}`}></div>

          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${
                isDarkMode ? 'bg-white/[0.05] text-orange-200' : 'bg-orange-50 text-[#FF5A1F]'
              }`}>
                <Target size={14} />
                Pipeline
              </div>
              <h1 className={`mt-5 text-3xl font-black tracking-tight sm:text-4xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Nueva vista de pipeline
              </h1>
              <p className={`mt-3 max-w-xl text-sm leading-7 sm:text-[15px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Esta pagina ya esta lista dentro de la navegacion principal. La dejamos en blanco como base para construir aqui tu dashboard comercial o el pipeline visual que quieras.
              </p>
            </div>

            <div className={`flex items-center gap-3 rounded-[1.5rem] border px-4 py-3 ${
              isDarkMode ? 'border-white/10 bg-white/[0.04] text-slate-200' : 'border-slate-200 bg-white/80 text-slate-600'
            }`}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Estado</p>
                <p className={`mt-1 text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Lienzo inicial listo</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                isDarkMode ? 'bg-orange-500/10 text-orange-300' : 'bg-orange-50 text-[#FF5A1F]'
              }`}>
                <ArrowRight size={18} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
