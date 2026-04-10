import bigdataPositive from '../assets/bigdata-positive.svg';
import bigdataNegative from '../assets/bigdata-negative.svg';
import bigdataIconNegative from '../assets/bigdata-icon-negative.svg';
import bigdataIconPositive from '../assets/bigdata-icon-positive.svg';

export function BrandLogo({
  className = '',
  imageClassName = '',
  iconClassName = '',
  iconWrapperClassName = '',
  variant = 'dark',
  size = 'md',
  showIcon = false,
}) {
  const isLight = variant === 'light';
  const logoSrc = isLight ? bigdataNegative : bigdataPositive;
  const iconSrc = isLight ? bigdataIconNegative : bigdataIconPositive;

  return (
    <div className={`brand-logo ${size === 'md' ? 'brand-logo-md' : size === 'sm' ? 'brand-logo-sm' : 'brand-logo-xs'} ${className}`}>
      {showIcon && size !== 'sm' && (
        <span className={iconWrapperClassName}>
          <img className={iconClassName} src={iconSrc} alt="" aria-hidden="true" />
        </span>
      )}
      {size === 'sm' ? (
        <img className={`brand-logo-image ${imageClassName}`.trim()} src={iconSrc} alt="Bigdata" />
      ) : (
        <img className={`brand-logo-image ${imageClassName}`.trim()} src={logoSrc} alt="Bigdata" />
      )}
    </div>
  );
}
