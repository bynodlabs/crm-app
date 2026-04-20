import React from 'react';
import { ArrowRight, Layers3, Share2, Sparkles, Zap } from 'lucide-react';

function ToolCard({
  title,
  description,
  icon,
  accent = 'orange',
  onClick,
  cta,
  large = false,
  isDarkMode = false,
}) {
  const accentStyles = {
    orange: isDarkMode
      ? 'from-[#FF4B00]/20 via-[#FF7A00]/10 to-transparent border-[#FF7A00]/20'
      : 'from-[#FF4B00]/10 via-[#FF7A00]/8 to-transparent border-[#FF7A00]/15',
    emerald: isDarkMode
      ? 'from-emerald-500/18 via-emerald-400/8 to-transparent border-emerald-400/15'
      : 'from-emerald-400/12 via-emerald-300/8 to-transparent border-emerald-300/18',
    violet: isDarkMode
      ? 'from-violet-500/18 via-fuchsia-500/8 to-transparent border-violet-400/15'
      : 'from-violet-400/12 via-fuchsia-400/8 to-transparent border-violet-300/18',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[2rem] border bg-gradient-to-br p-6 text-left transition-all duration-300 ${
        accentStyles[accent]
      } ${
        isDarkMode
          ? 'bg-[#121212]/85 text-white shadow-[0_24px_60px_-34px_rgba(0,0,0,0.75)] backdrop-blur-2xl hover:-translate-y-1 hover:border-white/15'
          : 'bg-white/72 text-slate-900 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.16)] backdrop-blur-2xl hover:-translate-y-1 hover:border-white/80'
      } ${large ? 'min-h-[18rem]' : 'min-h-[11.5rem]'}`}
    >
      <div className={`absolute inset-0 opacity-90 ${isDarkMode ? 'bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_40%)]' : 'bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.85),transparent_45%)]'}`}></div>
      <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl ${accent === 'orange' ? 'bg-[#FF7A00]/25' : accent === 'emerald' ? 'bg-emerald-400/25' : 'bg-violet-400/25'}`}></div>

      <div className="relative flex h-full flex-col">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-[1.25rem] border ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-white/70 bg-white/65'}`}>
            {icon}
          </div>
          {cta ? (
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition-all ${isDarkMode ? 'bg-white/5 text-slate-300 group-hover:bg-white/10 group-hover:text-white' : 'bg-white/75 text-slate-500 group-hover:bg-white group-hover:text-slate-700'}`}>
              <span>{cta}</span>
              <ArrowRight size={14} />
            </div>
          ) : null}
        </div>

        <div className="mt-auto">
          <h3 className="text-[1.35rem] font-black tracking-[-0.03em]">{title}</h3>
          <p className={`mt-3 max-w-md text-sm leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{description}</p>
        </div>
      </div>
    </button>
  );
}

export function ToolsView({ isDarkMode = false, onOpenShareLeads }) {
  return (
    <div className={`min-h-full overflow-y-auto px-5 py-6 sm:px-8 lg:px-10 ${isDarkMode ? 'bg-[#080808] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2.4rem] border px-6 py-7 sm:px-8 lg:px-10">
          <div className={`absolute inset-0 ${isDarkMode ? 'bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]' : 'bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(248,250,252,0.68))]'} backdrop-blur-3xl`}></div>
          <div className="absolute -left-10 top-10 h-36 w-36 rounded-full bg-[#FF7A00]/18 blur-[80px]"></div>
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-violet-400/14 blur-[90px]"></div>

          <div className="relative">
            <div className={`mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-300' : 'border-white/70 bg-white/75 text-slate-500'}`}>
              <Layers3 size={14} className="text-[#FF7A00]" />
              <span>Herramientas</span>
            </div>
            <h1 className="max-w-3xl text-[2.35rem] font-black leading-[1.02] tracking-[-0.05em] sm:text-[3rem]">
              Todo lo operativo de tu equipo en un solo lugar.
            </h1>
            <p className={`mt-4 max-w-2xl text-[15px] leading-8 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              Accede a los módulos internos de BigData desde una vista más limpia, moderna y lista para crecer sin ensuciar la navegación principal.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ToolCard
              title="Compartir Leads"
              description="Entra al módulo actual de gestión de equipo para repartir leads, revisar socios y trabajar el flujo colaborativo que ya existe hoy en BigData."
              icon={<Share2 size={24} className="text-[#FF7A00]" />}
              accent="orange"
              cta="Abrir módulo"
              large
              isDarkMode={isDarkMode}
              onClick={onOpenShareLeads}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5">
            <ToolCard
              title="Automatizaciones"
              description="Próximamente podrás activar módulos internos para tareas repetitivas del equipo."
              icon={<Zap size={22} className="text-emerald-400" />}
              accent="emerald"
              isDarkMode={isDarkMode}
            />
            <ToolCard
              title="Playbooks"
              description="Espacio pensado para procesos, secuencias y guías accionables del workspace."
              icon={<Sparkles size={22} className="text-violet-400" />}
              accent="violet"
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
