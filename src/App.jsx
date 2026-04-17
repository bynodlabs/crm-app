import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Users, 
  PlusCircle, 
  Home, 
  Sliders,
  ChevronLeft,
  ChevronRight,
  Play,
  PieChart,
  LogOut,
  MoreHorizontal,
  TrendingUp,
  Activity,
  Heart,
  User,
  X,
  Phone,
  Mail,
  Globe,
  MapPin,
  Calendar,
  BarChart2,
  Target,
  Zap,
  CheckCircle,
  FileText,
  Upload,
  Download,
  Database,
  Lock,
  Layers,
  MessageCircle,
  Grid,
  Clock,
  ArrowRight,
  Filter,
  Shuffle,
  Circle,
  Share2,
  Copy,
  Check,
  UserPlus,
  Trash2,
  Power,
  Eye,
  EyeOff,
  Archive,
  RefreshCw,
  XCircle,
  List,
  Search,
  Award,
  Link as LinkIcon,
  Settings,
  Sun,
  Moon,
  Edit2
} from 'lucide-react';
import { BrandLogo } from './components/BrandLogo';
import { AvatarInitials } from './components/AvatarInitials';
import { NavItem } from './components/NavItem';
import { WhatsAppIcon } from './components/WhatsAppIcon';
import { RecordCard } from './components/RecordCard';
import { SettingsDrawer } from './components/SettingsDrawer';
import { RecordDetailModal } from './components/RecordDetailModal';
import { ESTADOS_PROSPECCION, ORIGENES, PAISES, PREFIX_TO_ISO, STORAGE_KEYS } from './lib/constants';
import { getLocalISODate } from './lib/date';
import { api } from './lib/api';
import { FAVICON_PULSE_EVENT, triggerFaviconPulse } from './lib/favicon';
import { LANG_LOCALES, translate } from './lib/i18n';
import { buildLeadIdentity, normalizePhone } from './lib/lead-utils';
import { useBackendSync } from './hooks/useBackendSync';
import { useCrmDataState } from './hooks/useCrmDataState';
import { useLanguage } from './hooks/useLanguage';
import { useCrmRecords } from './hooks/useCrmRecords';
import { usePersistentState } from './hooks/usePersistentState';
import { useSessionState } from './hooks/useSessionState';
import { AddRecordView } from './views/AddRecordView';
import { DataTableView } from './views/DataTableView';
import { DashboardView } from './views/DashboardView';
import { LoginView } from './views/LoginView';
import { NetworkView } from './views/NetworkView';
import { ProspectingWorkspace } from './views/ProspectingWorkspace';
import { ReportsView } from './views/ReportsView';

const FAVICON_VARIANTS = {
  light: '/favicon-light.svg',
  dark: '/favicon-dark.svg',
  pulse: '/favicon-pulse.svg',
};

function ensureFaviconElement() {
  let favicon = document.querySelector('#app-favicon');
  if (!(favicon instanceof HTMLLinkElement)) {
    favicon = document.querySelector('link[rel*="icon"]');
  }

  if (!(favicon instanceof HTMLLinkElement)) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    favicon.id = 'app-favicon';
    document.head.appendChild(favicon);
  }

  return favicon;
}

