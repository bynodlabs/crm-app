import { useRef, useState } from 'react';
import { Globe, Lock, Moon, Settings, Sun, X } from 'lucide-react';
import { AvatarInitials } from './AvatarInitials';

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
    image.src = src;
  });

const compressAvatarImage = async (file) => {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const size = 256;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    return dataUrl;
  }

  const side = Math.min(image.width, image.height);
  const sx = (image.width - side) / 2;
  const sy = (image.height - side) / 2;

  context.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.82);
};

export function SettingsDrawer({ isOpen, onClose, currentUser, isDarkMode, setIsDarkMode, language, setLanguage, t, onUpdatePassword, onUpdateProfile }) {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.nombre || '');
  const [avatarDraft, setAvatarDraft] = useState(currentUser?.avatarUrl || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);
  const nameSaveTimeoutRef = useRef(null);
  const resolveMessage = (result, fallbackKey) => {
    if (result?.errorKey) return t(result.errorKey);
    if (result?.error) return result.error;
    return t(fallbackKey);
  };

  const handleClose = () => {
    if (nameSaveTimeoutRef.current) {
      window.clearTimeout(nameSaveTimeoutRef.current);
      nameSaveTimeoutRef.current = null;
    }
    setIsChangingPassword(false);
    setIsSavingProfile(false);
    setCurrentPass('');
    setNewPass('');
    setConfirmPass('');
    setDisplayName(currentUser?.nombre || '');
    setAvatarDraft(currentUser?.avatarUrl || '');
    setErrorMsg('');
    setSuccessMsg('');
    onClose();
  };

  const saveProfileDraft = async (nextName, nextAvatar, successText = t('settings_success_profile')) => {
    setErrorMsg('');

    const safeName = String(nextName || '').trim();
    if (!safeName) {
      setErrorMsg(t('settings_error_name_empty'));
      return { ok: false };
    }

    if (
      safeName === (currentUser?.nombre || '').trim() &&
      nextAvatar === (currentUser?.avatarUrl || '')
    ) {
      return { ok: true, skipped: true };
    }

    if (onUpdateProfile) {
      setIsSavingProfile(true);
      const result = await onUpdateProfile({ nombre: safeName, avatarUrl: nextAvatar });
      setIsSavingProfile(false);
      if (!result?.ok) {
        setErrorMsg(resolveMessage(result, 'settings_error_update_profile'));
        return result;
      }
      setSuccessMsg(successText);
      setDisplayName(result?.user?.nombre || safeName);
      setAvatarDraft(result?.user?.avatarUrl || nextAvatar);
      return result;
    }

    return { ok: false };
  };

  const queueNameAutoSave = (nextName) => {
    if (nameSaveTimeoutRef.current) {
      window.clearTimeout(nameSaveTimeoutRef.current);
    }

    nameSaveTimeoutRef.current = window.setTimeout(() => {
      saveProfileDraft(nextName, avatarDraft, t('settings_success_name'));
      nameSaveTimeoutRef.current = null;
    }, 650);
  };

  const handleDisplayNameChange = (value) => {
    setDisplayName(value);
    setSuccessMsg('');
    queueNameAutoSave(value);
  };

  const handleDisplayNameBlur = () => {
    if (nameSaveTimeoutRef.current) {
      window.clearTimeout(nameSaveTimeoutRef.current);
      nameSaveTimeoutRef.current = null;
    }
    saveProfileDraft(displayName, avatarDraft, t('settings_success_name'));
  };

  const handlePickAvatar = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg(t('settings_error_valid_image'));
      return;
    }

    try {
      const compressedAvatar = await compressAvatarImage(file);
      setAvatarDraft(compressedAvatar);
      setErrorMsg('');
      setSuccessMsg('');
      await saveProfileDraft(displayName || currentUser?.nombre || '', compressedAvatar, t('settings_success_avatar'));
    } catch {
      setErrorMsg(t('settings_error_process_image'));
    }

    event.target.value = '';
  };

  const handleSavePassword = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (newPass !== confirmPass) {
      setErrorMsg(t('settings_error_password_mismatch'));
      return;
    }
    if (newPass.length < 6) {
      setErrorMsg(t('settings_error_password_min'));
      return;
    }

    if (onUpdatePassword) {
      const result = await onUpdatePassword(currentPass, newPass);
      if (!result?.ok) {
        setErrorMsg(resolveMessage(result, 'settings_error_update_password'));
        return;
      }
      setSuccessMsg(t('settings_success_password'));
      setTimeout(() => {
        setIsChangingPassword(false);
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        setSuccessMsg('');
      }, 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm" onClick={handleClose}></div>
      <div className={`fixed inset-x-0 bottom-0 top-auto z-50 h-[92vh] w-full transform rounded-t-[2rem] border shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur-2xl transition-transform duration-300 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-w-xs sm:rounded-none sm:border-l ${isDarkMode ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))]' : 'border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.56),rgba(255,255,255,0.42))]'} ${isOpen ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'} flex flex-col`}>
        <div className={`flex items-center justify-between border-b p-5 backdrop-blur-xl sm:p-6 ${isDarkMode ? 'border-white/10 bg-white/[0.06]' : 'border-white/60 bg-white/24'}`}>
          <h3 className="font-black text-slate-800 flex items-center gap-2">
            <Settings size={20} className="text-slate-400" /> {t('set_title')}
          </h3>
          <button type="button" onClick={handleClose} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200/50 hover:text-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto p-5 no-scrollbar sm:space-y-8 sm:p-6">
          <div className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={handlePickAvatar}
                className="group relative rounded-full focus:outline-none focus:ring-2 focus:ring-orange-200"
              title={t('settings_change_photo')}
            >
              <AvatarInitials name={displayName || currentUser?.nombre} size="lg" avatarUrl={avatarDraft || currentUser?.avatarUrl} isDarkMode={isDarkMode} />
              <span className="absolute inset-0 rounded-full bg-slate-900/0 transition-colors group-hover:bg-slate-900/10"></span>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm">
                {t('common_change')}
              </span>
            </button>
            <h4 className="mt-5 font-bold text-slate-800 text-lg">{displayName || currentUser?.nombre}</h4>
            <p className="text-sm text-slate-500">{currentUser?.email}</p>
            <span className="mt-2 bg-orange-100 text-[#FF5A1F] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
              {t('common_role')}: {currentUser?.rol === 'admin' ? t('settings_role_admin') : t('settings_role_partner')}
            </span>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('common_profile')}</h5>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
              <input
                type="text"
                placeholder={t('settings_visible_name')}
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                onBlur={handleDisplayNameBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100 transition-all text-slate-800 placeholder:text-slate-400"
              />
              {isSavingProfile && <p className="text-[11px] text-slate-500 font-bold leading-tight bg-slate-100 p-2 rounded-lg">{t('settings_saving_changes')}</p>}
              {errorMsg && <p className="text-[11px] text-rose-500 font-bold leading-tight bg-rose-50 p-2 rounded-lg">{errorMsg}</p>}
              {successMsg && <p className="text-[11px] text-emerald-600 font-bold leading-tight bg-emerald-50 p-2 rounded-lg">{successMsg}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('set_appearance')}</h5>
            <div className="flex bg-slate-100 p-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => setIsDarkMode(false)}
                className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg transition-all text-sm font-bold ${!isDarkMode ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Sun size={16} /> {t('light')}
              </button>
              <button
                type="button"
                onClick={() => setIsDarkMode(true)}
                className={`flex-1 flex justify-center items-center gap-2 py-2 rounded-lg transition-all text-sm font-bold ${isDarkMode ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Moon size={16} /> {t('dark')}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('set_lang')}</h5>
            <div className="relative">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-orange-100 focus:border-[#FF5A1F] transition-all appearance-none cursor-pointer"
              >
                <option value="es">🇪🇸 Español</option>
                <option value="en">🇺🇸 English</option>
                <option value="pt">🇧🇷 Português</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="it">🇮🇹 Italiano</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('set_sec')}</h5>

            {!isChangingPassword ? (
              <button
                type="button"
                onClick={() => setIsChangingPassword(true)}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors flex justify-center items-center gap-2"
              >
                <Lock size={16} /> {t('settings_change_password')}
              </button>
            ) : (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-in fade-in zoom-in-95">
                {errorMsg && <p className="text-[11px] text-rose-500 font-bold text-center leading-tight bg-rose-50 p-1.5 rounded-lg">{errorMsg}</p>}
                {successMsg && <p className="text-[11px] text-emerald-600 font-bold text-center leading-tight bg-emerald-50 p-1.5 rounded-lg">{successMsg}</p>}

                <input
                  type="password"
                  placeholder={t('settings_current_password')}
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  autoComplete="current-password"
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100 transition-all text-slate-800 placeholder:text-slate-400"
                />
                <input
                  type="password"
                  placeholder={t('settings_new_password')}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  autoComplete="new-password"
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100 transition-all text-slate-800 placeholder:text-slate-400"
                />
                <input
                  type="password"
                  placeholder={t('settings_confirm_password')}
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  autoComplete="new-password"
                  className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-orange-100 transition-all text-slate-800 placeholder:text-slate-400"
                />
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setErrorMsg('');
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors"
                  >
                    {t('common_cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePassword}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-[#FF5A1F] hover:bg-[#e6501a] shadow-[0_4px_14px_rgba(255,90,31,0.3)] transition-all"
                  >
                    {t('common_save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
