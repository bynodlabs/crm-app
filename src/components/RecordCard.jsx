import { ChevronRight } from 'lucide-react';
import { AvatarInitials } from './AvatarInitials';
import { getCountryMetaForRecord } from '../lib/country';
import { getSectorLabel } from '../lib/sector-utils';
import { getProbabilidadObj } from '../lib/lead-utils';
import { useSectors } from '../hooks/useSectors';

export function RecordCard({ record, onClick, isDarkMode = false, t, language = 'es' }) {
  const { sectors } = useSectors();
  const paisData = getCountryMetaForRecord(record);
  const prob = getProbabilidadObj(record);
  const sectorLabel = getSectorLabel(language, record.sector, sectors);

  return (
    <div onClick={onClick} className="group flex items-center justify-between gap-3 rounded-2xl border border-transparent bg-white p-3 shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)] transition-all hover:border-orange-100 hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.1)] sm:pr-5">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <AvatarInitials name={record.nombre} size="lg" isDarkMode={isDarkMode} />
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 truncate text-sm font-bold text-slate-800 transition-colors group-hover:text-[#FF5A1F] sm:max-w-[220px]">
            {record.nombre || t('dir_no_name')}
            <span className="text-xs flex-shrink-0">{paisData.flag}</span>
          </h4>
          <p className="mt-0.5 truncate text-xs text-slate-500 sm:max-w-[240px]">
            {sectorLabel}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 sm:mt-1 sm:gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 font-medium">
              {prob.icon} {prob.nivel}
            </span>
            <span className="truncate">{record.numero || record.correo || t('ws_no_contact')}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center self-center">
        <button type="button" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#FF5A1F] shadow-sm transition-colors group-hover:bg-[#FF5A1F] group-hover:text-white">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