function escapeCsvCell(value) {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function mergeUniqueUsers(...userGroups) {
  const merged = [];
  const seenKeys = new Set();

  userGroups
    .flat()
    .filter(Boolean)
    .forEach((user) => {
      const emailKey = String(user.email || '').trim().toLowerCase();
      const idKey = String(user.id || '').trim();
      const workspaceKey = String(user.workspaceId || '').trim();
      const identityKey = emailKey || idKey || workspaceKey;

      if (!identityKey) {
        merged.push(user);
        return;
      }

      if (seenKeys.has(identityKey)) {
        const existingIndex = merged.findIndex((candidate) => (
          String(candidate.email || '').trim().toLowerCase() === emailKey
          || String(candidate.id || '').trim() === idKey
          || String(candidate.workspaceId || '').trim() === workspaceKey
        ));

        if (existingIndex >= 0) {
          merged[existingIndex] = {
            ...merged[existingIndex],
            ...user,
          };
        }
        return;
      }

      seenKeys.add(identityKey);
      merged.push(user);
    });

  return merged;
}

function buildWorkspaceLeadCountsForUsers(users = [], sourceRecords = []) {
  return Object.fromEntries(
    users.map((user) => [
      user.id,
      {
        workspaceId: user.workspaceId,
        leadsWorkspace: sourceRecords.filter(
          (record) =>
            record.workspaceId === user.workspaceId ||
            record.propietarioId === user.id ||
            record.responsable === user.nombre,
        ).length,
      },
    ]),
  );
}

function downloadCsvFile(filename, headers, rows) {
  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function AppNoticeModal({ notice, onClose, isDarkMode = false }) {
  if (!notice) return null;

  const toneStyles = {
    success: isDarkMode
      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
      : 'border-emerald-100 bg-emerald-50 text-emerald-700',
    warning: isDarkMode
      ? 'border-amber-400/20 bg-amber-500/10 text-amber-300'
      : 'border-amber-100 bg-amber-50 text-amber-700',
    danger: isDarkMode
      ? 'border-orange-400/20 bg-orange-500/10 text-orange-300'
      : 'border-orange-100 bg-orange-50 text-[#FF5A1F]',
  };

  const accentStyle = toneStyles[notice.tone] || toneStyles.warning;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className={`absolute inset-0 ${isDarkMode ? 'bg-slate-950/70' : 'bg-slate-900/45'} backdrop-blur-md`} onClick={onClose}></div>
      <div className={`relative w-full max-w-md overflow-hidden rounded-[2rem] border shadow-[0_32px_80px_-35px_rgba(15,23,42,0.55)] ${
        isDarkMode
          ? 'border-white/10 bg-[linear-gradient(145deg,rgba(18,18,20,0.96),rgba(28,28,32,0.92))] text-white'
          : 'border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] text-slate-900'
      }`}>
        <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl ${isDarkMode ? 'bg-orange-500/12' : 'bg-orange-200/45'}`}></div>
        <div className={`absolute -left-12 bottom-0 h-28 w-28 rounded-full blur-3xl ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-200/35'}`}></div>
        <div className="relative p-6 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${accentStyle}`}>
                <span>BigData</span>
                <span>•</span>
                <span>Aviso</span>
              </div>
              <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{notice.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                isDarkMode
                  ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <X size={18} />
            </button>
          </div>

          <p className={`text-[15px] leading-7 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {notice.message}
          </p>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-[linear-gradient(135deg,#FF4B00,#FF7A00_55%,#FFB36B)] px-6 py-3 text-sm font-black text-white shadow-[0_16px_32px_-18px_rgba(255,90,31,0.55)] transition-transform hover:-translate-y-0.5"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppApiView({ isDarkMode = false, sessionToken = null }) {
  const [qrState, setQrState] = useState('loading');
  const [qrImage, setQrImage] = useState('');
  const [linkedProfileLabel, setLinkedProfileLabel] = useState('');
  const [qrFeedback, setQrFeedback] = useState('');
  const [isQrBusy, setIsQrBusy] = useState(false);
  const statusPollRef = useRef(null);
  const leftCardClass = isDarkMode
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(18,18,20,0.98),rgba(16,16,18,0.92))] text-white'
    : 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] text-slate-900';
  const rightCardClass = isDarkMode
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.98),rgba(16,16,18,0.94))] text-white'
    : 'border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,248,251,0.96))] text-slate-900';
  const softText = isDarkMode ? 'text-slate-300' : 'text-slate-600';
  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  const benefits = [
    'Verificación empresarial',
    'Automatizaciones escalables',
    'Sincronización con CRM',
    'Plantillas aprobadas',
  ];
  const clearStatusPoll = useCallback(() => {
    if (statusPollRef.current) {
      window.clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
  }, []);

  const applyConnectionState = useCallback((connection = {}) => {
    const normalizedStatus = String(connection.status || '').toLowerCase();
    const profileLabel = String(connection.profileName || connection.phoneNumber || '').trim();
    const lastError = String(connection.lastError || '').trim();

    setLinkedProfileLabel(profileLabel);

    if (normalizedStatus === 'open') {
      setQrState('connected');
      setQrImage('');
      setQrFeedback('');
      return;
    }

    if (connection.qrCode) {
      setQrState('active');
      setQrImage(connection.qrCode);
      setQrFeedback('');
      return;
    }

    if (/sesion no autenticada|sesión no autenticada/i.test(lastError)) {
      setQrState('auth');
      setQrImage('');
      setQrFeedback(lastError);
      return;
    }

    if (normalizedStatus === 'connecting') {
      setQrState('loading');
      setQrImage('');
      setQrFeedback(lastError);
      return;
    }

    setQrState('expired');
    setQrFeedback(lastError || 'El código QR ya no está disponible. Genera uno nuevo para continuar.');
  }, []);

  const fetchWaStatus = useCallback(async () => {
    const response = await api.getWhatsAppStatus();
    applyConnectionState(response.connection || {});
    return response.connection || {};
  }, [applyConnectionState]);

  const handleReloadQr = useCallback(async () => {
    if (!sessionToken) {
      clearStatusPoll();
      setQrState('auth');
      setQrImage('');
      setQrFeedback('Tu sesión actual no está conectada al backend. Cierra sesión e inicia sesión nuevamente para generar el QR.');
      return;
    }

    setIsQrBusy(true);
    setQrState('loading');
    setQrFeedback('');

    try {
      const response = await api.getWhatsAppQr();
      applyConnectionState(response.connection || {});
    } catch (error) {
      if (error?.status === 401) {
        clearStatusPoll();
        setQrState('auth');
        setQrImage('');
        setQrFeedback(error?.message || 'Sesión no autenticada.');
        return;
      }
      setQrState('expired');
      setQrImage('');
      setQrFeedback(error?.message || 'No se pudo generar el código QR.');
    } finally {
      setIsQrBusy(false);
    }
  }, [applyConnectionState, clearStatusPoll, sessionToken]);

  const handleDisconnectQr = useCallback(async () => {
    setIsQrBusy(true);
    try {
      await api.disconnectWhatsApp();
      setLinkedProfileLabel('');
      setQrImage('');
      await handleReloadQr();
    } catch (error) {
      setQrFeedback(error?.message || 'No se pudo desconectar la sesión.');
    } finally {
      setIsQrBusy(false);
    }
  }, [handleReloadQr]);

  useEffect(() => {
    if (!sessionToken) {
      clearStatusPoll();
      setQrState('auth');
      setQrImage('');
      setQrFeedback('Tu sesión actual no está conectada al backend. Cierra sesión e inicia sesión nuevamente para generar el QR.');
      return undefined;
    }

    let isMounted = true;

    handleReloadQr().catch(() => {});

    statusPollRef.current = window.setInterval(async () => {
      try {
        const connection = await fetchWaStatus();
        if (!isMounted || String(connection.status || '').toLowerCase() === 'open') return;
      } catch (error) {
        if (error?.status === 401) {
          clearStatusPoll();
          setQrState('auth');
          setQrImage('');
          setQrFeedback(error?.message || 'Sesión no autenticada.');
        }
        // Avoid interrupting the rest of the page while polling.
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearStatusPoll();
    };
  }, [clearStatusPoll, fetchWaStatus, handleReloadQr, sessionToken]);

  const renderQrContent = () => {
    if (qrState === 'loading') {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center">
          <div className={`flex flex-col items-center gap-4 rounded-[1.7rem] border px-8 py-10 ${isDarkMode ? 'border-white/10 bg-[#111317]' : 'border-slate-200 bg-white'}`}>
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#25D366]" />
            <div className="text-center">
              <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Generando QR</p>
              <p className={`mt-1 text-xs ${mutedText}`}>Preparando el código para conexión segura.</p>
            </div>
          </div>
        </div>
      );
    }

    if (qrState === 'expired') {
      return (
        <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-[1.9rem] border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(241,245,249,0.95),rgba(255,255,255,1))] p-4">
          <div className="absolute inset-0 bg-white/55 backdrop-blur-[2px]" />
          {qrImage ? (
            <div className="relative scale-[0.98] opacity-35">
              <div className={`relative mx-auto w-fit rounded-[1.7rem] border p-5 ${isDarkMode ? 'border-white/10 bg-[#111317]' : 'border-slate-200 bg-white'}`}>
                <img src={qrImage} alt="Código QR expirado" className="h-[250px] w-[250px] rounded-2xl object-contain sm:h-[290px] sm:w-[290px]" />
              </div>
            </div>
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`flex flex-col items-center gap-3 rounded-[1.6rem] border px-6 py-5 shadow-[0_18px_48px_-26px_rgba(15,23,42,0.35)] ${isDarkMode ? 'border-white/10 bg-[#121212]/95 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
              <p className="text-sm font-black">QR expirado</p>
              <p className={`max-w-[220px] text-center text-xs leading-5 ${mutedText}`}>
                {qrFeedback || 'Genera un nuevo código para continuar con la vinculación.'}
              </p>
              <button
                type="button"
                onClick={handleReloadQr}
                disabled={isQrBusy}
                className="rounded-full bg-[linear-gradient(135deg,#FF3C00,#FF7A00_60%,#FFB36B)] px-4 py-2 text-xs font-black text-white shadow-[0_14px_28px_-18px_rgba(255,90,31,0.55)] transition-transform hover:-translate-y-0.5"
              >
                Generar nuevo código
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (qrState === 'auth') {
      return (
        <div className="relative flex min-h-[320px] items-center justify-center overflow-hidden rounded-[1.9rem] border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(241,245,249,0.95),rgba(255,255,255,1))] p-4">
          <div className="absolute inset-0 bg-white/55 backdrop-blur-[2px]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`flex flex-col items-center gap-3 rounded-[1.6rem] border px-6 py-5 text-center shadow-[0_18px_48px_-26px_rgba(15,23,42,0.35)] ${isDarkMode ? 'border-white/10 bg-[#121212]/95 text-white' : 'border-slate-200 bg-white text-slate-900'}`}>
              <p className="text-sm font-black">Sesión requerida</p>
              <p className={`max-w-[240px] text-xs leading-5 ${mutedText}`}>
                {qrFeedback || 'Tu sesión API no está autenticada. Inicia sesión nuevamente para generar el QR.'}
              </p>
              <button
                type="button"
                onClick={handleReloadQr}
                disabled={isQrBusy}
                className="rounded-full bg-[linear-gradient(135deg,#FF3C00,#FF7A00_60%,#FFB36B)] px-4 py-2 text-xs font-black text-white shadow-[0_14px_28px_-18px_rgba(255,90,31,0.55)] transition-transform hover:-translate-y-0.5"
              >
                Verificar sesión
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (qrState === 'connected') {
      return (
        <div className={`flex min-h-[320px] items-center justify-center rounded-[1.9rem] border p-5 ${isDarkMode ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-emerald-200 bg-emerald-50/80'}`}>
          <div className={`w-full max-w-[320px] rounded-[1.7rem] border p-6 text-center shadow-[0_18px_48px_-30px_rgba(16,185,129,0.45)] ${isDarkMode ? 'border-white/10 bg-[#111317] text-white' : 'border-white bg-white text-slate-900'}`}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_14px_28px_-18px_rgba(16,185,129,0.65)]">
              <CheckCircle size={24} />
            </div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Online
            </div>
            <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Perfil vinculado</p>
            <p className={`mt-2 text-sm ${mutedText}`}>{linkedProfileLabel || 'Cuenta conectada correctamente'}</p>
            <button
              type="button"
              onClick={handleDisconnectQr}
              disabled={isQrBusy}
              className={`mt-6 rounded-full px-5 py-2.5 text-sm font-black transition-transform hover:-translate-y-0.5 ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'} ${isQrBusy ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              Disconnect
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={`relative overflow-hidden rounded-[1.9rem] border px-4 py-5 transition-transform ${isDarkMode ? 'border-white/10 bg-[#0d1012]' : 'border-slate-200 bg-[radial-gradient(circle_at_top,rgba(241,245,249,0.95),rgba(255,255,255,1))]'}`}>
        <div className={`relative mx-auto w-fit rounded-[1.7rem] border p-5 ${isDarkMode ? 'border-white/10 bg-[#111317]' : 'border-slate-200 bg-white'}`}>
          {qrImage ? (
            <img src={qrImage} alt="Código QR de WhatsApp Web" className="h-[250px] w-[250px] rounded-2xl object-contain sm:h-[290px] sm:w-[290px]" />
          ) : (
            <div className="flex h-[250px] w-[250px] items-center justify-center rounded-2xl bg-slate-100 text-xs font-semibold text-slate-400 sm:h-[290px] sm:w-[290px]">
              Esperando QR...
            </div>
          )}
        </div>
        <p className={`mt-4 text-center text-xs font-medium ${mutedText}`}>Escanea este código con WhatsApp para vincular tu sesión.</p>
      </div>
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1450px] flex-col gap-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className={`text-3xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <span className="font-medium">WhatsApp</span>{' '}
              <span className="font-light">Connect</span>
            </h1>
          </div>
          <div className={`hidden rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] sm:inline-flex ${isDarkMode ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
            Conexión
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
          <section className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.32)] sm:p-8 ${leftCardClass}`}>
            <div className={`absolute -left-10 top-6 h-40 w-40 rounded-full blur-3xl ${isDarkMode ? 'bg-[#25D366]/10' : 'bg-emerald-100/80'}`}></div>
            <div className={`absolute right-0 top-0 h-48 w-48 rounded-full blur-3xl ${isDarkMode ? 'bg-orange-500/8' : 'bg-orange-100/60'}`}></div>

            <div className="relative grid gap-8 xl:grid-cols-[0.42fr_0.58fr] xl:items-center">
              <div className="flex max-w-md flex-col justify-center">
                <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_18px_-12px_rgba(37,211,102,0.75)]">
                    <WhatsAppIcon className="h-[17px] w-[17px] shrink-0" />
                  </span>
                  WhatsApp Web
                </div>
                <h2 className={`text-2xl font-black sm:text-3xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>WhatsApp Web (QR)</h2>
                <p className={`mt-3 max-w-xl text-sm leading-7 sm:text-[15px] ${softText}`}>
                  Conecta tu dispositivo escaneando un código.
                </p>
                <button
                  type="button"
                  onClick={handleReloadQr}
                  disabled={isQrBusy}
                  className={`mt-7 inline-flex w-fit items-center justify-center rounded-full px-6 py-3.5 text-sm font-black text-white shadow-[0_18px_36px_-18px_rgba(255,90,31,0.6)] transition-transform hover:-translate-y-0.5 ${isQrBusy ? 'opacity-70' : ''} bg-[linear-gradient(135deg,#FF3C00,#FF7A00_60%,#FFB36B)]`}
                >
                  Generar Código QR
                </button>
              </div>

              <div className={`rounded-[2rem] border p-4 sm:p-5 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white/70'}`}>
                <div className="flex items-center justify-between gap-3 pb-4">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${mutedText}`}>Escaneo QR</p>
                    <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Vincula tu dispositivo</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_12px_24px_-16px_rgba(37,211,102,0.8)]">
                    <WhatsAppIcon className="h-[25px] w-[25px] shrink-0" />
                  </div>
                </div>
                {renderQrContent()}
                <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs ${isDarkMode ? 'border-white/8 bg-white/[0.03] text-slate-300' : 'border-slate-100 bg-slate-50 text-slate-600'}`}>
                  Abre WhatsApp en tu teléfono, entra a Dispositivos vinculados y escanea este código.
                </div>
              </div>
            </div>
          </section>

          <section className={`relative overflow-hidden rounded-[2rem] border p-6 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.32)] sm:p-8 ${rightCardClass}`}>
            <div className={`absolute -right-8 top-10 h-36 w-36 rounded-full blur-3xl ${isDarkMode ? 'bg-violet-500/10' : 'bg-violet-100/70'}`}></div>
            <div className="relative flex h-full flex-col justify-between gap-6">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'border-violet-400/20 bg-violet-500/10 text-violet-300' : 'border-violet-100 bg-violet-50 text-violet-700'}`}>
                    Recomendado
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${isDarkMode ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
                    Oficial
                  </div>
                </div>
                <h2 className={`text-2xl font-black sm:text-3xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>WhatsApp Business API</h2>
                <p className={`mt-3 max-w-xl text-sm leading-7 sm:text-[15px] ${softText}`}>
                  Conexión oficial para empresas. Requiere Facebook Business.
                </p>
              </div>

              <div className={`rounded-[1.75rem] border p-5 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/80'}`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {benefits.map((item) => (
                    <div key={item} className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold ${isDarkMode ? 'bg-white/[0.04] text-slate-200' : 'bg-white text-slate-700 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.22)]'}`}>
                      <CheckCircle size={16} className="text-emerald-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#FF3C00,#FF7A00_60%,#FFB36B)] px-5 py-3 text-sm font-black text-white shadow-[0_16px_32px_-18px_rgba(255,90,31,0.6)] transition-transform hover:-translate-y-0.5"
                >
                  Configurar API Oficial
                </button>
                <div className={`flex items-center gap-2 text-sm ${mutedText}`}>
                  <Lock size={16} />
                  Requiere acceso de Facebook Business
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const {
    usersDb,
    setUsersDb,
    sessionToken,
    currentUser,
    adminReturnData,
    isViewOnly,
    handleLogin: loginUser,
    handleRegister: registerUser,
    handleUpdatePassword,
    handleUpdateProfile,
    handleImpersonate,
    handleReturnToAdmin,
    handleLogout,
  } = useSessionState();
  const [language, setLanguage] = useLanguage('es', currentUser?.id || 'guest');
  const {
    isDarkMode,
    setIsDarkMode,
    activeTab,
    setActiveTab,
    records,
    setRecords,
    globalSectorFilter,
    setGlobalSectorFilter,
    duplicateRecords,
    setDuplicateRecords,
    sharedLinks,
    setSharedLinks,
    waTemplate,
    setWaTemplate,
  } = useCrmDataState(currentUser);
  const [appNotice, setAppNotice] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null); 
  const [dbSearchTerm, setDbSearchTerm] = useState(''); 
  const [dashboardSectorFilter, setDashboardSectorFilter] = useState('ALL');
  const [adminOverview, setAdminOverview] = useState({ users: [], records: [], duplicates: [], sharedLinks: [], workspaceLeadCounts: {} });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = usePersistentState(`${STORAGE_KEYS.sidebarCollapsed}:${currentUser?.id || 'guest'}`, false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Estado para el panel lateral de configuración
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  useBackendSync({
    sessionToken,
    setUsersDb,
    setRecords,
    records,
    setDuplicateRecords,
    duplicateRecords,
    setSharedLinks,
  });

  // Función traductora rápida
  const t = (key) => translate(language, key);
  const fmt = (key, values = {}) =>
    Object.entries(values).reduce((acc, [entryKey, entryValue]) => acc.replaceAll(`{${entryKey}}`, String(entryValue)), t(key));

  useEffect(() => {
    const favicon = ensureFaviconElement();
    const baseHref = isDarkMode ? FAVICON_VARIANTS.dark : FAVICON_VARIANTS.light;
    let resetTimer = null;

    const setFavicon = (href) => {
      favicon.href = href;
      favicon.type = 'image/svg+xml';
    };

    const resetToBase = () => {
      if (resetTimer) {
        window.clearTimeout(resetTimer);
        resetTimer = null;
      }
      setFavicon(baseHref);
    };

    const handlePulse = (event) => {
      if (document.visibilityState === 'hidden') {
        resetToBase();
        return;
      }

      setFavicon(FAVICON_VARIANTS.pulse);
      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }
      const durationMs = Math.max(400, Number(event?.detail?.durationMs) || 3000);
      resetTimer = window.setTimeout(() => {
        setFavicon(baseHref);
        resetTimer = null;
      }, durationMs);
    };

    const handleVisibilityChange = () => {
      resetToBase();
    };

    setFavicon(baseHref);
    window.addEventListener(FAVICON_PULSE_EVENT, handlePulse);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener(FAVICON_PULSE_EVENT, handlePulse);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resetToBase();
    };
  }, [isDarkMode]);

  useEffect(() => {
    if (currentUser?.rol !== 'admin') {
      return;
    }

    let isCancelled = false;

    api.adminOverview({ ts: Date.now() })
      .then((result) => {
        if (isCancelled) return;
        const nextUsers = result.users || [];
        const nextRecords = result.records || [];
        setAdminOverview({
          users: nextUsers,
          records: nextRecords,
          duplicates: result.duplicates || [],
          sharedLinks: result.sharedLinks || [],
          workspaceLeadCounts:
            result.workspaceLeadCounts || buildWorkspaceLeadCountsForUsers(nextUsers, nextRecords),
        });
      })
      .catch(() => {
        if (isCancelled) return;
        setAdminOverview((prev) => {
          if (
            (prev.users || []).length > 0 ||
            (prev.records || []).length > 0 ||
            Object.keys(prev.workspaceLeadCounts || {}).length > 0
          ) {
            return prev;
          }
          return prev;
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [currentUser?.rol]);

  const effectiveAdminUsers = useMemo(
    () => (currentUser?.rol === 'admin' ? adminOverview.users || [] : usersDb),
    [adminOverview.users, currentUser?.rol, usersDb],
  );
  const effectiveAdminRecords = useMemo(
    () => (currentUser?.rol === 'admin' ? adminOverview.records || [] : records),
    [adminOverview.records, currentUser?.rol, records],
  );
  const handleLogin = async (email, password) => {
    const success = await loginUser(email, password);
    if (!success) {
      setAppNotice({
        title: 'Acceso no disponible',
        message: t('app_bad_credentials'),
        tone: 'danger',
      });
      return;
    }
    triggerFaviconPulse(3000);
  };

  const handleRegister = async (nombre, email, password, referidoPor) => {
    const result = await registerUser(nombre, email, password, referidoPor);
    if (!result.ok && result.reason === 'email_exists') {
      setAppNotice({
        title: 'Registro no disponible',
        message: t('app_email_registered'),
        tone: 'warning',
      });
      return;
    }

    if (!result.ok && result.reason === 'invalid_data') {
      setAppNotice({
        title: 'Revisa tus datos',
        message: result.message || t('app_register_invalid'),
        tone: 'warning',
      });
      return;
    }

    if (!result.ok && result.reason === 'rate_limited') {
      setAppNotice({
        title: 'Espera un momento',
        message: result.message || t('app_register_rate_limited'),
        tone: 'warning',
      });
      return;
    }

    if (!result.ok) {
      setAppNotice({
        title: 'No se pudo registrar',
        message: result.message || t('app_register_failed'),
        tone: 'danger',
      });
    }
  };

  const handleUpdateProfileWithPulse = async (profileData) => {
    const result = await handleUpdateProfile(profileData);
    if (result?.ok && !result?.skipped) {
      triggerFaviconPulse(3000);
    }
    return result;
  };

  const {
    myAgents,
    displayedRecords,
    handleUpdateRecord,
    handleChangeStatus,
    handleArchiveWorkspaceLead,
    handleRemoveFromWorkspaceCompletely,
    handleBulkChangeStatus,
    handlePermanentDeleteRecords,
    handleCreateSharedLink,
    handleCleanDuplicates: cleanDuplicateRecords,
    handleDeleteDuplicates,
    handleRestoreDuplicates,
    handleAutoSelectLeads: autoSelectLeads,
  } = useCrmRecords({
    currentUser,
    usersDb,
    isViewOnly,
    records,
    duplicateRecords,
    setRecords,
    globalSectorFilter,
    sharedLinks,
    setSharedLinks,
    setDuplicateRecords,
    selectedRecord,
    setSelectedRecord,
  });
  const dashboardDisplayedRecords = useMemo(() => {
    const visibleRecords = records.filter((record) => record.estadoProspeccion !== 'Liquidado');
    if (dashboardSectorFilter === 'ALL') {
      return visibleRecords;
    }
    return visibleRecords.filter((record) => record.sector === dashboardSectorFilter);
  }, [dashboardSectorFilter, records]);

  const handleCleanDuplicates = ({ silent = false } = {}) => {
    const result = cleanDuplicateRecords();

    if (silent) {
      return result;
    }

    if (result.cleaned > 0) {
      setAppNotice({
        title: 'Limpieza completada',
        message: fmt('app_duplicates_cleaned', { count: result.cleaned }),
        tone: 'success',
      });
    } else {
      setAppNotice({
        title: 'Base limpia',
        message: t('app_database_clean'),
        tone: 'success',
      });
    }

    return result;
  };

  const handleAutoSelectLeads = (count = 15, silent = false) => {
    const result = autoSelectLeads(count, silent);
    if (result?.assigned > 0) {
      triggerFaviconPulse(3000);
    }
    if (result.reason === 'empty' && !silent) {
      setAppNotice({
        title: 'Sin leads disponibles',
        message: t('app_no_new_leads'),
        tone: 'warning',
      });
    }
  };

  const handleCreateRecord = async (record) => {
    setRecords((prev) => [record, ...prev]);
    triggerFaviconPulse(3000);

    try {
      await api.createRecord(record);
    } catch {
      // Keep local fallback if backend is unavailable.
    }
  };

  const handleAdminResetUserPassword = async (userId, newPassword) => {
    if (currentUser?.rol !== 'admin') {
      return { ok: false, error: 'Solo el admin puede resetear contraseñas.' };
    }

    try {
      await api.updatePassword({ userId, newPassword });
      setAppNotice({
        title: t('god_reset_password_title'),
        message: t('god_reset_password_success'),
        tone: 'success',
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || 'No se pudo resetear la contraseña.',
      };
    }
  };

  const handleImportRecords = async ({ newRecords, updatedRecords = [], newDuplicates = [] }) => {
    const batchSeen = new Set();
    const validatedNewRecords = [];
    const validatedDuplicates = [...newDuplicates];

    newRecords.forEach((record) => {
      const leadKey = buildLeadIdentity(record);
      const normalizedPhone = normalizePhone(record.numero);
      const fallbackPhoneKey = normalizedPhone.length >= 8 ? `phone:${normalizedPhone}` : null;
      const batchDuplicate =
        (leadKey && batchSeen.has(leadKey)) ||
        (fallbackPhoneKey && batchSeen.has(fallbackPhoneKey));

      if (batchDuplicate) {
        validatedDuplicates.push(record);
        return;
      }

      validatedNewRecords.push(record);
      if (leadKey) {
        batchSeen.add(leadKey);
      }
      if (fallbackPhoneKey) {
        batchSeen.add(fallbackPhoneKey);
      }
    });

    let finalImportedCount = validatedNewRecords.length;
    let finalDuplicateCount = validatedDuplicates.length;

    try {
      let backendAcceptedRecords = validatedNewRecords;
      let backendDuplicates = [];

      if (validatedNewRecords.length > 0) {
        const result = await api.bulkCreateRecords(validatedNewRecords);
        backendAcceptedRecords = result.items || [];
        backendDuplicates = result.duplicates || [];
        finalImportedCount = backendAcceptedRecords.length;
        finalDuplicateCount = validatedDuplicates.length + backendDuplicates.length;
      }

      if (validatedDuplicates.length > 0) {
        await api.bulkStoreDuplicates(validatedDuplicates);
      }

      await Promise.all(updatedRecords.map((updatedRecord) => api.updateRecord(updatedRecord.id, updatedRecord)));

      const [recordsResult, duplicatesResult] = await Promise.all([
        api.listAllRecords(),
        api.listDuplicates(),
      ]);

      setRecords(recordsResult.items || []);
      setDuplicateRecords(duplicatesResult.items || []);
    } catch {
      if (updatedRecords.length > 0 || validatedNewRecords.length > 0) {
        setRecords((prev) => {
          const next = [...prev];
          updatedRecords.forEach((updatedRecord) => {
            const index = next.findIndex((record) => record.id === updatedRecord.id);
            if (index !== -1) {
              next[index] = updatedRecord;
            }
          });
          return [...validatedNewRecords, ...next];
        });
      }

      if (validatedDuplicates.length > 0) {
        setDuplicateRecords((prev) => [...validatedDuplicates, ...prev]);
      }
    }

    const summary = {
      importedCount: finalImportedCount,
      updatedCount: updatedRecords.length,
      duplicateCount: finalDuplicateCount,
    };

    if (summary.importedCount > 0 || summary.updatedCount > 0) {
      triggerFaviconPulse(3000);
    }

    return summary;
  };

  const isHomeLikeTab = activeTab === 'home' || activeTab === 'reports' || activeTab === 'god-panel';
  const mobilePrimaryNav = [
    { id: 'home', label: t('nav_home'), icon: <Home size={18} />, isActive: isHomeLikeTab, onClick: () => setActiveTab('home') },
    { id: 'prospecting', label: t('nav_sales'), icon: <Target size={18} />, isActive: activeTab === 'prospecting', onClick: () => setActiveTab('prospecting') },
    { id: 'database', label: t('nav_dir'), icon: <Users size={18} />, isActive: activeTab === 'database', onClick: () => { setActiveTab('database'); setDbSearchTerm(''); } },
    { id: 'add', label: t('nav_add'), icon: <PlusCircle size={18} />, isActive: activeTab === 'add', onClick: () => setActiveTab('add') },
    { id: 'network', label: t('nav_team'), icon: <Users size={18} />, isActive: activeTab === 'network', onClick: () => setActiveTab('network') },
  ];

  const handleMobileNavClick = (handler) => {
    setIsMobileMenuOpen(false);
    handler();
  };

  if (!currentUser) {
    return (
      <>
        <LoginView onLogin={handleLogin} onRegister={handleRegister} t={t} notice={appNotice} onClearNotice={() => setAppNotice(null)} />
      </>
    );
  }

  return (
    <div className={`h-screen w-full flex font-sans text-slate-800 bg-slate-50 overflow-hidden relative ${isDarkMode ? 'dark-mode' : ''}`}>
      <style>{`
        /* INYECCIÓN DEL MODO OSCURO (TONOS NEUTROS Y NEGROS PROFUNDOS) */
        .dark-mode { background-color: #0a0a0a !important; color: #f5f5f5 !important; }
        .dark-mode .bg-white { background-color: #171717 !important; }
        .dark-mode .bg-slate-50, .dark-mode .bg-slate-50\\/50, .dark-mode .bg-slate-50\\/30 { background-color: #0a0a0a !important; }
        .dark-mode .bg-slate-100 { background-color: #262626 !important; }
        .dark-mode .bg-slate-200 { background-color: #404040 !important; }
        
        .dark-mode .border-slate-100 { border-color: #262626 !important; }
        .dark-mode .border-slate-200, .dark-mode .border-slate-200\\/60 { border-color: #404040 !important; }
        .dark-mode .border-slate-300 { border-color: #525252 !important; }
        .dark-mode .border-white { border-color: #171717 !important; }
        
        .dark-mode .text-slate-800, .dark-mode .text-slate-900, .dark-mode .text-slate-700 { color: #fafafa !important; }
        .dark-mode .text-slate-600 { color: #d4d4d4 !important; }
        .dark-mode .text-slate-500 { color: #a3a3a3 !important; }
        .dark-mode .text-slate-400 { color: #737373 !important; }
        
        .dark-mode .hover\\:bg-slate-50:hover, .dark-mode .hover\\:bg-slate-50\\/50:hover { background: linear-gradient(135deg, rgba(255,90,31,0.14), rgba(255,255,255,0.05)) !important; }
        .dark-mode .hover\\:bg-slate-100:hover { background: linear-gradient(135deg, rgba(255,90,31,0.18), rgba(255,255,255,0.07)) !important; }
        .dark-mode .hover\\:bg-slate-200\\/50:hover { background: linear-gradient(135deg, rgba(255,90,31,0.2), rgba(255,255,255,0.08)) !important; }
        
        .dark-mode input:not([type="checkbox"]), .dark-mode textarea, .dark-mode select { background-color: #0a0a0a !important; color: #fafafa !important; border-color: #262626 !important; }
        .dark-mode input:not([type="checkbox"]):focus, .dark-mode textarea:focus, .dark-mode select:focus { background-color: #171717 !important; border-color: #FF5A1F !important; }
        .dark-mode .bg-transparent { background-color: transparent !important; }
        .dark-mode .divide-slate-50 > :not([hidden]) ~ :not([hidden]) { border-color: #262626 !important; }
        
        /* Cajas de tintes y colores de marca adaptadas */
        .dark-mode .bg-orange-50, .dark-mode .bg-orange-50\\/50 { background-color: rgba(255, 90, 31, 0.1) !important; }
        .dark-mode .border-orange-100, .dark-mode .border-orange-200, .dark-mode .border-orange-200\\/50 { border-color: rgba(255, 90, 31, 0.2) !important; }
        .dark-mode .bg-emerald-50, .dark-mode .bg-green-50 { background-color: rgba(16, 185, 129, 0.1) !important; }
        .dark-mode .border-emerald-100, .dark-mode .border-emerald-200, .dark-mode .border-green-100, .dark-mode .border-green-200 { border-color: rgba(16, 185, 129, 0.2) !important; }
        .dark-mode .bg-yellow-50, .dark-mode .bg-yellow-50\\/50, .dark-mode .bg-amber-50 { background-color: rgba(245, 158, 11, 0.1) !important; }
        .dark-mode .border-yellow-100, .dark-mode .border-yellow-200, .dark-mode .border-yellow-200\\/50, .dark-mode .border-amber-100, .dark-mode .border-amber-200 { border-color: rgba(245, 158, 11, 0.2) !important; }
        .dark-mode .bg-purple-50 { background-color: rgba(168, 85, 247, 0.1) !important; }
        .dark-mode .hover\\:bg-orange-50:hover, .dark-mode .hover\\:bg-orange-100:hover { background-color: rgba(255, 90, 31, 0.15) !important; }
        .dark-mode .hover\\:bg-emerald-100:hover, .dark-mode .hover\\:bg-green-50:hover { background-color: rgba(16, 185, 129, 0.15) !important; }
        .dark-mode .text-orange-950 { color: #fed7aa !important; }
        .dark-mode .directory-page-btn { background: linear-gradient(135deg, #FF3C00, #FF7A00 55%, #FFB36B) !important; color: #fff !important; border-color: rgba(255, 179, 107, 0.35) !important; box-shadow: 0 10px 24px -14px rgba(255, 90, 31, 0.55) !important; }
        .dark-mode .directory-page-btn:hover { filter: brightness(1.05); }
        .dark-mode .directory-page-btn:disabled { background: rgba(255, 255, 255, 0.08) !important; color: rgba(255,255,255,0.45) !important; border-color: rgba(255,255,255,0.08) !important; box-shadow: none !important; }
        
        /* Nuevos estilos específicos para cabeceras en Mi Equipo (Modo Oscuro) */
        .dark-mode .header-socios { background: linear-gradient(to right, rgba(255, 90, 31, 0.15), rgba(255, 90, 31, 0.05)) !important; border-bottom-color: rgba(255, 90, 31, 0.2) !important; }
        .dark-mode .header-lotes { background: rgba(255, 255, 255, 0.08) !important; border-bottom-color: rgba(255, 255, 255, 0.1) !important; }

        /* Efecto Glassmorphism Corregido */
        .glass-panel { background: rgba(255, 255, 255, 0.6) !important; backdrop-filter: blur(24px) !important; -webkit-backdrop-filter: blur(24px) !important; border: 1px solid rgba(255, 255, 255, 0.6) !important; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1) !important; }
        .dark-mode .glass-panel { background: rgba(30, 30, 30, 0.4) !important; border: 1px solid rgba(255, 255, 255, 0.08) !important; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4) !important; backdrop-filter: blur(24px) !important; -webkit-backdrop-filter: blur(24px) !important; }
      `}</style>
      <AppNoticeModal notice={appNotice} onClose={() => setAppNotice(null)} isDarkMode={isDarkMode} />

      {/* Esfera de luz para resaltar el cristal del menú lateral */}
      <div className="absolute top-40 left-0 w-64 h-64 bg-purple-500 rounded-full blur-[100px] opacity-10 pointer-events-none z-0"></div>

      <aside className={`hidden lg:flex glass-panel flex-col py-8 relative z-20 border-r border-slate-200/30 shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-[92px]' : 'w-64'}`}>
        <div className={`flex items-center justify-center mb-3 sidebar-brand transition-all duration-300 ${isSidebarCollapsed ? 'px-3' : 'pl-10 pr-6'}`}>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="relative group shrink-0 cursor-pointer bg-transparent border-0 p-0 text-left"
            title={isSidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            <div className={`absolute -bottom-3 h-8 rounded-full bg-gradient-to-r from-[#FF3C00] via-[#FF7A00] to-[#FFB36B] opacity-0 blur-2xl scale-90 transition-all duration-500 group-hover:opacity-45 group-hover:scale-100 ${isSidebarCollapsed ? 'left-2 right-2' : 'left-4 right-4'}`}></div>
            <div
              className={`relative flex items-center justify-center shadow-sm border transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_16px_36px_-18px_rgba(255,90,31,0.65)] ${
                isSidebarCollapsed ? 'h-[58px] w-[58px] rounded-[1.15rem]' : 'w-[164px] h-[76px] rounded-[1.75rem]'
              } ${
                isDarkMode
                  ? 'bg-white/8 border-white/10'
                  : 'bg-white/80 border-slate-200/70'
              }`}
            >
              <div
                className={`absolute inset-[1.5px] transition-all duration-300 ${isSidebarCollapsed ? 'rounded-[1rem]' : 'rounded-[1.6rem]'} ${
                  isDarkMode
                    ? 'bg-[#171717]/92'
                    : 'bg-white/92'
                }`}
              ></div>

              <BrandLogo
                variant={isDarkMode ? 'light' : 'dark'}
                size={isSidebarCollapsed ? 'sm' : 'md'}
                className="relative z-10"
                imageClassName={isSidebarCollapsed ? 'w-7 h-7' : 'w-[154px] h-auto'}
              />
            </div>
          </button>
        </div>

        <nav className="mt-5 flex-1 space-y-1.5 px-0 overflow-y-auto no-scrollbar">
          <NavItem icon={<Home size={20} />} label={t('nav_home')} active={activeTab === 'home' || activeTab === 'reports'} onClick={() => setActiveTab('home')} isDarkMode={isDarkMode} collapsed={isSidebarCollapsed} />
          <NavItem icon={<Target size={20} />} label={t('nav_sales')} active={activeTab === 'prospecting'} onClick={() => setActiveTab('prospecting')} isDarkMode={isDarkMode} collapsed={isSidebarCollapsed} />
          <NavItem icon={<Users size={20} />} label={t('nav_dir')} active={activeTab === 'database'} onClick={() => { setActiveTab('database'); setDbSearchTerm(''); }} isDarkMode={isDarkMode} collapsed={isSidebarCollapsed} />
          <NavItem icon={<PlusCircle size={20} />} label={t('nav_add')} active={activeTab === 'add'} onClick={() => setActiveTab('add')} isDarkMode={isDarkMode} collapsed={isSidebarCollapsed} />
          <NavItem icon={<WhatsAppIcon className="h-[25px] w-[25px] shrink-0" />} label="WhatsApp API" active={activeTab === 'whatsapp-api'} onClick={() => setActiveTab('whatsapp-api')} isDarkMode={isDarkMode} collapsed={isSidebarCollapsed} />
          <div className={`my-2 border-t border-slate-100 ${isSidebarCollapsed ? 'mx-4' : 'mx-6'}`}></div>
          <NavItem icon={<Users size={20} />} label={t('nav_team')} active={activeTab === 'network'} onClick={() => setActiveTab('network')} theme="purple" isDarkMode={isDarkMode} collapsed={isSidebarCollapsed} />
        </nav>

        <div className={`mt-auto transition-all duration-300 ${isSidebarCollapsed ? 'px-3' : 'px-6'}`}>
          <div className={`mb-4 flex items-center ${isSidebarCollapsed ? 'flex-col gap-3 px-0' : 'justify-between px-2'}`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
              <AvatarInitials name={currentUser.nombre} size="sm" avatarUrl={currentUser.avatarUrl} isDarkMode={isDarkMode} />
              {!isSidebarCollapsed ? (
                <div className="truncate">
                  <p className="text-sm font-bold text-slate-700 truncate">{currentUser.nombre}</p>
                  <p className="text-[10px] text-slate-400 font-mono">ID: {currentUser.codigoPropio}</p>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={`text-slate-400 hover:text-[#FF5A1F] hover:bg-orange-50 rounded-lg transition-colors focus:outline-none ${isSidebarCollapsed ? 'p-2.5' : 'p-1.5'}`}
              title={t('set_title')}
              aria-label={t('set_title')}
            >
              <Settings size={18} />
            </button>
          </div>
          {adminReturnData ? (
             <button type="button" onClick={handleReturnToAdmin} title={isSidebarCollapsed ? t('app_return_admin') : undefined} aria-label={t('app_return_admin')} className={`flex items-center text-white bg-rose-500 hover:bg-rose-600 transition-colors rounded-xl border border-transparent shadow-md font-bold mb-2 ${isSidebarCollapsed ? 'w-12 h-12 justify-center mx-auto' : 'gap-3 px-4 py-3 w-full justify-center'}`}>
               <LogOut size={18} />
               {!isSidebarCollapsed ? <span className="text-sm">{t('app_return_admin')}</span> : null}
             </button>
          ) : (
             <button type="button" onClick={handleLogout} title={isSidebarCollapsed ? t('nav_logout') : undefined} aria-label={t('nav_logout')} className={`flex items-center text-slate-400 hover:text-slate-600 transition-colors rounded-xl border border-slate-200/50 bg-transparent shadow-sm hover:bg-slate-50/50 ${isSidebarCollapsed ? 'w-12 h-12 justify-center mx-auto' : 'gap-3 px-4 py-3 w-full justify-center'}`}>
               <LogOut size={18} />
               {!isSidebarCollapsed ? <span className="font-medium text-sm">{t('nav_logout')}</span> : null}
             </button>
          )}
        </div>
      </aside>

      <main className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/50">
        <div className={`lg:hidden sticky top-0 z-40 -mt-2 px-4 py-0.5 backdrop-blur-xl ${isDarkMode ? 'border-b border-white/10 bg-[#050505]/92' : 'border-b border-slate-200/70 bg-white/85'}`}>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (currentUser?.rol === 'admin') {
                  setActiveTab('god-panel');
                } else {
                  setActiveTab('home');
                }
                setIsMobileMenuOpen(false);
              }}
              className="flex min-w-0 items-center"
              title={currentUser?.rol === 'admin' ? `${t('god_header_prefix')} ${t('god_header_emphasis')}` : 'Bigdata'}
            >
              <BrandLogo variant={isDarkMode ? 'light' : 'dark'} size="xs" imageClassName="w-[112px] h-auto" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'border-white/10 bg-[#121212] text-slate-300 hover:bg-[#1a1a1a] hover:text-[#FF5A1F]' : 'border-slate-200 bg-white text-slate-500 hover:bg-orange-50 hover:text-[#FF5A1F]'}`}
                title={t('set_title')}
              >
                <Settings size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'border-white/10 bg-[#121212] text-slate-300 hover:bg-[#1a1a1a] hover:text-[#FF5A1F]' : 'border-slate-200 bg-white text-slate-500 hover:bg-orange-50 hover:text-[#FF5A1F]'}`}
                title={t('app_more_options')}
              >
                {isMobileMenuOpen ? <X size={18} /> : <MoreHorizontal size={18} />}
              </button>
            </div>
          </div>

          <div className={`-mt-4 flex items-center gap-3 rounded-2xl px-3 py-2.5 shadow-sm ${isDarkMode ? 'border border-white/10 bg-[#121212]/95' : 'border border-slate-200/80 bg-white/90'}`}>
            <AvatarInitials name={currentUser.nombre} size="sm" avatarUrl={currentUser.avatarUrl} isDarkMode={isDarkMode} />
            <div className="min-w-0">
              <p className={`truncate text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{currentUser.nombre}</p>
              <p className={`truncate text-[10px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ID: {currentUser.codigoPropio}</p>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className={`mt-3 rounded-[1.5rem] p-3 shadow-[0_16px_40px_-22px_rgba(15,23,42,0.35)] ${isDarkMode ? 'border border-white/10 bg-[#0d0d0d]' : 'border border-slate-200 bg-white'}`}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleMobileNavClick(() => setActiveTab('reports'))}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all ${activeTab === 'reports' ? (isDarkMode ? 'bg-orange-500/15 text-[#FF8A57]' : 'bg-orange-50 text-[#FF5A1F]') : (isDarkMode ? 'bg-[#151515] text-slate-300 hover:bg-[#1a1a1a] hover:text-[#FF5A1F]' : 'bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-[#FF5A1F]')}`}
                >
                  {t('dash_metrics')}
                </button>
                <button
                  type="button"
                  onClick={() => handleMobileNavClick(() => setActiveTab('network'))}
                  className={`rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all ${activeTab === 'network' ? (isDarkMode ? 'bg-orange-500/15 text-[#FF8A57]' : 'bg-orange-50 text-[#FF5A1F]') : (isDarkMode ? 'bg-[#151515] text-slate-300 hover:bg-[#1a1a1a] hover:text-[#FF5A1F]' : 'bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-[#FF5A1F]')}`}
                >
                  {t('nav_team')}
                </button>
                {currentUser?.rol === 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleMobileNavClick(() => setActiveTab('god-panel'))}
                    className={`rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all ${activeTab === 'god-panel' ? (isDarkMode ? 'bg-orange-500/15 text-[#FF8A57]' : 'bg-orange-50 text-[#FF5A1F]') : (isDarkMode ? 'bg-[#151515] text-slate-300 hover:bg-[#1a1a1a] hover:text-[#FF5A1F]' : 'bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-[#FF5A1F]')}`}
                  >
                    {t('god_header_prefix')} {t('god_header_emphasis')}
                  </button>
                )}
                {adminReturnData ? (
                  <button
                    type="button"
                    onClick={() => handleMobileNavClick(handleReturnToAdmin)}
                    className="rounded-2xl bg-rose-500 px-4 py-3 text-left text-sm font-bold text-white transition-colors hover:bg-rose-600"
                  >
                    Volver a Admin
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleMobileNavClick(handleLogout)}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-left text-sm font-bold text-white transition-colors hover:bg-slate-800"
                  >
                    {t('nav_logout')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {isViewOnly && (
          <div className="bg-amber-500 text-white text-center py-2 text-xs font-bold w-full z-50 flex justify-center items-center gap-2 shadow-md shrink-0">
            <Eye size={16} /> {t('common_view_only_banner')}
          </div>
        )}
        {activeTab === 'god-panel' && currentUser.rol === 'admin' && (
          <CleanDashboardView
            onImpersonate={handleImpersonate}
            onAdminResetPassword={handleAdminResetUserPassword}
            isDarkMode={isDarkMode}
            records={effectiveAdminRecords}
            duplicateRecords={adminOverview.duplicates}
            usersDb={effectiveAdminUsers}
            sharedLinks={adminOverview.sharedLinks}
            currentUser={currentUser}
            onCreateSharedLink={handleCreateSharedLink}
            t={t}
            language={language}
          />
        )}
        <div className="min-h-0 flex-1 pb-24 lg:pb-0">
        {activeTab === 'home' && <DashboardView records={dashboardDisplayedRecords} allRecords={records} duplicateRecords={duplicateRecords} onSelectRecord={setSelectedRecord} dashboardSectorFilter={dashboardSectorFilter} setDashboardSectorFilter={setDashboardSectorFilter} setActiveTab={setActiveTab} myAgents={myAgents} t={t} currentUser={currentUser} language={language} isDarkMode={isDarkMode} />}
        {activeTab === 'prospecting' && <ProspectingWorkspace records={displayedRecords} onUpdateRecord={handleUpdateRecord} onChangeStatus={handleChangeStatus} onAutoSelect={handleAutoSelectLeads} onArchiveRecord={handleArchiveWorkspaceLead} onRemoveFromWorkspace={handleRemoveFromWorkspaceCompletely} myAgents={myAgents} waTemplate={waTemplate} setWaTemplate={setWaTemplate} t={t} currentUser={currentUser} language={language} isViewOnly={isViewOnly} isDarkMode={isDarkMode} />}
        {activeTab === 'add' && <AddRecordView records={records} duplicateRecords={duplicateRecords} setRecords={setRecords} setActiveTab={setActiveTab} setDuplicateRecords={setDuplicateRecords} t={t} isViewOnly={isViewOnly} currentUser={currentUser} onCreateRecord={handleCreateRecord} onImportRecords={handleImportRecords} />}
        {activeTab === 'database' && <DataTableView records={records} onSelectRecord={setSelectedRecord} searchTerm={dbSearchTerm} setSearchTerm={setDbSearchTerm} setActiveTab={setActiveTab} onUpdateRecord={handleUpdateRecord} onChangeStatus={handleChangeStatus} onBulkChangeStatus={handleBulkChangeStatus} onPermanentDeleteRecords={handlePermanentDeleteRecords} myAgents={myAgents} duplicateRecords={duplicateRecords} onCleanDuplicates={handleCleanDuplicates} onDeleteDuplicates={handleDeleteDuplicates} onRestoreDuplicates={handleRestoreDuplicates} sharedLinks={sharedLinks} t={t} currentUser={currentUser} globalSectorFilter={globalSectorFilter} setGlobalSectorFilter={setGlobalSectorFilter} isDarkMode={isDarkMode} />}
        {activeTab === 'whatsapp-api' && <WhatsAppApiView isDarkMode={isDarkMode} sessionToken={sessionToken} />}
        {activeTab === 'reports' && <ReportsView records={records} duplicateRecords={duplicateRecords} currentUser={currentUser} myAgents={myAgents} usersDb={usersDb} sharedLinks={sharedLinks} t={t} language={language} isDarkMode={isDarkMode} />}
        {activeTab === 'network' && <NetworkView currentUser={currentUser} usersDb={usersDb} sharedLinks={sharedLinks} records={records} onLinkCreated={handleCreateSharedLink} myAgents={myAgents} t={t} isDarkMode={isDarkMode} />}
        </div>
      </main>

        <div className={`lg:hidden fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl ${isDarkMode ? 'border-t border-white/10 bg-[#050505]/94' : 'border-t border-slate-200/70 bg-white/90'}`}>
          <div className="grid grid-cols-5 gap-2">
            {mobilePrimaryNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleMobileNavClick(item.onClick)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-bold transition-all ${
                item.isActive
                  ? item.id === 'database'
                    ? 'bg-gradient-to-r from-violet-600 via-fuchsia-500 to-purple-500 text-white shadow-[0_10px_24px_-14px_rgba(147,51,234,0.55)]'
                    : 'bg-gradient-to-r from-[#FF3C00] via-[#FF7A00] to-[#FFB36B] text-white shadow-[0_10px_24px_-14px_rgba(255,90,31,0.45)]'
                  : isDarkMode
                    ? 'text-slate-400 hover:bg-[#151515] hover:text-[#FF5A1F]'
                    : 'text-slate-500 hover:bg-orange-50 hover:text-[#FF5A1F]'
              }`}
            >
              <span>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedRecord && activeTab !== 'prospecting' && (
        <RecordDetailModal 
          record={selectedRecord} 
          onClose={() => setSelectedRecord(null)} 
          onUpdate={handleUpdateRecord}
          onChangeStatus={handleChangeStatus}
          myAgents={myAgents}
          t={t}
          language={language}
        />
      )}

      {/* Renderizado del Panel de Configuración Global */}
      <SettingsDrawer 
        key={`${currentUser?.id || 'guest'}:${currentUser?.nombre || ''}:${isSettingsOpen ? 'open' : 'closed'}`}
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        currentUser={currentUser} 
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      language={language}
      setLanguage={setLanguage}
      t={t}
      onUpdatePassword={handleUpdatePassword}
      onUpdateProfile={handleUpdateProfileWithPulse}
      onOpenAdminPanel={() => setActiveTab('god-panel')}
      />
    </div>
  );
}

// --- COMPONENTES FALTANTES AÑADIDOS ---

function CleanDashboardView({
  onImpersonate,
  onAdminResetPassword,
  isDarkMode,
  records = [],
  duplicateRecords = [],
  usersDb = [],
  sharedLinks = [],
  currentUser = null,
  onCreateSharedLink,
  t,
  language = 'es',
}) {
  const [selectedManagerId, setSelectedManagerId] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [showGlobalLeadsModal, setShowGlobalLeadsModal] = useState(false);
  const [globalLeadSearchTerm, setGlobalLeadSearchTerm] = useState('');
  const [globalLeadTab, setGlobalLeadTab] = useState('all');
  const [globalLeadPage, setGlobalLeadPage] = useState(1);
  const [shareTargetSearch, setShareTargetSearch] = useState('');
  const [selectedShareTargetId, setSelectedShareTargetId] = useState('');
  const [selectedGlobalShareIds, setSelectedGlobalShareIds] = useState([]);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const locale = LANG_LOCALES[language] || LANG_LOCALES.en;
  const fmt = (key, values = {}) =>
    Object.entries(values).reduce((acc, [entryKey, entryValue]) => acc.replaceAll(`{${entryKey}}`, String(entryValue)), t(key));
  const globalRecords = useMemo(() => [...records, ...duplicateRecords], [duplicateRecords, records]);
  const totalLeads = globalRecords.length;
  const contactados = globalRecords.filter(r => r.mensajeEnviado).length;

  // Nuevas métricas globales
  const totalUsuarios = usersDb.length;
  const enProspeccion = globalRecords.filter(r => r.estadoProspeccion === 'En prospección' || r.inProspecting).length;

  // --- NUEVO: GRÁFICO EVOLUCIÓN DE CAPTACIÓN (GLOBAL) ---
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return getLocalISODate(d);
  });

  const trendData = last7Days.map(dateStr => {
    const count = globalRecords.filter(r => r.fechaIngreso === dateStr).length;
    const dObj = new Date(`${dateStr}T12:00:00`); // 12 PM local para evitar desfases
    const label = dObj.toLocaleDateString(locale, { weekday: 'short' });
    return { date: dateStr, label: label.charAt(0).toUpperCase() + label.slice(1), count };
  });

  const maxTrend = Math.max(...trendData.map(d => d.count), 1);
  const tendenciaHoy = trendData[6].count;
  const tendenciaAyer = trendData[5].count;
  const tendenciaCrecimiento = tendenciaAyer === 0 ? (tendenciaHoy > 0 ? 100 : 0) : Math.round(((tendenciaHoy - tendenciaAyer) / tendenciaAyer) * 100);

  const trendPts = trendData.map((d, i) => {
      const x = i * (100 / 6); // De 0 a 100
      const y = 35 - (d.count / maxTrend) * 25; // Altura del área de 10 a 35
      return { x, y, label: d.label, count: d.count };
  });

  const createSmoothPath = (pts) => {
      if (pts.length === 0) return '';
      let d = `M ${pts[0].x},${pts[0].y} `;
      for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1];
          const curr = pts[i];
          const cpX = (prev.x + curr.x) / 2;
          d += `C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y} `;
      }
      return d;
  };

  const pathD = createSmoothPath(trendPts);
  const areaD = `${pathD} L 100,40 L 0,40 Z`;

  // --- NUEVO: DATOS REALES PARA COMPORTAMIENTO TOTAL ---
  const last12Days = Array.from({length: 12}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (11 - i));
    return getLocalISODate(d);
  });
  
  const last12DaysData = last12Days.map(dateStr => globalRecords.filter(r => r.fechaIngreso === dateStr).length);
  const max12Dist = Math.max(...last12DaysData, 1);

  const catA = globalRecords.filter(r => r.categoria === 'A').length;
  const catB = globalRecords.filter(r => r.categoria === 'B').length;
  const catC = globalRecords.filter(r => r.categoria === 'C').length;
  const usuariosOperativos = useMemo(
    () => mergeUniqueUsers(usersDb).filter((user) => user.email !== 'admin@bigdata.com'),
    [usersDb],
  );
  const userNameById = new Map(usersDb.map((user) => [user.id, user.nombre]));
  const userCodeById = new Map(usersDb.map((user) => [user.id, user.codigoPropio || '']));
  const adminWorkspaceId = currentUser?.workspaceId || 'WS-U1';
  const sharedSourceIds = useMemo(
    () => new Set(globalRecords.map((record) => record.sourceRecordId).filter(Boolean)),
    [globalRecords],
  );
  const globalLeadRows = useMemo(
    () =>
      [...globalRecords].sort(
        (a, b) =>
          new Date(b.fechaIngreso || b.fechaCreacion || 0).getTime() -
          new Date(a.fechaIngreso || a.fechaCreacion || 0).getTime(),
      ),
    [globalRecords],
  );
  const shareableGlobalLeadRows = useMemo(
    () =>
      [...records]
        .filter((record) => {
          const status = record.estadoProspeccion || 'Nuevo';
          return (
            record.workspaceId === adminWorkspaceId &&
            !record.sourceRecordId &&
            status === 'Nuevo' &&
            !sharedSourceIds.has(record.id)
          );
        })
        .sort(
          (a, b) =>
            new Date(b.fechaIngreso || b.fechaCreacion || 0).getTime() -
            new Date(a.fechaIngreso || a.fechaCreacion || 0).getTime(),
        ),
    [adminWorkspaceId, records, sharedSourceIds],
  );
  const liquidatedGlobalLeadRows = useMemo(
    () =>
      globalLeadRows.filter(
        (record) => (record.estadoProspeccion || '') === 'Liquidado',
      ),
    [globalLeadRows],
  );
  const sharedHistoryRows = [...sharedLinks]
    .map((link) => ({
      ...link,
      teamMemberCode:
        link.teamMemberCode ||
        userCodeById.get(link.teamMemberId) ||
        '',
    }))
    .sort(
      (a, b) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    );
  const userRows = usuariosOperativos
    .map((user) => {
      const workspaceScopedRecords = globalRecords.filter(
        (record) => record.workspaceId === user.workspaceId,
      );
      const userRecords = globalRecords.filter(
        (record) =>
          record.workspaceId === user.workspaceId ||
          record.propietarioId === user.id ||
          record.responsable === user.nombre,
      );
      const userContacted = userRecords.filter((record) => record.mensajeEnviado).length;
      const userProspecting = userRecords.filter((record) => record.estadoProspeccion === 'En prospección' || record.inProspecting).length;
      const userArchived = userRecords.filter((record) => record.estadoProspeccion === 'Archivado' || record.isArchived).length;
      const representedLeadIds = new Set(
        userRecords.flatMap((record) => [record.id, record.sourceRecordId].filter(Boolean)),
      );
      const pendingSharedLeadCount = sharedHistoryRows.reduce((total, link) => {
        const isForUser =
          link.teamMemberId === user.id ||
          (link.teamMemberCode && link.teamMemberCode === user.codigoPropio) ||
          (link.teamMemberName &&
            link.teamMemberName.trim().toLowerCase() === user.nombre.trim().toLowerCase());

        if (!isForUser) return total;

        const uniquePendingIds = Array.isArray(link.sourceRecordIds)
          ? [...new Set(link.sourceRecordIds.filter((sourceId) => !representedLeadIds.has(sourceId)))]
          : [];

        if (uniquePendingIds.length > 0) return total + uniquePendingIds.length;

        const fallbackCount = Number(link.count);
        return total + (Number.isFinite(fallbackCount) ? fallbackCount : 0);
      }, 0);
      const derivedWorkspaceCount = Math.max(
        workspaceScopedRecords.length,
        userRecords.length,
        userRecords.length + pendingSharedLeadCount,
      );
      const leadsWorkspace = derivedWorkspaceCount;

      return {
        ...user,
        totalLeads: userRecords.length,
        leadsWorkspace,
        contactados: userContacted,
        prospeccion: userProspecting,
        archivados: userArchived,
      };
    })
    .sort((a, b) => b.leadsWorkspace - a.leadsWorkspace || b.contactados - a.contactados);
  const filteredGlobalLeadRows = (() => {
    const needle = globalLeadSearchTerm.trim().toLowerCase();
    const sourceRows =
      globalLeadTab === 'shareable'
        ? shareableGlobalLeadRows
        : globalLeadTab === 'shared'
          ? sharedHistoryRows
          : globalLeadTab === 'liquidated'
            ? liquidatedGlobalLeadRows
            : globalLeadRows;

    if (!needle) return sourceRows;

    if (globalLeadTab === 'shared') {
      return sourceRows.filter((link) => {
        const haystack = [
          link.teamMemberName,
          link.teamMemberCode,
          link.hash,
          link.count,
          link.date,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(needle);
      });
    }

    return sourceRows.filter((record) => {
      const ownerName =
        userNameById.get(record.propietarioId) ||
        record.responsable ||
        record.workspaceId ||
        '';
      const haystack = [
        record.id,
        record.nombre,
        record.numero,
        record.correo,
        record.estadoProspeccion,
        ownerName,
        record.sector,
        record.origen,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  })();
  const filteredShareTargets = (() => {
    const needle = shareTargetSearch.trim().toLowerCase();
    if (!needle) return usuariosOperativos;

    return usuariosOperativos.filter((user) => {
      const haystack = [
        user.nombre,
        user.email,
        user.codigoPropio,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  })();
  const filteredUserRows = (() => {
    const needle = userSearchTerm.trim().toLowerCase();
    if (!needle) return userRows;

    return userRows.filter((user) => {
      const haystack = [
        user.nombre,
        user.email,
        user.codigoPropio,
        user.referidoPor,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  })();
  const USER_PAGE_SIZE = 4;
  const totalUserPages = Math.max(1, Math.ceil(filteredUserRows.length / USER_PAGE_SIZE));
  const safeUserPage = Math.min(userPage, totalUserPages);
  const paginatedUserRows = (() => {
    const startIndex = (safeUserPage - 1) * USER_PAGE_SIZE;
    return filteredUserRows.slice(startIndex, startIndex + USER_PAGE_SIZE);
  })();
  useEffect(() => {
    if (userPage !== safeUserPage) {
      setUserPage(safeUserPage);
    }
  }, [safeUserPage, userPage]);
  const topManagers = userRows.slice(0, 3);
  const usuariosConBase = userRows.filter((user) => user.leadsWorkspace > 0).length;
  const topCountries = useMemo(() => {
    const countryMetaByCode = new Map(PAISES.map((country) => [country.code, country]));
    const countryCounts = globalRecords.reduce((acc, record) => {
      const rawCode = String(record.pais || record.country || '').trim().toUpperCase();
      const code = rawCode || 'OT';
      acc.set(code, (acc.get(code) || 0) + 1);
      return acc;
    }, new Map());

    return [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => {
        const meta = countryMetaByCode.get(code);
        return {
          code,
          count,
          nombre: meta?.nombre || 'Sin país',
          flag: meta?.flag || '🌐',
        };
      });
  }, [globalRecords]);
  const GLOBAL_LEADS_PAGE_SIZE = 100;
  const totalGlobalLeadPages = Math.max(1, Math.ceil(filteredGlobalLeadRows.length / GLOBAL_LEADS_PAGE_SIZE));
  const safeGlobalLeadPage = Math.min(globalLeadPage, totalGlobalLeadPages);
  const paginatedGlobalLeadRows = (() => {
    const startIndex = (safeGlobalLeadPage - 1) * GLOBAL_LEADS_PAGE_SIZE;
    return filteredGlobalLeadRows.slice(startIndex, startIndex + GLOBAL_LEADS_PAGE_SIZE);
  })();
  const selectedShareTarget =
    filteredShareTargets.find((user) => user.id === selectedShareTargetId) ||
    usuariosOperativos.find((user) => user.id === selectedShareTargetId) ||
    null;
  const validSelectedGlobalShareIds = useMemo(
    () =>
      selectedGlobalShareIds.filter((id) =>
        shareableGlobalLeadRows.some((record) => record.id === id),
      ),
    [selectedGlobalShareIds, shareableGlobalLeadRows],
  );
  const selectedGlobalShareCount = validSelectedGlobalShareIds.length;
  const visibleShareableIds =
    globalLeadTab === 'shareable'
      ? paginatedGlobalLeadRows.map((record) => record.id)
      : [];
  const allVisibleShareableSelected =
    visibleShareableIds.length > 0 &&
    visibleShareableIds.every((id) => validSelectedGlobalShareIds.includes(id));
  const countryNameByCode = useMemo(
    () =>
      new Map(
        PAISES.flatMap((country) => [
          [country.code, country.nombre],
          [country.prefix, country.nombre],
        ]),
      ),
    [],
  );

  const handleToggleGlobalShareLead = (recordId) => {
    setSelectedGlobalShareIds((prev) =>
      prev.includes(recordId) ? prev.filter((id) => id !== recordId) : [...prev, recordId],
    );
  };

  const handleToggleVisibleShareableLeads = () => {
    if (visibleShareableIds.length === 0) return;

    setSelectedGlobalShareIds((prev) => {
      if (allVisibleShareableSelected) {
        return prev.filter((id) => !visibleShareableIds.includes(id));
      }

      return [...new Set([...prev, ...visibleShareableIds])];
    });
  };

  const handleShareFromGlobalBase = () => {
    if (!selectedShareTarget || selectedGlobalShareCount === 0 || typeof onCreateSharedLink !== 'function') {
      return;
    }

    const selectedRecords = shareableGlobalLeadRows.filter((record) => validSelectedGlobalShareIds.includes(record.id));
    if (selectedRecords.length === 0) return;
    const sourceRecordIds = selectedRecords.map((record) => record.id);
    const linkSeed = `${selectedShareTarget.id}-${sourceRecordIds[0] || 'base'}-${sourceRecordIds.length}-${sharedLinks.length + 1}`;
    const compactHash = linkSeed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'sharedlink';

    const newLink = {
      id: `link-${linkSeed}`,
      hash: compactHash,
      date: new Date().toISOString(),
      count: selectedRecords.length,
      teamMemberId: selectedShareTarget.id,
      teamMemberName: selectedShareTarget.nombre,
      teamMemberCode: selectedShareTarget.codigoPropio || null,
      sourceRecordIds,
      metrics: { viewed: 0, worked: 0, contacted: 0 },
    };

    onCreateSharedLink(newLink, selectedRecords.map((record) => record.id), {
      id: selectedShareTarget.id,
      name: selectedShareTarget.nombre,
    });

    setSelectedGlobalShareIds([]);
    setGlobalLeadTab('shared');
    setGlobalLeadSearchTerm('');
  };

  const handleOpenResetPassword = (user) => {
    setResetPasswordUser(user);
    setResetPasswordValue('');
    setResetPasswordConfirm('');
    setResetPasswordError('');
  };

  const handleCloseResetPassword = () => {
    if (isResettingPassword) return;
    setResetPasswordUser(null);
    setResetPasswordValue('');
    setResetPasswordConfirm('');
    setResetPasswordError('');
  };

  const handleSubmitResetPassword = async () => {
    if (!resetPasswordUser || typeof onAdminResetPassword !== 'function') {
      return;
    }

    if (resetPasswordValue.length < 6) {
      setResetPasswordError(t('god_reset_password_error_min'));
      return;
    }

    if (resetPasswordValue !== resetPasswordConfirm) {
      setResetPasswordError(t('god_reset_password_error_match'));
      return;
    }

    setIsResettingPassword(true);
    setResetPasswordError('');

    const result = await onAdminResetPassword(resetPasswordUser.id, resetPasswordValue);

    if (!result?.ok) {
      setResetPasswordError(result?.error || t('settings_error_update_password'));
      setIsResettingPassword(false);
      return;
    }

    setIsResettingPassword(false);
    handleCloseResetPassword();
  };

  const handleDownloadGlobalLeadsCsv = () => {
    const todayStamp = getLocalISODate(new Date());
    const tabLabelMap = {
      all: 'todos',
      shareable: 'disponibles',
      shared: 'compartidos',
      liquidated: 'liquidados',
    };

    if (globalLeadTab === 'shared') {
      const headers = [
        'Entrega ID',
        'Usuario destino',
        'Codigo usuario',
        'Leads entregados',
        'Fecha',
        'Hash',
        'Vistos',
        'Trabajados',
        'Contactados',
        'Source Record IDs',
      ];

      const rows = filteredGlobalLeadRows.map((link) => [
        link.id || '',
        link.teamMemberName || 'Sin asignar',
        link.teamMemberCode || '',
        link.count || 0,
        link.date ? new Date(link.date).toLocaleString(locale) : '',
        link.hash || '',
        link.metrics?.viewed || 0,
        link.metrics?.worked || 0,
        link.metrics?.contacted || 0,
        Array.isArray(link.sourceRecordIds) ? link.sourceRecordIds.join(' | ') : '',
      ]);

      downloadCsvFile(
        `base-global-${tabLabelMap[globalLeadTab] || 'leads'}-${todayStamp}.csv`,
        headers,
        rows,
      );
      return;
    }

    const headers = [
      'ID',
      'Nombre',
      'Usuario',
      'Workspace',
      'Propietario ID',
      'Responsable',
      'Telefono',
      'Correo',
      'Estado',
      'Sector',
      'Origen',
      'Pais',
      'Ingreso',
      'Compartido',
      'Source Record ID',
    ];

    const rows = filteredGlobalLeadRows.map((record) => {
      const ownerLabel =
        userNameById.get(record.propietarioId) ||
        record.responsable ||
        'Sin asignar';
      const rawCountry = String(record.pais || record.country || '').trim().toUpperCase();
      const countryName =
        countryNameByCode.get(rawCountry) ||
        countryNameByCode.get(PREFIX_TO_ISO[rawCountry]) ||
        rawCountry ||
        'Sin pais';

      return [
        record.id || '',
        record.nombre || 'Sin nombre',
        ownerLabel,
        record.workspaceId || '',
        record.propietarioId || '',
        record.responsable || '',
        record.numero || '',
        record.correo || '',
        record.estadoProspeccion || 'Nuevo',
        record.sector || 'Sin sector',
        record.origen || '',
        countryName,
        record.fechaIngreso ? new Date(record.fechaIngreso).toLocaleDateString(locale) : '',
        record.isShared ? 'Si' : 'No',
        record.sourceRecordId || '',
      ];
    });

    downloadCsvFile(
      `base-global-${tabLabelMap[globalLeadTab] || 'leads'}-${todayStamp}.csv`,
      headers,
      rows,
    );
  };

  return (
    <div className={`relative flex h-full w-full flex-col overflow-y-auto bg-[#f0f2f5] font-sans text-slate-800 no-scrollbar ${isDarkMode ? 'dark-mode' : ''}`}>
      <style>{`
        /* INYECCIÓN DEL MODO OSCURO PARA EL CLEAN WORKSPACE */
        .dark-mode { background-color: #0a0a0a !important; color: #f5f5f5 !important; }
        .dark-mode .bg-white { background-color: #171717 !important; }
        .dark-mode .text-slate-800 { color: #fafafa !important; }
        .dark-mode .text-slate-500 { color: #a3a3a3 !important; }
        .dark-mode .border-slate-100 { border-color: #262626 !important; }
        .glass-badge { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); }
      `}</style>
      
      {/* Header Estilo Dashboard Reference */}
      <header className="glass-panel sticky top-0 z-50 flex items-center justify-between border-b border-white/40 px-4 py-4 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.28)] sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-4">
          <BrandLogo variant={isDarkMode ? 'light' : 'dark'} size="xs" />
          <div>
            <h2 className="text-sm uppercase tracking-[0.2em] text-slate-700"><span className="font-light">{t('god_header_prefix')}</span> <span className="font-black">{t('god_header_emphasis')}</span></h2>
            <p className="hidden text-xs text-slate-400 sm:block">{t('god_header_subtitle')}</p>
          </div>
        </div>
      </header>

      {/* Grid Principal Inspirado en el Diseño */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-5 p-4 sm:p-6 md:space-y-6 md:p-8">
        {showGlobalLeadsModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setShowGlobalLeadsModal(false)}></div>
            <div className={`relative z-10 flex h-[min(85vh,860px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-[2rem] border shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)] ${
              isDarkMode ? 'border-white/10 bg-[#111214]' : 'border-white/70 bg-white'
            }`}>
              <div className={`flex flex-col gap-4 border-b px-5 py-5 sm:px-6 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-100 bg-slate-50/70'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Base global de leads</h3>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Revisa toda la base, comparte leads raíz no entregados todavía y mantén separado lo ya compartido.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGlobalLeadsModal(false)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                      isDarkMode ? 'border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-white' : 'border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="relative w-full xl:max-w-sm">
                    <Search size={16} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      value={globalLeadSearchTerm}
                      onChange={(event) => {
                        setGlobalLeadSearchTerm(event.target.value);
                        setGlobalLeadPage(1);
                      }}
                      placeholder={globalLeadTab === 'shared' ? 'Buscar entrega, usuario o código' : 'Buscar lead, ID, usuario, correo o teléfono'}
                      className={`w-full rounded-full border py-3 pl-11 pr-4 text-sm outline-none transition-all ${
                        isDarkMode
                          ? 'border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500 focus:border-white/20'
                          : 'border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:border-slate-300'
                      }`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'shareable', label: 'Disponibles' },
                      { id: 'shared', label: 'Compartidos' },
                      { id: 'liquidated', label: 'Liquidados' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setGlobalLeadTab(tab.id);
                          setGlobalLeadPage(1);
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                          globalLeadTab === tab.id
                            ? isDarkMode
                              ? 'border-orange-400/20 bg-orange-500/10 text-orange-300'
                              : 'border-orange-100 bg-orange-50 text-[#FF5A1F]'
                            : isDarkMode
                              ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                    <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      isDarkMode ? 'border-white/10 bg-white/[0.04] text-slate-300' : 'border-slate-200 bg-white text-slate-600'
                    }`}>
                      {filteredGlobalLeadRows.length} {globalLeadTab === 'shared' ? 'entregas' : 'leads'}
                    </span>
                    <span className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      isDarkMode ? 'border-orange-400/20 bg-orange-500/10 text-orange-300' : 'border-orange-100 bg-orange-50 text-[#FF5A1F]'
                    }`}>
                      {safeGlobalLeadPage}/{totalGlobalLeadPages}
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadGlobalLeadsCsv}
                      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-black transition-all ${
                        isDarkMode
                          ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
                          : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <Download size={14} />
                      Descargar CSV
                    </button>
                  </div>
                </div>

                {globalLeadTab === 'shareable' && (
                  <div className={`grid gap-3 rounded-[1.6rem] border p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)_auto] ${isDarkMode ? 'border-emerald-400/15 bg-emerald-500/10' : 'border-emerald-100 bg-emerald-50/70'}`}>
                    <div className="space-y-2">
                      <p className={`text-xs font-black uppercase tracking-[0.18em] ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                        Reparto global
                      </p>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        Comparte solo leads raíz nuevos que todavía no han sido entregados a otro workspace.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={15} className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                        <input
                          type="text"
                          value={shareTargetSearch}
                          onChange={(event) => setShareTargetSearch(event.target.value)}
                          placeholder="Buscar usuario o código"
                          className={`w-full rounded-full border py-2.5 pl-10 pr-4 text-sm outline-none transition-all ${
                            isDarkMode
                              ? 'border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500'
                              : 'border-slate-200 bg-white text-slate-700 placeholder:text-slate-400'
                          }`}
                        />
                      </div>
                      <select
                          value={selectedShareTarget?.id || ''}
                        onChange={(event) => setSelectedShareTargetId(event.target.value)}
                        className={`w-full rounded-full border px-4 py-2.5 text-sm font-medium outline-none ${
                          isDarkMode
                            ? 'border-white/10 bg-white/[0.04] text-white'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <option value="">Selecciona usuario destino</option>
                        {filteredShareTargets.map((user) => (
                          <option key={`global-share-target-${user.id}`} value={user.id}>
                            {user.nombre} · {user.codigoPropio || user.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col items-stretch gap-2">
                      <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${isDarkMode ? 'bg-white/[0.05] text-white' : 'bg-white text-slate-700'}`}>
                        {selectedGlobalShareCount} seleccionados
                      </div>
                      <button
                        type="button"
                        onClick={handleShareFromGlobalBase}
                        disabled={!selectedShareTarget || selectedGlobalShareCount === 0}
                        className={`rounded-2xl px-4 py-3 text-sm font-black transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                          isDarkMode
                            ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                            : 'bg-gradient-to-r from-[#00B67A] to-[#34D399] text-white shadow-[0_20px_40px_-24px_rgba(16,185,129,0.55)]'
                        }`}
                      >
                        Compartir {selectedGlobalShareCount > 0 ? selectedGlobalShareCount : ''} leads
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-6">
                {globalLeadTab === 'shared' ? (
                  <div className="space-y-3">
                    {paginatedGlobalLeadRows.length === 0 ? (
                      <div className={`mt-2 rounded-[1.5rem] border border-dashed px-5 py-10 text-center text-sm ${
                        isDarkMode ? 'border-white/10 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}>
                        No hay entregas compartidas con ese filtro.
                      </div>
                    ) : (
                      paginatedGlobalLeadRows.map((link) => (
                        <div
                          key={`shared-history-${link.id}`}
                          className={`rounded-[1.5rem] border p-4 ${
                            isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-100 bg-slate-50/80'
                          }`}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={`truncate text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                  {link.teamMemberName || 'Pool compartido'}
                                </p>
                                {link.teamMemberCode && (
                                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                    isDarkMode ? 'bg-white/[0.06] text-slate-300' : 'bg-white text-slate-500'
                                  }`}>
                                    {link.teamMemberCode}
                                  </span>
                                )}
                              </div>
                              <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {link.count || 0} leads · {link.date ? new Date(link.date).toLocaleString(locale) : '--'}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${isDarkMode ? 'bg-white/[0.05] text-slate-300' : 'bg-white text-slate-600'}`}>
                                {link.metrics?.viewed || 0} vistos
                              </span>
                              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${isDarkMode ? 'bg-orange-500/10 text-orange-300' : 'bg-orange-50 text-[#FF5A1F]'}`}>
                                {link.metrics?.worked || 0} trabajados
                              </span>
                              <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                                {link.metrics?.contacted || 0} contactados
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <>
                    <div className="hidden min-w-[1000px] overflow-hidden rounded-[1.5rem] border md:block">
                      <table className="w-full border-collapse text-left">
                        <thead className={isDarkMode ? 'bg-white/[0.04]' : 'bg-slate-50/80'}>
                          <tr className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                            {globalLeadTab === 'shareable' && (
                              <th className="w-14 px-4 py-4">
                                <button
                                  type="button"
                                  onClick={handleToggleVisibleShareableLeads}
                                  className={`flex h-5 w-5 items-center justify-center rounded border transition-all ${
                                    allVisibleShareableSelected
                                      ? isDarkMode
                                        ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                                        : 'border-emerald-500 bg-emerald-500 text-white'
                                      : isDarkMode
                                        ? 'border-white/15 text-slate-400'
                                        : 'border-slate-300 text-slate-400'
                                  }`}
                                >
                                  {allVisibleShareableSelected && <Check size={12} />}
                                </button>
                              </th>
                            )}
                            <th className="px-4 py-4">Lead</th>
                            <th className="px-4 py-4">Usuario</th>
                            <th className="px-4 py-4">Contacto</th>
                            <th className="px-4 py-4">Estado</th>
                            <th className="px-4 py-4">Sector</th>
                            <th className="px-4 py-4 text-right">Ingreso</th>
                          </tr>
                        </thead>
                        <tbody className={isDarkMode ? 'divide-y divide-white/10' : 'divide-y divide-slate-100'}>
                          {paginatedGlobalLeadRows.map((record) => {
                            const ownerLabel =
                              userNameById.get(record.propietarioId) ||
                              record.responsable ||
                              'Sin asignar';
                            const isSelected = validSelectedGlobalShareIds.includes(record.id);
                            return (
                              <tr key={record.id} className={isDarkMode ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/60'}>
                                {globalLeadTab === 'shareable' && (
                                  <td className="px-4 py-4 align-top">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleGlobalShareLead(record.id)}
                                      className={`flex h-5 w-5 items-center justify-center rounded border transition-all ${
                                        isSelected
                                          ? isDarkMode
                                            ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                                            : 'border-emerald-500 bg-emerald-500 text-white'
                                          : isDarkMode
                                            ? 'border-white/15 text-slate-400'
                                            : 'border-slate-300 text-slate-400'
                                      }`}
                                    >
                                      {isSelected && <Check size={12} />}
                                    </button>
                                  </td>
                                )}
                                <td className="px-4 py-4 align-top">
                                  <div className="min-w-0">
                                    <p className={`truncate text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{record.nombre || 'Sin nombre'}</p>
                                    <p className={`mt-1 truncate font-mono text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{record.id}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                    isDarkMode ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-100 text-slate-600'
                                  }`}>{ownerLabel}</span>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <div className="text-sm">
                                    <p className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{record.numero || '-'}</p>
                                    <p className={`mt-1 truncate text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{record.correo || 'Sin correo'}</p>
                                  </div>
                                </td>
                                <td className="px-4 py-4 align-top">
                                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                    record.estadoProspeccion === 'Descartado'
                                      ? isDarkMode ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-600'
                                      : record.estadoProspeccion === 'Liquidado'
                                        ? isDarkMode ? 'bg-slate-500/20 text-slate-200' : 'bg-slate-100 text-slate-700'
                                      : record.estadoProspeccion === 'Archivado'
                                        ? isDarkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-600'
                                        : record.estadoProspeccion === 'En prospección'
                                          ? isDarkMode ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-600'
                                          : isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                                  }`}>
                                    {record.estadoProspeccion || 'Nuevo'}
                                  </span>
                                </td>
                                <td className={`px-4 py-4 align-top text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                  {record.sector || 'Sin sector'}
                                </td>
                                <td className={`px-4 py-4 text-right align-top text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {record.fechaIngreso ? new Date(record.fechaIngreso).toLocaleDateString(locale) : '--/--/----'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-3 md:hidden">
                      {paginatedGlobalLeadRows.map((record) => {
                        const ownerLabel =
                          userNameById.get(record.propietarioId) ||
                          record.responsable ||
                          'Sin asignar';
                        const isSelected = validSelectedGlobalShareIds.includes(record.id);
                        return (
                          <div key={`mobile-global-lead-${record.id}`} className={`rounded-[1.5rem] border p-4 ${
                            isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-100 bg-slate-50'
                          }`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`truncate text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{record.nombre || 'Sin nombre'}</p>
                                <p className={`mt-1 truncate font-mono text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{record.id}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                  isDarkMode ? 'bg-white/[0.05] text-slate-300' : 'bg-white text-slate-600'
                                }`}>{ownerLabel}</span>
                                {globalLeadTab === 'shareable' && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleGlobalShareLead(record.id)}
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                                      isSelected
                                        ? isDarkMode
                                          ? 'border-emerald-400 bg-emerald-400 text-slate-950'
                                          : 'border-emerald-500 bg-emerald-500 text-white'
                                        : isDarkMode
                                          ? 'border-white/15 text-slate-400'
                                          : 'border-slate-300 text-slate-400'
                                    }`}
                                  >
                                    {isSelected && <Check size={12} />}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                              <div className={`rounded-xl p-2 ${isDarkMode ? 'bg-black/10 text-slate-300' : 'bg-white text-slate-600'}`}>{record.numero || '-'}</div>
                              <div className={`rounded-xl p-2 ${isDarkMode ? 'bg-black/10 text-slate-300' : 'bg-white text-slate-600'}`}>{record.sector || 'Sin sector'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {paginatedGlobalLeadRows.length === 0 && (
                      <div className={`mt-2 rounded-[1.5rem] border border-dashed px-5 py-10 text-center text-sm ${
                        isDarkMode ? 'border-white/10 bg-white/[0.03] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}>
                        {globalLeadTab === 'shareable'
                          ? 'No hay leads nuevos disponibles para compartir con este filtro.'
                          : globalLeadTab === 'liquidated'
                            ? 'No hay leads liquidados con este filtro.'
                          : 'No se encontraron leads con ese filtro.'}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 sm:px-6 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-100 bg-slate-50/70'}`}>
                <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {filteredGlobalLeadRows.length === 0
                    ? `Mostrando 0 ${globalLeadTab === 'shared' ? 'entregas' : 'leads'}`
                    : `Mostrando ${(safeGlobalLeadPage - 1) * GLOBAL_LEADS_PAGE_SIZE + 1}-${Math.min(safeGlobalLeadPage * GLOBAL_LEADS_PAGE_SIZE, filteredGlobalLeadRows.length)} de ${filteredGlobalLeadRows.length} ${globalLeadTab === 'shared' ? 'entregas' : 'leads'}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGlobalLeadPage(Math.max(1, safeGlobalLeadPage - 1))}
                    disabled={safeGlobalLeadPage === 1}
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                      isDarkMode ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    Anterior
                  </button>
                  <div className={`rounded-full px-3 py-2 text-xs font-black ${isDarkMode ? 'bg-white/[0.08] text-white' : 'bg-slate-900 text-white'}`}>
                    {safeGlobalLeadPage}/{totalGlobalLeadPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => setGlobalLeadPage(Math.min(totalGlobalLeadPages, safeGlobalLeadPage + 1))}
                    disabled={safeGlobalLeadPage === totalGlobalLeadPages}
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                      isDarkMode ? 'border-orange-400/20 bg-orange-500/10 text-orange-300 hover:bg-orange-500/15' : 'border-orange-100 bg-orange-50 text-[#FF5A1F] hover:bg-orange-100'
                    }`}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {resetPasswordUser && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
              onClick={handleCloseResetPassword}
            ></div>
            <div
              className={`relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border shadow-[0_30px_80px_-30px_rgba(15,23,42,0.45)] ${
                isDarkMode ? 'border-white/10 bg-[#111214]' : 'border-white/70 bg-white'
              }`}
            >
              <div className={`border-b px-5 py-5 sm:px-6 ${isDarkMode ? 'border-white/10 bg-white/[0.03]' : 'border-slate-100 bg-slate-50/70'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      {t('god_reset_password_title')}
                    </h3>
                    <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('god_reset_password_desc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseResetPassword}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                      isDarkMode ? 'border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-white' : 'border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
                <div>
                  <p className={`mb-1 text-[11px] font-bold uppercase tracking-[0.16em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('god_reset_password_user')}
                  </p>
                  <div className={`rounded-[1.25rem] border px-4 py-3 text-sm font-bold ${isDarkMode ? 'border-white/10 bg-white/[0.04] text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
                    {resetPasswordUser.nombre}
                  </div>
                </div>

                <div>
                  <p className={`mb-1 text-[11px] font-bold uppercase tracking-[0.16em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('god_reset_password_new')}
                  </p>
                  <input
                    type="password"
                    value={resetPasswordValue}
                    onChange={(event) => {
                      setResetPasswordValue(event.target.value);
                      if (resetPasswordError) setResetPasswordError('');
                    }}
                    className={`w-full rounded-[1.25rem] border px-4 py-3 text-sm outline-none transition-all ${
                      isDarkMode
                        ? 'border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500 focus:border-orange-400/40 focus:bg-white/[0.06]'
                        : 'border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-100'
                    }`}
                    placeholder="******"
                  />
                </div>

                <div>
                  <p className={`mb-1 text-[11px] font-bold uppercase tracking-[0.16em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('god_reset_password_confirm')}
                  </p>
                  <input
                    type="password"
                    value={resetPasswordConfirm}
                    onChange={(event) => {
                      setResetPasswordConfirm(event.target.value);
                      if (resetPasswordError) setResetPasswordError('');
                    }}
                    className={`w-full rounded-[1.25rem] border px-4 py-3 text-sm outline-none transition-all ${
                      isDarkMode
                        ? 'border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500 focus:border-orange-400/40 focus:bg-white/[0.06]'
                        : 'border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:border-orange-200 focus:bg-white focus:ring-2 focus:ring-orange-100'
                    }`}
                    placeholder="******"
                  />
                </div>

                {resetPasswordError && (
                  <div className={`rounded-[1.1rem] border px-4 py-3 text-sm font-medium ${
                    isDarkMode ? 'border-orange-400/20 bg-orange-500/10 text-orange-300' : 'border-orange-100 bg-orange-50 text-[#FF5A1F]'
                  }`}>
                    {resetPasswordError}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseResetPassword}
                    className={`rounded-full border px-4 py-2.5 text-xs font-bold transition-all ${
                      isDarkMode ? 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    {t('common_cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitResetPassword}
                    disabled={isResettingPassword}
                    className="rounded-full bg-[linear-gradient(135deg,#FF4B00,#FF7A00_55%,#FFB36B)] px-5 py-2.5 text-xs font-black text-white shadow-[0_16px_32px_-18px_rgba(255,90,31,0.55)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isResettingPassword ? `${t('common_save')}...` : t('god_reset_password_submit')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Fila Superior */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.65fr)_minmax(320px,0.95fr)] xl:items-stretch xl:gap-6">

          <div className="relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-orange-500"></div>
                <h3 className="text-sm font-bold text-slate-700">{t('god_behavior_total')}</h3>
              </div>
              <MoreHorizontal size={16} className="text-slate-300"/>
            </div>
            
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-4xl font-black tracking-tight text-slate-800 sm:text-5xl">{totalLeads.toLocaleString()}</h2>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('god_leads_in_base')}</p>
              </div>
              <div className={`px-2 py-1 text-[10px] font-bold rounded-full ${tendenciaCrecimiento >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                {tendenciaCrecimiento >= 0 ? '+' : ''}{tendenciaCrecimiento}%
              </div>
            </div>

            <div className="mb-8 flex h-8 items-end gap-1.5 opacity-80">
               {last12DaysData.map((val, i) => (
                 <div key={i} className={`w-1.5 rounded-full ${i === 11 ? 'bg-[#FF5A1F]' : 'bg-slate-300'}`} style={{height: `${Math.max((val / max12Dist) * 100, 15)}%`}} title={`${val} leads ingresados el ${last12Days[i]}`}></div>
               ))}
            </div>
            
            <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-emerald-600 shadow-sm" title={t('god_category_a')}>{catA > 99 ? '99+' : catA} A</div>
                <div className="w-8 h-8 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#FF5A1F] shadow-sm" title={t('god_category_b')}>{catB > 99 ? '99+' : catB} B</div>
                <div className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-purple-600 shadow-sm" title={t('god_category_c')}>{catC > 99 ? '99+' : catC} C</div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-slate-800">{contactados.toLocaleString()}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400">{t('common_contacted')}</p>
              </div>
            </div>
          </div>

          {/* Panel Oscuro (Gráfico Evolución) */}
          <div className="relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-[2rem] bg-[#1c1d22] p-5 text-white shadow-xl sm:min-h-[340px] sm:p-8">
            <div className="relative z-10 mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded bg-[#FF5A1F]"></div>
                <h3 className="text-lg font-medium text-slate-200">{t('god_capture_evolution')}</h3>
              </div>
              <div className={`flex items-center gap-2 glass-badge px-3 py-1 rounded-full text-xs font-bold border border-white/10 ${tendenciaCrecimiento >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <TrendingUp size={14} className={tendenciaCrecimiento < 0 ? 'rotate-180 transform' : ''} /> 
                {tendenciaCrecimiento >= 0 ? '+' : ''}{tendenciaCrecimiento}% {t('common_today')}
              </div>
            </div>

            <div className="relative z-10 mb-2 hidden w-full justify-between px-2 text-xs font-bold text-slate-400 sm:flex">
              {trendData.map((d, i) => (
                <span key={i} className="text-center w-8">{d.label}</span>
              ))}
            </div>

            <div className="group relative z-10 mt-auto h-40 w-full sm:h-48">
              <svg viewBox="0 -5 100 45" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <line x1="0" y1="10" x2="100" y2="10" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                <line x1="0" y1="30" x2="100" y2="30" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
                
                <path d={areaD} fill="url(#chartGradientIQ)" />
                <path d={pathD} fill="none" stroke="#FF5A1F" strokeWidth="1.5" />
                
                {/* Línea decorativa tipo sombra */}
                <path d={pathD} fill="none" stroke="#00d1b2" strokeWidth="0.5" opacity="0.5" transform="translate(1, 2)" />
                
                {/* Nodos de datos */}
                {trendPts.map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="1.5" fill="#1c1d22" stroke="#FF5A1F" strokeWidth="0.5" />
                ))}

                <defs>
                  <linearGradient id="chartGradientIQ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,90,31,0.3)" />
                    <stop offset="100%" stopColor="rgba(255,90,31,0)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* Panel Derecho Naranja (Métricas Globales) */}
          <div className="relative flex min-h-[280px] flex-col justify-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#FF3C00] to-[#e63500] p-5 text-white shadow-xl sm:min-h-[340px] sm:p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/20 rounded-full blur-2xl -translate-x-1/4 translate-y-1/4 pointer-events-none"></div>
            
            <div className="relative z-10 mb-8 text-left sm:text-right">
              <h2 className="text-3xl mb-1 xl:text-[2.35rem]"><span className="font-black text-white">{t('god_metrics')}</span> <span className="font-light">{t('god_globals')}</span></h2>
              <p className="text-orange-100 text-sm font-medium">{t('god_users_network')}</p>
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-[320px] flex-col space-y-4">
              <div className="flex items-center">
                <div className="glass-badge px-4 py-2 rounded-full text-sm font-bold w-full shadow-sm flex justify-between items-center">
                  <span>{t('common_users')}:</span>
                  <span className="text-lg">{totalUsuarios}</span>
                </div>
              </div>
              <div className="flex items-center">
                <div className="glass-badge px-4 py-2 rounded-full text-sm font-bold w-full shadow-sm flex justify-between items-center">
                  <span>{t('common_total_leads')}:</span>
                  <span className="text-lg">{totalLeads}</span>
                </div>
              </div>
              <div className="flex items-center">
                <div className="glass-badge px-4 py-2 rounded-full text-sm font-bold w-full shadow-sm flex justify-between items-center">
                  <span>{t('dir_opt_in_ws')}:</span>
                  <span className="text-lg">{enProspeccion}</span>
                </div>
              </div>
              <div className="flex items-center">
                <div className="glass-badge px-4 py-2 rounded-full text-sm font-bold w-full shadow-sm flex justify-between items-center">
                  <span>{t('common_contacted')}:</span>
                  <span className="text-lg">{contactados}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4 xl:gap-6">
          <div className={`rounded-[2rem] border p-5 shadow-sm sm:p-6 ${isDarkMode ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] shadow-[0_24px_50px_-32px_rgba(0,0,0,0.8)] backdrop-blur-xl' : 'border-slate-100 bg-white'}`}>
            <p className={`mb-4 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Top 3 países</p>
            <div className="space-y-3">
              {topCountries.length > 0 ? (
                topCountries.map((country, index) => (
                  <div key={`top-country-${country.code}-${index}`} className={`flex items-center justify-between gap-3 rounded-[1.1rem] border px-3 py-2.5 ${isDarkMode ? 'border-white/10 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md' : 'border-slate-100 bg-slate-50/80'}`}>
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        <span className="mr-2">{country.flag}</span>
                        {country.nombre}
                      </p>
                      <p className={`mt-0.5 text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{country.code}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-lg font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{country.count}</div>
                      <p className={`mt-1 text-[10px] font-bold uppercase tracking-[0.16em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>leads</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Aún no hay países registrados.</p>
              )}
            </div>
          </div>
          <div className={`rounded-[2rem] border p-5 shadow-sm sm:p-6 ${isDarkMode ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] shadow-[0_24px_50px_-32px_rgba(0,0,0,0.8)] backdrop-blur-xl' : 'border-slate-100 bg-white'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('god_users_with_base')}</p>
            <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
              <div className="bg-[linear-gradient(135deg,#FF4B00,#FF7A00_55%,#FFB36B)] bg-clip-text text-6xl font-black leading-none text-transparent drop-shadow-[0_10px_26px_rgba(255,90,31,0.25)] sm:text-7xl">
                {usuariosConBase}
              </div>
              <p className={`mt-5 max-w-[14rem] text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                {t('god_users_with_base_desc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGlobalLeadsModal(true)}
            className="rounded-[2rem] border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_45px_-28px_rgba(59,130,246,0.35)] sm:p-6"
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Base global</p>
            <div className="text-3xl font-black text-slate-800 sm:text-4xl">{totalLeads}</div>
            <p className="mt-2 text-xs text-slate-400">Abrir visor completo de leads con búsqueda, scroll y paginación de 100.</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-600">
              Explorar leads <ArrowRight size={12} />
            </div>
          </button>
          <div className={`rounded-[2rem] border p-5 shadow-sm sm:p-6 ${isDarkMode ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] shadow-[0_24px_50px_-32px_rgba(0,0,0,0.8)] backdrop-blur-xl' : 'border-slate-100 bg-white'}`}>
            <p className={`mb-4 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('god_top_manager')}</p>
            {topManagers[0] ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center px-3 text-center">
                <div className="relative mb-4">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-[2rem] leading-none drop-shadow-sm">👑</div>
                  <div className="relative rounded-full">
                    {isDarkMode && <div className="absolute inset-0 rounded-full bg-white/[0.04] blur-xl" />}
                    <AvatarInitials name={topManagers[0].nombre} size="lg" isDarkMode={isDarkMode} />
                    <div className={`absolute -bottom-2.5 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-[3px] text-[13px] font-black text-white shadow-[0_10px_20px_-12px_rgba(250,204,21,0.9)] ${isDarkMode ? 'border-[#171717] bg-yellow-400' : 'border-white bg-yellow-400'}`}>
                      1
                    </div>
                  </div>
                </div>
                <div className={`max-w-full truncate text-[2rem] font-black leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {topManagers[0].nombre}
                </div>
                <p className={`mt-4 text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                  {fmt('god_backoffice_leads', { count: topManagers[0].leadsWorkspace || 0 })}
                </p>
              </div>
            ) : (
              <div className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t('common_no_data')}</div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.8fr)] xl:items-start">
          <div className={`relative self-start flex flex-col overflow-hidden rounded-[2rem] border p-5 shadow-sm sm:p-6 lg:p-8 ${isDarkMode ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] shadow-[0_24px_50px_-32px_rgba(0,0,0,0.8)] backdrop-blur-xl' : 'border-slate-100 bg-white'}`}>
            <div className="relative z-10 mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-500"></div>
                <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{t('god_operational_ranking')}</h3>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-bold ${isDarkMode ? 'border-emerald-400/15 bg-emerald-500/10 text-emerald-300' : 'border-emerald-100 bg-emerald-50 text-emerald-600'}`}>
                {t('god_top3_workspace')}
              </div>
            </div>

            {topManagers.length === 0 ? (
              <div className={`relative z-10 rounded-[1.5rem] border p-8 text-center text-sm font-medium ${isDarkMode ? 'border-white/10 bg-white/[0.04] text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>
                {t('god_no_ranking_data')}
              </div>
            ) : (
              <div className="relative z-10">
                <div className={`hidden min-h-[24rem] items-end justify-center gap-4 overflow-hidden rounded-[2rem] border px-4 pb-6 pt-10 md:flex ${isDarkMode ? 'border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,122,0,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl' : 'border-slate-100 bg-[radial-gradient(circle_at_top,rgba(255,122,0,0.08),transparent_45%),linear-gradient(180deg,#fff,rgba(248,250,252,0.9))]'}`}>
                  {topManagers[1] && (
                    <div className="relative z-10 flex w-36 flex-col items-center animate-in slide-in-from-bottom-4 duration-500">
                    <div className="relative mb-3 cursor-pointer" onClick={() => setSelectedManagerId(topManagers[1].id)}>
                      <AvatarInitials name={topManagers[1].nombre} isDarkMode={isDarkMode} />
                      <div className={`absolute -bottom-2.5 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-slate-400 text-[10px] font-black text-white shadow-sm ${isDarkMode ? 'border-[#171717]' : 'border-white'}`}>2</div>
                    </div>
                      <span className={`mb-3 min-h-[2.7rem] w-full px-2 text-center text-sm font-bold leading-[1.15] ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{topManagers[1].nombre}</span>
                    <div onClick={() => setSelectedManagerId(topManagers[1].id)} className={`flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-t-[1.6rem] border-x border-t-4 px-4 py-3 shadow-[inset_0_4px_20px_rgba(0,0,0,0.02)] transition-all ${selectedManagerId === topManagers[1].id ? (isDarkMode ? 'border-x-slate-500/40 border-slate-300 bg-gradient-to-t from-slate-500/25 to-white/[0.10] shadow-[0_16px_35px_-22px_rgba(148,163,184,0.45),inset_0_4px_20px_rgba(0,0,0,0.08)]' : 'border-x-slate-200 border-slate-400 bg-gradient-to-t from-slate-200/80 to-slate-50 shadow-[0_16px_35px_-22px_rgba(100,116,139,0.6),inset_0_4px_20px_rgba(0,0,0,0.02)]') : (isDarkMode ? 'border-x-white/10 border-slate-400/60 bg-gradient-to-t from-slate-500/15 to-white/[0.04]' : 'border-x-slate-100 border-slate-300 bg-gradient-to-t from-slate-100/60 to-slate-50/30')}`}>
                      <span className={`text-xl font-black leading-none ${isDarkMode ? 'text-slate-100' : 'text-slate-600'}`}>{topManagers[1].leadsWorkspace}</span>
                      <span className={`mt-2 text-[9px] font-bold uppercase leading-none tracking-[0.14em] ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t('common_total_leads')}</span>
                    </div>
                  </div>
                )}

                {topManagers[0] && (
                  <div className="relative z-10 flex w-32 flex-col items-center animate-in slide-in-from-bottom-8 duration-500">
                    <div className="absolute -top-7 text-3xl drop-shadow-sm">👑</div>
                    <div className="relative mb-3 cursor-pointer" onClick={() => setSelectedManagerId(topManagers[0].id)}>
                      <AvatarInitials name={topManagers[0].nombre} size="lg" isDarkMode={isDarkMode} />
                      <div className={`absolute -bottom-2.5 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-yellow-400 text-[12px] font-black text-white shadow-sm ${isDarkMode ? 'border-[#171717]' : 'border-white'}`}>1</div>
                    </div>
                      <span className={`mb-3 w-full truncate px-1 text-center text-base font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{topManagers[0].nombre}</span>
                    <div onClick={() => setSelectedManagerId(topManagers[0].id)} className={`flex h-44 w-full cursor-pointer flex-col items-center justify-center rounded-t-2xl border-x border-t-4 p-3 shadow-[inset_0_4px_20px_rgba(0,0,0,0.02)] transition-all ${selectedManagerId === topManagers[0].id ? (isDarkMode ? 'border-x-yellow-300/35 border-yellow-400 bg-gradient-to-t from-yellow-400/20 to-white/[0.10] shadow-[0_18px_38px_-20px_rgba(250,204,21,0.45),inset_0_4px_20px_rgba(0,0,0,0.08)]' : 'border-x-yellow-200 border-yellow-400 bg-gradient-to-t from-yellow-200/70 to-yellow-50 shadow-[0_18px_38px_-20px_rgba(250,204,21,0.8),inset_0_4px_20px_rgba(0,0,0,0.02)]') : (isDarkMode ? 'border-x-white/10 border-yellow-400/80 bg-gradient-to-t from-yellow-400/12 to-white/[0.05]' : 'border-x-slate-100 border-yellow-400 bg-gradient-to-t from-yellow-100/50 to-yellow-50/20')}`}>
                      <span className={`text-3xl font-black leading-none ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>{topManagers[0].leadsWorkspace}</span>
                      <span className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-yellow-200/70' : 'text-yellow-700/60'}`}>{t('god_leads_in_base')}</span>
                    </div>
                  </div>
                )}

                {topManagers[2] && (
                  <div className="relative z-10 flex w-36 flex-col items-center animate-in slide-in-from-bottom-2 duration-500 delay-200">
                    <div className="relative mb-3 cursor-pointer" onClick={() => setSelectedManagerId(topManagers[2].id)}>
                      <AvatarInitials name={topManagers[2].nombre} isDarkMode={isDarkMode} />
                      <div className={`absolute -bottom-2.5 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-[#FF5A1F] text-[10px] font-black text-white shadow-sm ${isDarkMode ? 'border-[#171717]' : 'border-white'}`}>3</div>
                    </div>
                      <span className={`mb-3 min-h-[2.7rem] w-full px-2 text-center text-sm font-bold leading-[1.15] ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{topManagers[2].nombre}</span>
                    <div onClick={() => setSelectedManagerId(topManagers[2].id)} className={`flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-t-[1.6rem] border-x border-t-4 px-4 py-3 shadow-[inset_0_4px_20px_rgba(0,0,0,0.02)] transition-all ${selectedManagerId === topManagers[2].id ? (isDarkMode ? 'border-x-orange-300/30 border-[#FF5A1F] bg-gradient-to-t from-orange-500/18 to-white/[0.09] shadow-[0_16px_35px_-22px_rgba(255,90,31,0.45),inset_0_4px_20px_rgba(0,0,0,0.08)]' : 'border-x-orange-200 border-[#FF5A1F] bg-gradient-to-t from-orange-200/70 to-orange-50 shadow-[0_16px_35px_-22px_rgba(255,90,31,0.75),inset_0_4px_20px_rgba(0,0,0,0.02)]') : (isDarkMode ? 'border-x-white/10 border-[#FF5A1F]/80 bg-gradient-to-t from-orange-500/12 to-white/[0.04]' : 'border-x-slate-100 border-[#FF5A1F] bg-gradient-to-t from-orange-100/50 to-orange-50/20')}`}>
                      <span className={`text-xl font-black leading-none ${isDarkMode ? 'text-orange-300' : 'text-[#FF5A1F]'}`}>{topManagers[2].leadsWorkspace}</span>
                      <span className={`mt-2 text-[9px] font-bold uppercase leading-none tracking-[0.14em] ${isDarkMode ? 'text-orange-200/70' : 'text-[#FF5A1F]/70'}`}>{t('common_total_leads')}</span>
                    </div>
                  </div>
                )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:hidden">
                  {topManagers.map((user, index) => (
                    <div key={`ranking-mobile-${user.id}`} onClick={() => setSelectedManagerId(user.id)} className={`rounded-[1.5rem] border p-4 shadow-sm transition-all ${selectedManagerId === user.id ? (isDarkMode ? 'border-indigo-400/30 bg-indigo-500/10 shadow-[0_16px_36px_-20px_rgba(99,102,241,0.3)]' : 'border-indigo-200 bg-indigo-50/70 shadow-[0_16px_36px_-20px_rgba(99,102,241,0.45)]') : (isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-slate-100 bg-slate-50')}`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-slate-400' : 'bg-[#FF5A1F]'}`}>{index + 1}</span>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{user.nombre}</p>
                            <p className={`truncate text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{user.codigoPropio}</p>
                          </div>
                        </div>
                        <span className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{user.leadsWorkspace}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div className={`rounded-xl border p-2 ${isDarkMode ? 'border-white/10 bg-white/[0.05]' : 'border-slate-100 bg-white'}`}>
                          <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('god_base_short')}</span>
                          <span className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{user.leadsWorkspace}</span>
                        </div>
                        <div className={`rounded-xl border p-2 ${isDarkMode ? 'border-white/10 bg-white/[0.05]' : 'border-slate-100 bg-white'}`}>
                          <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('god_prospect_short')}</span>
                          <span className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{user.prospeccion}</span>
                        </div>
                        <div className={`rounded-xl border p-2 ${isDarkMode ? 'border-white/10 bg-white/[0.05]' : 'border-slate-100 bg-white'}`}>
                          <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t('god_contact_short')}</span>
                          <span className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{user.contactados}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
            <div className="relative z-10 mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500"></div>
                <h3 className="text-sm font-bold text-slate-700">{t('god_user_management')}</h3>
              </div>
              <div className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                {fmt('god_registered_users', { count: usuariosOperativos.length })}
              </div>
            </div>

            <div className="relative z-10 mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xs">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(event) => {
                    setUserSearchTerm(event.target.value);
                    setUserPage(1);
                  }}
                  placeholder="Buscar usuario"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <span className="text-xs font-medium text-slate-400">
                  {filteredUserRows.length === 0 ? '0 resultados' : `${(safeUserPage - 1) * USER_PAGE_SIZE + 1}-${Math.min(safeUserPage * USER_PAGE_SIZE, filteredUserRows.length)} de ${filteredUserRows.length}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUserPage(Math.max(1, safeUserPage - 1))}
                    disabled={safeUserPage === 1}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition-all hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <div className="rounded-full bg-slate-900 px-3 py-2 text-xs font-black text-white">
                    {safeUserPage}/{totalUserPages}
                  </div>
                  <button
                    type="button"
                    onClick={() => setUserPage(Math.min(totalUserPages, safeUserPage + 1))}
                    disabled={safeUserPage === totalUserPages}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600 transition-all hover:border-blue-300 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>

            <div className="relative z-10 hidden w-full overflow-x-auto md:block">
            <table className="min-w-[780px] w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[24%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[14%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-4 pl-2 pr-3">{t('common_user_name')}</th>
                  <th className="pb-4 px-3">{t('common_email')}</th>
                  <th className="pb-4 px-3 text-center">{t('team_entry_date')}</th>
                  <th className="pb-4 px-3">{t('god_th_code_sponsor') || 'Code / Sponsor'}</th>
                  <th className="pb-4 px-3 text-center">{t('common_backoffice')}</th>
                  <th className="pb-4 pl-3 pr-2 text-right">{t('common_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedUserRows.map((user, i) => (
                  <tr key={user.id || i} className={`transition-all group ${selectedManagerId === user.id ? 'bg-indigo-50/70 shadow-[inset_4px_0_0_0_#6366f1]' : 'hover:bg-slate-50/50'}`}>
                    <td className="py-4 pl-2 pr-3 align-middle">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs border border-white shadow-sm">
                          {user.nombre ? user.nombre.substring(0, 2).toUpperCase() : 'U'}
                        </div>
                        <span className={`truncate font-bold text-sm transition-colors ${selectedManagerId === user.id ? 'text-indigo-700' : 'text-slate-800 group-hover:text-blue-500'}`}>{user.nombre}</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <div className="truncate text-sm text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-3 py-4 text-center align-middle">
                      <span className="text-sm font-medium text-slate-500">{new Date(user.fechaRegistro).toLocaleDateString(locale)}</span>
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <div className={`inline-flex max-w-full rounded border px-2 py-0.5 text-sm font-mono font-bold ${selectedManagerId === user.id ? 'border-indigo-100 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-700'}`}>{user.codigoPropio || 'N/A'}</div>
                      <div className="mt-1 truncate text-[10px] font-medium text-slate-400">{user.referidoPor ? `Ref: ${user.referidoPor}` : t('common_no_sponsor')}</div>
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <div className="flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600">{user.leadsWorkspace} {t('god_base_short').toLowerCase()}</span>
                      </div>
                    </td>
                    <td className="py-4 pl-3 pr-2 text-right align-middle">
                      <div className="ml-auto flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleOpenResetPassword(user)}
                          title={t('god_reset_password')}
                          aria-label={t('god_reset_password')}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50 hover:text-[#FF5A1F]"
                        >
                          <Lock size={15} />
                        </button>
                        <button
                          onClick={() => onImpersonate(user)}
                          title={t('god_enter_account')}
                          aria-label={t('god_enter_account')}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-200 bg-white text-indigo-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-transparent hover:bg-indigo-600 hover:text-white"
                        >
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedUserRows.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-sm font-medium text-slate-400">
                      No se encontraron usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

            <div className="relative z-10 space-y-3 md:hidden">
              {paginatedUserRows.map((user, i) => (
                <div key={`mobile-user-${user.id || i}`} className={`rounded-[1.5rem] border p-4 transition-all ${selectedManagerId === user.id ? 'border-indigo-200 bg-indigo-50/70 shadow-[0_16px_36px_-20px_rgba(99,102,241,0.45)]' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">{user.nombre}</p>
                      <p className="truncate text-xs text-slate-400">{user.email}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-500">{user.codigoPropio || 'N/A'}</span>
                  </div>
                  <div className="mb-3 grid grid-cols-1 gap-2 text-[11px]">
                    <div className="rounded-xl bg-white p-2 border border-slate-100">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('god_base_short')}</span>
                      <span className="font-black text-slate-800">{user.leadsWorkspace}</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenResetPassword(user)}
                      title={t('god_reset_password')}
                      aria-label={t('god_reset_password')}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50 hover:text-[#FF5A1F]"
                    >
                      <Lock size={15} />
                    </button>
                    <button type="button" onClick={() => onImpersonate(user)} className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-xs font-bold text-indigo-600 shadow-sm transition-all hover:border-transparent hover:bg-indigo-600 hover:text-white">
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {paginatedUserRows.length === 0 && (
                <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-6 text-center text-sm font-medium text-slate-400">
                  No se encontraron usuarios.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Componente para tarjeta de registro individual
// --- VISTA 2: FORMULARIO ---
// --- VISTA 3: TABLA DE DATOS (DIRECTORIO GENERAL) ---
// --- MODAL PARA COMPARTIR LEADS (LÓGICA CENTRALIZADA Y EXCLUSIVA PARA SOCIOS) ---
// --- VISTA 4: REPORTES Y ANALÍTICAS ---
// (La Vista 7 "Enlaces Compartidos" fue removida e integrada en Mi Equipo)
