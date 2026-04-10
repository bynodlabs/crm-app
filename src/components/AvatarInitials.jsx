import bigdataIconNegative from '../assets/bigdata-icon-negative.svg';
import bigdataIconPositive from '../assets/bigdata-icon-positive.svg';

export function AvatarInitials({ name, size = 'md', avatarUrl = '', isDarkMode = false }) {
  const wrapperSizeClasses =
    size === 'lg'
      ? 'w-12 h-12'
      : size === 'sm'
        ? 'w-9 h-9'
        : 'w-10 h-10';
  const iconSizeClasses =
    size === 'lg'
      ? 'w-10 h-10'
      : size === 'sm'
        ? 'w-7 h-7'
        : 'w-8 h-8';
  const iconSrc = isDarkMode ? bigdataIconNegative : bigdataIconPositive;

  return (
    <div
      className={`${wrapperSizeClasses} rounded-full flex items-center justify-center ${isDarkMode ? 'bg-gradient-to-br from-[#FF7A00] via-[#FF5A1F] to-[#FF3C00] border-orange-300/40' : 'bg-white border-slate-200'} border shadow-sm flex-shrink-0 overflow-hidden`}
      title={name || 'Bigdata'}
      aria-label={name || 'Bigdata'}
    >
      {avatarUrl ? (
        <img className="w-full h-full object-cover" src={avatarUrl} alt={name || 'Perfil'} />
      ) : (
        <img className={`${iconSizeClasses} object-contain`} src={iconSrc} alt="" aria-hidden="true" />
      )}
    </div>
  );
}
