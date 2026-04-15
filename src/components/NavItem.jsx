export function NavItem({ icon, label, active, onClick, theme = 'orange', isDarkMode = false, collapsed = false }) {
  const activeClasses =
    theme === 'purple'
      ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-purple-500 text-white shadow-[0_8px_20px_-6px_rgba(147,51,234,0.5)]'
      : 'bg-gradient-to-r from-[#FF3C00] via-[#FF7A00] to-[#FFB36B] text-white shadow-[0_8px_20px_-6px_rgba(255,90,31,0.5)]';

  return (
    <div className={`relative flex items-center ${collapsed ? 'justify-center px-3' : 'pr-6'}`}>
      <button
        type="button"
        onClick={onClick}
        title={collapsed ? label : undefined}
        aria-label={label}
        className={`flex items-center transition-all duration-300 ${
          collapsed
            ? `h-12 w-12 justify-center rounded-2xl ${
                active
                  ? activeClasses
                  : isDarkMode
                    ? 'text-slate-300 hover:text-white hover:bg-[linear-gradient(135deg,rgba(255,90,31,0.22),rgba(255,179,107,0.08))] hover:shadow-[0_10px_24px_-12px_rgba(255,90,31,0.4)]'
                    : 'text-slate-500 hover:text-[#FF5A1F] hover:bg-orange-50/70'
              }`
            : `w-full gap-4 py-3 pl-8 pr-4 rounded-r-full ${
                active
                  ? activeClasses
                  : isDarkMode
                    ? 'text-slate-300 hover:text-white hover:bg-[linear-gradient(135deg,rgba(255,90,31,0.22),rgba(255,179,107,0.08))] hover:shadow-[0_10px_24px_-12px_rgba(255,90,31,0.4)]'
                    : 'text-slate-500 hover:text-[#FF5A1F] hover:bg-orange-50/50'
              }`
        }`}
      >
        <div className={`${active ? 'text-white' : isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{icon}</div>
        {!collapsed ? <span className="font-medium text-[15px]">{label}</span> : null}
      </button>
    </div>
  );
}
