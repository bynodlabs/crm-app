import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileText, MessageCircle, Play, User, Users, X } from 'lucide-react';
import { WhatsAppIcon } from '../components/WhatsAppIcon';
import { ORIGENES, PAISES } from '../lib/constants';
import { api } from '../lib/api';
import { detectCountryCodeFromPhone } from '../lib/country';
import { getLocalISODate, getLocalISOTime } from '../lib/date';
import { normalizeLeadStage } from '../lib/lead-pipeline';
import { buildLeadIdentity } from '../lib/lead-utils';
import { useSectors } from '../hooks/useSectors';

const InputUI = ({ label, ...props }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-4">{label}</label>
    <input className="w-full px-6 py-3.5 bg-slate-50/50 border border-slate-200/60 rounded-full focus:bg-white focus:ring-2 focus:ring-orange-100 focus:border-[#FF5A1F] outline-none transition-all text-sm placeholder:text-slate-400" {...props} />
  </div>
);

const SelectUI = ({ label, options, ...props }) => (
  <div>
    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-4">{label}</label>
    <select className="w-full px-6 py-3.5 bg-slate-50/50 border border-slate-200/60 rounded-full focus:bg-white focus:ring-2 focus:ring-orange-100 focus:border-[#FF5A1F] outline-none transition-all text-sm appearance-none" {...props}>
      {options.map((o, i) => <option key={i} value={o.code || o}>{o.nombre || o}</option>)}
    </select>
  </div>
);

export function AddRecordView({ records, duplicateRecords = [], setRecords, setActiveTab, setDuplicateRecords, t, isViewOnly, currentUser, onCreateRecord, onImportRecords }) {
  const { activeSectors } = useSectors();
  const [inputMode, setInputMode] = useState('whatsapp');
  const [whatsAppMode, setWhatsAppMode] = useState('wa-group');
  const [massiveData, setMassiveData] = useState('');
  const [waData, setWaData] = useState('');
  const [waSector, setWaSector] = useState('TRA');
  const [waNota, setWaNota] = useState('');
  const [waQrGroups, setWaQrGroups] = useState([]);
  const [selectedWaQrGroup, setSelectedWaQrGroup] = useState('');
  const [selectedWaQrGroupMeta, setSelectedWaQrGroupMeta] = useState(null);
  const [isLoadingWaQrGroups, setIsLoadingWaQrGroups] = useState(false);
  const [isLoadingWaQrParticipants, setIsLoadingWaQrParticipants] = useState(false);
  const [waQrParticipants, setWaQrParticipants] = useState([]);
  const [waQrSelection, setWaQrSelection] = useState({});
  const [skippedCountInfo, setSkippedCountInfo] = useState(null);
  const [showWaHelpVideo, setShowWaHelpVideo] = useState(false);
  const [inlineNotice, setInlineNotice] = useState(null);
  const waGroupStatusPollRef = useRef(null);

  const [formData, setFormData] = useState({ nombre: '', numero: '', correo: '', pais: 'PE', sector: 'CRI', subsector: '', origen: ORIGENES[0], fechaIngreso: getLocalISODate(), nota: '', sendToProspecting: false });

  const countryDialPrefixes = useMemo(() => ({
    PE: '+51',
    MX: '+52',
    CO: '+57',
    AR: '+54',
    CL: '+56',
    ES: '+34',
    US: '+1',
    VE: '+58',
    EC: '+593',
    BO: '+591',
    PY: '+595',
    UY: '+598',
    BR: '+55',
    PA: '+507',
    CR: '+506',
    HN: '+504',
    SV: '+503',
    GT: '+502',
    DO: '+1809',
  }), []);

  const normalizeSectorText = (value = '') =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s/&-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const resolveSectorId = (value = '') => {
    const raw = normalizeSectorText(value);
    if (!raw) return '';

    const directById = activeSectors.find((sector) => sector.id.toLowerCase() === raw);
    if (directById) return directById.id;

    const exactByName = activeSectors.find((sector) => normalizeSectorText(sector.nombre) === raw);
    if (exactByName) return exactByName.id;

    const matches = [
      { id: 'CRI', patterns: ['cripto', 'crypto', 'cryptocurrency', 'cryptocurrencies', 'bitcoin', 'btc', 'binance', 'blockchain', 'web3'] },
      { id: 'TRA', patterns: ['trading', 'trade', 'trader', 'forex', 'finance', 'financial', 'investment', 'investments', 'investing', 'broker'] },
      { id: 'APU', patterns: ['bet', 'bets', 'betting', 'casino', 'gambling', 'sportsbook', 'wager', 'apuestas', 'pronosticos'] },
      { id: 'MLM', patterns: ['mlm', 'network marketing', 'multilevel', 'multinivel', 'referrals', 'direct sales'] },
      { id: 'COA', patterns: ['coach', 'coaching', 'mindset', 'mentoring', 'desarrollo personal'] },
      { id: 'IA', patterns: ['ai', 'ia', 'saas', 'software', 'automation', 'bot', 'bots', 'artificial intelligence'] },
      { id: 'BIN', patterns: ['real estate', 'realtor', 'realty', 'property', 'properties', 'inmobiliaria', 'bienes raices'] },
      { id: 'FIT', patterns: ['fitness', 'fit', 'gym', 'health', 'healthcare', 'wellness', 'nutrition', 'salud', 'weight loss'] },
      { id: 'MAR', patterns: ['ecommerce', 'e-commerce', 'marketing', 'digital marketing', 'shopify', 'dropshipping', 'instagram', 'social media', 'ig'] },
      { id: 'LID', patterns: ['liderazgo', 'leadership', 'emprendimiento', 'entrepreneurship', 'business', 'negocio', 'entrepreneur'] },
    ];

    const match = matches.find(({ patterns }) => patterns.some((pattern) => raw.includes(pattern)));
    return match?.id || '';
  };

  const calculateImportedCategory = ({ hasNombre, hasNumero, hasCorreo, hasPais, hasSector }) => {
    if (hasSector && hasNombre && hasNumero && hasCorreo && hasPais) return 'A';
    if (hasSector && hasNombre && (hasNumero || hasCorreo) && hasPais) return 'B';
    if (hasNumero) return 'C';
    if (hasCorreo) return 'D';
    return '-';
  };

  const autoDetectSector = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('cripto') || lower.includes('crypto') || lower.includes('btc') || lower.includes('binance')) return 'CRI';
    if (lower.includes('trading') || lower.includes('forex') || lower.includes('inversion') || lower.includes('futuros')) return 'TRA';
    if (lower.includes('apuesta') || lower.includes('casino') || lower.includes('bet') || lower.includes('pronostico')) return 'APU';
    if (lower.includes('mlm') || lower.includes('multinivel') || lower.includes('redes') || lower.includes('ponzi')) return 'MLM';
    if (lower.includes('coach') || lower.includes('mentalidad') || lower.includes('desarrollo')) return 'COA';
    if (lower.includes('ia ') || lower.includes('saas') || lower.includes('bot') || lower.includes('software')) return 'IA';
    if (lower.includes('inmobiliari') || lower.includes('bienes') || lower.includes('real estate')) return 'BIN';
    if (lower.includes('fit') || lower.includes('gym') || lower.includes('salud') || lower.includes('peso')) return 'FIT';
    if (lower.includes('ecom') || lower.includes('tienda') || lower.includes('ig ') || lower.includes('dropship')) return 'MAR';
    if (lower.includes('lider') || lower.includes('emprende') || lower.includes('negocio')) return 'LID';
    return null;
  };

  const categoriaCalculada = useMemo(() => {
    const hasNombre = formData.nombre.trim().length > 0;
    const hasNumero = formData.numero.trim().length > 0;
    const hasCorreo = formData.correo.trim().length > 0;
    if (hasNombre && hasNumero && hasCorreo && formData.pais) return 'A';
    if (hasNombre && (hasNumero || hasCorreo) && formData.pais) return 'B';
    if (hasNumero && !hasCorreo) return 'C';
    if (hasCorreo && !hasNumero) return 'D';
    return '-';
  }, [formData]);

  useEffect(() => {
    if (!inlineNotice) return undefined;
    const timeoutId = window.setTimeout(() => setInlineNotice(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [inlineNotice]);

  useEffect(() => {
    if (!inlineNotice) return;
    setInlineNotice(null);
  }, [formData, inlineNotice, massiveData, waData]);

  const handlePhoneChange = (e) => {
    let num = e.target.value.replace(/[^\d+\s-()]/g, '');
    if (num.startsWith('00')) num = '+' + num.substring(2);

    const detectedPais = detectCountryCodeFromPhone(num, formData.pais);
    setFormData({ ...formData, numero: num, pais: detectedPais });
  };

  const handleCountryChange = (e) => {
    const nextPais = e.target.value;
    const nextPrefix = countryDialPrefixes[nextPais] || '';
    const previousPrefix = countryDialPrefixes[formData.pais] || '';
    const currentNumero = String(formData.numero || '');
    const trimmedNumero = currentNumero.trim();
    const isEmpty = trimmedNumero.length === 0;
    const isOnlyPreviousPrefix = previousPrefix && (trimmedNumero === previousPrefix || trimmedNumero === `${previousPrefix}`);

    setFormData((prev) => ({
      ...prev,
      pais: nextPais,
      numero: (isEmpty || isOnlyPreviousPrefix) && nextPrefix ? `${nextPrefix} ` : prev.numero,
    }));
  };

  const handleNotaOpcionesChange = (e, field) => {
    const val = e.target.value;
    const detected = autoDetectSector(val);
    setFormData(prev => ({
      ...prev,
      [field]: val,
      sector: detected || prev.sector
    }));
  };

  const handleWaNotaChange = (e) => {
    const val = e.target.value;
    setWaNota(val);
    const detected = autoDetectSector(val);
    if (detected) setWaSector(detected);
  };

  const decodeHtmlEntities = useCallback((value = '') => {
    if (typeof document === 'undefined') {
      return String(value || '');
    }

    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value;
  }, []);

  const extractWhatsAppNumbers = useCallback((rawValue = '') => {
    const raw = String(rawValue || '');
    const decodedRaw = decodeHtmlEntities(raw)
      .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
      .replace(/&nbsp;/gi, ' ');

    const extractionSources = [decodedRaw];

    if (decodedRaw.includes('<')) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(decodedRaw, 'text/html');
        const textContent = doc.body?.textContent || '';
        if (textContent) {
          extractionSources.push(textContent);
        }

        const attributeValues = Array.from(doc.querySelectorAll('*')).flatMap((element) =>
          Array.from(element.attributes || []).map((attribute) => attribute.value),
        );
        extractionSources.push(...attributeValues);
      } catch {
        // If the HTML parser fails, we still scan the raw text.
      }
    }

    const candidateMatches = extractionSources.flatMap((source) => {
      const safeSource = String(source || '');
      return [
        ...(safeSource.match(/(?:\+|00)?\d[\d\s().\-–—]{6,}\d/g) || []),
        ...(safeSource.match(/(?:\+|00)?\d{8,15}(?=@c\.us\b)/g) || []),
        ...(safeSource.match(/(?:tel:|phone(?:_number)?["':= ]+)(?:\+|00)?\d[\d\s().\-–—]{6,}\d/gi) || []),
        ...(safeSource.match(/\b\d{8,15}\b/g) || []),
      ];
    });

    const seenPhones = new Set();

    return candidateMatches
      .map((match) => {
        let normalized = String(match || '')
          .replace(/^(?:tel:|phone(?:_number)?["':= ]+)/i, '')
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/[–—]/g, '-');

        if (normalized.startsWith('00')) {
          normalized = `+${normalized.slice(2)}`;
        }

        const digits = normalized.replace(/\D/g, '');
        if (digits.length < 8 || digits.length > 15) {
          return null;
        }

        if (seenPhones.has(digits)) {
          return null;
        }

        seenPhones.add(digits);
        return {
          digits,
          formatted: (normalized.startsWith('+') ? normalized : `+${digits}`).replace(/[^\d+\s-()]/g, '').trim(),
        };
      })
      .filter(Boolean);
  }, [decodeHtmlEntities]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const duplicateKey = buildLeadIdentity(formData);
    const alreadyExists = records.some((record) => {
      const existingKey = buildLeadIdentity(record);
      return duplicateKey && existingKey && duplicateKey === existingKey;
    });

    if (alreadyExists) {
      setInlineNotice({
        tone: 'warning',
        message: 'Este lead ya existe en tu directorio.',
      });
      return;
    }

    const dateObj = new Date(formData.fechaIngreso);
    const id = `BIG-${formData.sector}-${formData.pais}-${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(records.length + 1).padStart(4, '0')}`;

    const finalStatus = formData.sendToProspecting ? 'En prospección' : 'Nuevo';

    const newRecord = {
      ...formData, id, categoria: categoriaCalculada, canal: 'Automático', estadoProspeccion: finalStatus, mensajeEnviado: false, responsable: 'Sin Asignar',
      stage: normalizeLeadStage('', { estadoProspeccion: finalStatus }),
      inProspecting: formData.sendToProspecting, isArchived: false, propietarioId: currentUser.id, workspaceId: currentUser.workspaceId,
      historial: [{ fecha: getLocalISOTime(), accion: `Creado manual en el sistema (Estado: ${finalStatus})` }]
    };

    if (onCreateRecord) {
      await onCreateRecord(newRecord);
    } else {
      setRecords([newRecord, ...records]);
    }

    setActiveTab(formData.sendToProspecting ? 'prospecting' : 'database');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { setMassiveData(evt.target.result); };
    reader.readAsText(file);
  };

  const handleMassiveSubmit = async (e) => {
    e.preventDefault();
    if (!massiveData.trim()) return;

    const lines = massiveData.split(/\r?\n/);
    if (lines.length < 1) return;

    const newRecords = [];
    const newDuplicates = [];
    let currentCount = records.length + duplicateRecords.length;
    const textLower = massiveData.toLowerCase();
    const batchSeenKeys = new Set();

    const isOption1 = textLower.includes('sector:') && textLower.includes('numeros:');
    const isOption2 = textLower.includes('nombre completo') && (textLower.includes('telefono') || textLower.includes('teléfono'));
    const isIgCsv = massiveData.includes('source_username') && massiveData.includes('full_name');
    const extractedBulkNumbers = !isOption1 && !isOption2 && !isIgCsv ? extractWhatsAppNumbers(massiveData) : [];
    const isMixedBulkNumbers = extractedBulkNumbers.length > 0;

    if (isOption1) {
      let globalSectorName = '';
      let globalDesc = '';
      let readingNumbers = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const lineLower = line.toLowerCase();

        if (lineLower.startsWith('sector:')) {
          globalSectorName = lines[i + 1]?.trim() || '';
          i++;
          continue;
        }
        if (lineLower.startsWith('descripción:') || lineLower.startsWith('descripcion:')) {
          globalDesc = lines[i + 1]?.trim() || '';
          i++;
          continue;
        }
        if (lineLower.startsWith('numeros:')) {
          readingNumbers = true;
          continue;
        }

        if (readingNumbers) {
          const rawNum = line;
          const cleanNum = rawNum.replace(/[^0-9+]/g, '');
          if (cleanNum.length >= 8) {
            const numWithPlus = cleanNum.startsWith('+') ? cleanNum : `+${cleanNum}`;
            const paisCode = detectCountryCodeFromPhone(numWithPlus, 'OT');

            const finalSectorId = resolveSectorId(globalSectorName);
            const subsectorStr = finalSectorId
              ? globalDesc
              : [globalSectorName, globalDesc].filter(Boolean).join(' - ');

            currentCount++;
            const dateObj = new Date();
            const id = `BIG-${finalSectorId || 'GEN'}-${paisCode}-${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(currentCount).padStart(4, '0')}`;

            const newRecord = {
              nombre: 'Usuario WA',
              pais: paisCode,
              numero: numWithPlus,
              correo: '',
              sector: finalSectorId,
              subsector: subsectorStr.substring(0, 50),
              origen: 'Importación Bloque (CSV)',
              fechaIngreso: getLocalISODate(dateObj),
              nota: globalDesc,
              id,
              categoria: calculateImportedCategory({
                hasNombre: true,
                hasNumero: true,
                hasCorreo: false,
                hasPais: paisCode !== 'OT',
                hasSector: Boolean(finalSectorId),
              }),
              canal: 'Masivo',
              estadoProspeccion: 'Nuevo',
              stage: normalizeLeadStage('', { estadoProspeccion: 'Nuevo' }),
              mensajeEnviado: false,
              responsable: 'Sin Asignar',
              propietarioId: currentUser.id,
              workspaceId: currentUser.workspaceId,
              inProspecting: false,
              isArchived: false,
              historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Importado masivamente vía Formato de Bloque' }]
            };
            const leadKey = buildLeadIdentity(newRecord);
            const normalizedPhone = numWithPlus.replace(/\D/g, '');
            const fallbackPhoneKey = normalizedPhone.length >= 8 ? `phone:${normalizedPhone}` : null;
            const isDupInBatch = (leadKey && batchSeenKeys.has(leadKey)) || (fallbackPhoneKey && batchSeenKeys.has(fallbackPhoneKey));

            if (isDupInBatch) {
              newDuplicates.push(newRecord);
            } else {
              newRecords.push(newRecord);
              if (leadKey) batchSeenKeys.add(leadKey);
              if (fallbackPhoneKey) batchSeenKeys.add(fallbackPhoneKey);
            }
          }
        }
      }
    } else if (isOption2) {
      let headerRowIdx = -1;
      let headers = [];

      for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase();
        if (lineLower.includes('nombre completo') && (lineLower.includes('telefono') || lineLower.includes('teléfono'))) {
          headerRowIdx = i;
          headers = lines[i].split(/[,;](?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
          break;
        }
      }

      if (headerRowIdx !== -1) {
        const colMap = {
          nombre: headers.findIndex(h => h.includes('nombre')),
          telefono: headers.findIndex(h => h.includes('telefono') || h.includes('teléfono')),
          sector: headers.findIndex(h => h.includes('sector')),
          subsector: headers.findIndex(h => h.includes('subsector')),
          origen: headers.findIndex(h => h.includes('origen')),
          correo: headers.findIndex(h => h.includes('correo') || h.includes('email'))
        };

        for (let i = headerRowIdx + 1; i < lines.length; i++) {
          if (!lines[i].trim() || lines[i].replace(/[,;]/g, '').trim() === '') continue;

          const rowData = lines[i].split(/[,;](?=(?:(?:[^"]*"){2})*[^"]*$)/).map(d => d.replace(/^"|"$/g, '').trim());

          let rawNombre = colMap.nombre !== -1 ? rowData[colMap.nombre] : '';
          const rawTelefono = colMap.telefono !== -1 ? rowData[colMap.telefono] : '';
          const rawSector = colMap.sector !== -1 ? rowData[colMap.sector] : '';
          const rawSubsector = colMap.subsector !== -1 ? rowData[colMap.subsector] : '';
          let rawOrigen = colMap.origen !== -1 ? rowData[colMap.origen] : '';
          const rawCorreo = colMap.correo !== -1 ? rowData[colMap.correo] : '';

          if (!rawNombre) rawNombre = 'Sin Nombre';
          if (!rawTelefono && !rawCorreo) continue;

          const cleanNum = rawTelefono.replace(/[^0-9+]/g, '');
          let numWithPlus = cleanNum;
          if (cleanNum && !cleanNum.startsWith('+')) numWithPlus = `+${cleanNum}`;

          const paisCode = detectCountryCodeFromPhone(numWithPlus, 'OT');

          const finalSectorId = resolveSectorId(rawSector);
          if (!rawOrigen) rawOrigen = ORIGENES[0];

          const hasNombre = rawNombre !== 'Sin Nombre';
          const hasNumero = rawTelefono.length > 0;
          const hasCorreo = rawCorreo.length > 0;
          const cat = calculateImportedCategory({
            hasNombre,
            hasNumero,
            hasCorreo,
            hasPais: paisCode !== 'OT',
            hasSector: Boolean(finalSectorId),
          });

          currentCount++;
          const dateObj = new Date();
          const id = `BIG-${finalSectorId || 'GEN'}-${paisCode}-${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(currentCount).padStart(4, '0')}`;

          const newRecord = {
            nombre: rawNombre,
            pais: paisCode,
            numero: numWithPlus || rawTelefono,
            correo: rawCorreo,
            sector: finalSectorId,
            subsector: rawSubsector,
            origen: rawOrigen,
            fechaIngreso: getLocalISODate(dateObj),
            nota: 'Importado vía tabla estructurada.',
            id,
            categoria: cat,
            canal: 'Masivo',
            estadoProspeccion: 'Nuevo',
            stage: normalizeLeadStage('', { estadoProspeccion: 'Nuevo' }),
            mensajeEnviado: false,
            responsable: 'Sin Asignar',
            propietarioId: currentUser.id,
            workspaceId: currentUser.workspaceId,
            inProspecting: false,
            isArchived: false,
            historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Importado masivamente vía formato de Tabla' }]
          };
          const leadKey = buildLeadIdentity(newRecord);
          const isDup = leadKey && batchSeenKeys.has(leadKey);

          if (isDup) newDuplicates.push(newRecord);
          else {
            newRecords.push(newRecord);
            if (leadKey) batchSeenKeys.add(leadKey);
          }
        }
      }
    } else if (isIgCsv) {
      const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().replace(/^"|"$/g, ''));
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const rowData = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const row = {};
        headers.forEach((h, idx) => { row[h] = (rowData[idx] || '').replace(/^"|"$/g, '').trim(); });

        const nombre = row.full_name || row.username || 'Usuario IG';
        const correo = row.public_email || '';
        const numero = row.phone || '';
        let paisCode = 'OT';
        if (row.country) {
          const found = PAISES.find(p => p.code === row.country.toUpperCase() || p.nombre.toLowerCase() === row.country.toLowerCase());
          if (found) paisCode = found.code;
        } else if (numero) {
          paisCode = detectCountryCodeFromPhone(numero, 'OT');
        }

        const sector = 'MAR';
        const subsector = row.category_name || '';
        const origen = row.source_username ? `IG: ${row.source_username}` : 'Instagram Scraping';
        let nota = row.biography || '';
        if (row.city) nota += ` | Ciudad: ${row.city}`;

        const hasNombre = nombre !== 'Usuario IG';
        const hasNumero = numero.length > 0;
        const hasCorreo = correo.length > 0;
        let cat = '-';
        if (hasNombre && hasNumero && hasCorreo) cat = 'A';
        else if (hasNombre && (hasNumero || hasCorreo)) cat = 'B';
        else if (hasNumero && !hasCorreo) cat = 'C';
        else if (hasCorreo && !hasNumero) cat = 'D';

        currentCount++;
        const dateObj = new Date();
        const id = `BIG-${sector}-${paisCode}-${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(currentCount).padStart(4, '0')}`;

        const newRecord = {
          nombre, pais: paisCode, numero, correo, sector, subsector, origen,
          fechaIngreso: getLocalISODate(dateObj), nota, id, categoria: cat, canal: 'Instagram',
          estadoProspeccion: 'Nuevo', stage: normalizeLeadStage('', { estadoProspeccion: 'Nuevo' }), mensajeEnviado: false, responsable: 'Sin Asignar', propietarioId: currentUser.id, workspaceId: currentUser.workspaceId, inProspecting: false, isArchived: false, historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Importado masivamente vía Instagram Scraping' }]
        };
        const leadKey = buildLeadIdentity(newRecord);
        const isDup = leadKey && batchSeenKeys.has(leadKey);

        if (isDup) newDuplicates.push(newRecord);
        else {
          newRecords.push(newRecord);
          if (leadKey) batchSeenKeys.add(leadKey);
        }
      }
    } else if (isMixedBulkNumbers) {
      const detectedSector = resolveSectorId(massiveData) || autoDetectSector(massiveData) || '';
      const sharedNote = 'Importado masivamente desde bloque de texto libre.';

      extractedBulkNumbers.forEach(({ formatted, digits }) => {
        const phoneKey = `phone:${digits}`;
        const paisCode = detectCountryCodeFromPhone(formatted, 'OT');
        const dateObj = new Date();
        currentCount++;
        const id = `BIG-${detectedSector || 'GEN'}-${paisCode}-${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(currentCount).padStart(4, '0')}`;

        const candidateRecord = {
          nombre: 'Lead importado',
          pais: paisCode,
          numero: formatted,
          correo: '',
          sector: detectedSector,
          subsector: '',
          origen: 'Importación Masiva',
          fechaIngreso: getLocalISODate(dateObj),
          nota: sharedNote,
          id,
          categoria: calculateImportedCategory({
            hasNombre: true,
            hasNumero: true,
            hasCorreo: false,
            hasPais: paisCode !== 'OT',
            hasSector: Boolean(detectedSector),
          }),
          canal: 'Masivo',
          estadoProspeccion: 'Nuevo',
          stage: normalizeLeadStage('', { estadoProspeccion: 'Nuevo' }),
          mensajeEnviado: false,
          responsable: 'Sin Asignar',
          propietarioId: currentUser.id,
          workspaceId: currentUser.workspaceId,
          inProspecting: false,
          isArchived: false,
          historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Importado masivamente desde texto mixto' }],
        };
        const leadKey = buildLeadIdentity(candidateRecord);
        const existsInBatch = (leadKey && batchSeenKeys.has(leadKey)) || batchSeenKeys.has(phoneKey);

        if (existsInBatch) {
          newDuplicates.push(candidateRecord);
        } else {
          newRecords.push(candidateRecord);
          if (leadKey) batchSeenKeys.add(leadKey);
          batchSeenKeys.add(phoneKey);
        }
      });
    } else {
      const looksLikeHeaderValue = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        return ['nombre', 'name', 'pais', 'country', 'numero', 'número', 'telefono', 'teléfono', 'phone', 'correo', 'email', 'sector', 'subsector', 'origen', 'fecha', 'nota'].includes(raw);
      };

      const looksLikePhoneValue = (value) => {
        const raw = String(value || '').trim();
        const digits = raw.replace(/\D/g, '');
        return digits.length >= 8 && (raw.includes('+') || raw.includes('(') || raw.includes('-') || digits.length >= 10);
      };

      const resolveCountryCodeValue = (value) => {
        const raw = String(value || '').trim();
        if (!raw || looksLikeHeaderValue(raw)) return '';

        const normalized = raw.toUpperCase();
        const byCode = PAISES.find((country) => country.code === normalized);
        if (byCode) return byCode.code;

        const byName = PAISES.find((country) => country.nombre.toLowerCase() === raw.toLowerCase());
        return byName?.code || '';
      };

      lines.forEach(line => {
        if (!line.trim()) return;
        const parts = line.includes('\t') ? line.split('\t') : line.includes(';') ? line.split(';') : line.split(',');
        const cleanParts = parts.map(p => p.trim());
        if (cleanParts.length > 0 && cleanParts.every(looksLikeHeaderValue)) return;

        const [nombre = '', second = '', third = '', fourth = '', fifth = '', sixth = '', seventh = ORIGENES[0], eighth = new Date().toISOString().split('T')[0], ninth = ''] = cleanParts;
        const secondLooksPhone = looksLikePhoneValue(second);
        const thirdLooksPhone = looksLikePhoneValue(third);

        const paisRaw = secondLooksPhone && !thirdLooksPhone ? third : second;
        const numeroRaw = secondLooksPhone && !thirdLooksPhone ? second : third;
        const correo = fourth;
        const sector = fifth;
        const subsector = sixth;
        const origen = seventh || ORIGENES[0];
        const fechaIngreso = eighth;
        const nota = ninth;

        const numero = String(numeroRaw || '').replace(/[^\d+\s-()]/g, '').trim();
        const detectedPais = detectCountryCodeFromPhone(numero, 'OT');
        const explicitPais = resolveCountryCodeValue(paisRaw);
        const safePais = explicitPais || detectedPais;

        const safeSector = resolveSectorId(sector);
        const hasNombre = nombre.length > 0;
        const hasNumero = numero.length > 0;
        const hasCorreo = correo.length > 0;
        const cat = calculateImportedCategory({
          hasNombre,
          hasNumero,
          hasCorreo,
          hasPais: Boolean(safePais && safePais !== 'OT'),
          hasSector: Boolean(safeSector),
        });
        currentCount++;
        const dateObj = new Date(fechaIngreso || new Date());
        const id = `BIG-${safeSector || 'GEN'}-${safePais || 'OT'}-${isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear()}-${isNaN(dateObj.getMonth()) ? String(new Date().getMonth() + 1).padStart(2, '0') : String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(currentCount).padStart(4, '0')}`;

        const newRecord = {
          nombre, pais: safePais, numero, correo, sector: safeSector, subsector, origen,
          fechaIngreso: isNaN(dateObj.getTime()) ? getLocalISODate() : fechaIngreso,
          nota, id, categoria: cat, canal: 'Masivo',
          estadoProspeccion: 'Nuevo', stage: normalizeLeadStage('', { estadoProspeccion: 'Nuevo' }), mensajeEnviado: false, responsable: 'Sin Asignar', propietarioId: currentUser.id, workspaceId: currentUser.workspaceId, inProspecting: false, isArchived: false, historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Importado masivamente (Formato Genérico)' }]
        };
        const leadKey = buildLeadIdentity(newRecord);
        const normalizedPhone = numero ? numero.replace(/\D/g, '') : '';
        const fallbackPhoneKey = normalizedPhone.length >= 8 ? `phone:${normalizedPhone}` : null;
        const isDupInBatch = (leadKey && batchSeenKeys.has(leadKey)) || (fallbackPhoneKey && batchSeenKeys.has(fallbackPhoneKey));

        if (isDupInBatch) {
          newDuplicates.push(newRecord);
        } else {
          newRecords.push(newRecord);
          if (leadKey) batchSeenKeys.add(leadKey);
          if (fallbackPhoneKey) batchSeenKeys.add(fallbackPhoneKey);
        }
      });
    }

    if (newRecords.length > 0 || newDuplicates.length > 0) {
      let importSummary = {
        importedCount: newRecords.length,
        updatedCount: 0,
        duplicateCount: newDuplicates.length,
      };

      if (onImportRecords) {
        importSummary = (await onImportRecords({ newRecords, updatedRecords: [], newDuplicates })) || importSummary;
      } else {
        if (newRecords.length > 0) setRecords(prev => [...newRecords, ...prev]);
        if (newDuplicates.length > 0 && setDuplicateRecords) setDuplicateRecords(prev => [...newDuplicates, ...prev]);
      }

      setSkippedCountInfo(t('add_res_bulk').replace('{n1}', importSummary.importedCount).replace('{n2}', importSummary.duplicateCount));
      setMassiveData('');
      setTimeout(() => {
        setSkippedCountInfo(null);
        if (importSummary.importedCount > 0) setActiveTab('database');
      }, 3000);
    }
  };

  const bulkInputAnalysis = useMemo(() => {
    const raw = String(massiveData || '');
    const linesCount = raw.split('\n').filter((line) => line.trim()).length;
    const lower = raw.toLowerCase();
    const option1 = lower.includes('sector:') && lower.includes('numeros:');
    const option2 = lower.includes('nombre completo') && (lower.includes('telefono') || lower.includes('teléfono'));
    const igCsv = raw.includes('source_username') && raw.includes('full_name');
    const extractedCount = !option1 && !option2 && !igCsv ? extractWhatsAppNumbers(raw).length : 0;

    return {
      detectedCount: extractedCount > 0 ? extractedCount : linesCount,
      isIgCsvDetected: igCsv,
    };
  }, [extractWhatsAppNumbers, massiveData]);
  const detectedLines = bulkInputAnalysis.detectedCount;
  const isIgCsvDetected = bulkInputAnalysis.isIgCsvDetected;

  const detectedWaNumbers = waData ? extractWhatsAppNumbers(waData).length : 0;
  const normalizeWaGroupLabel = useCallback(
    (value) => String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
    [],
  );
  const selectedWaQrGroupData = useMemo(
    () => {
      const matchedGroup = waQrGroups.find((group) => group.id === selectedWaQrGroup) || null;
      if (!matchedGroup && !selectedWaQrGroupMeta) return null;
      return {
        ...(matchedGroup || {}),
        ...(selectedWaQrGroupMeta || {}),
      };
    },
    [selectedWaQrGroup, selectedWaQrGroupMeta, waQrGroups],
  );
  const exportedWaQrGroupCount = useMemo(() => {
    const selectedGroupKey = normalizeWaGroupLabel(selectedWaQrGroupData?.name);
    if (!selectedGroupKey) return 0;

    const matchesSelectedGroup = (record) => {
      if (String(record?.origen || '') !== 'WhatsApp QR Group') {
        return false;
      }

      const subsectorKey = normalizeWaGroupLabel(record?.subsector);
      const noteKey = normalizeWaGroupLabel(record?.nota || record?.notes);
      return subsectorKey === selectedGroupKey || noteKey.includes(selectedGroupKey);
    };

    return [...records, ...duplicateRecords].filter(matchesSelectedGroup).length;
  }, [duplicateRecords, normalizeWaGroupLabel, records, selectedWaQrGroupData?.name]);
  const hasExportedWaQrGroup = exportedWaQrGroupCount > 0;
  const waQrPreviewContacts = useMemo(
    () => waQrParticipants.map((participant, index) => {
      const jid = participant.jid || `participant-${index}`;
      const isAdmin = Boolean(participant.isAdmin);
      const adminRole = String(participant.adminRole || '').toLowerCase();
      const selected = waQrSelection[jid] ?? !isAdmin;
      const roleLabel = adminRole === 'superadmin'
        ? 'Super Admin'
        : adminRole === 'admin'
          ? 'Admin'
          : 'Miembro';

      return {
        jid,
        rol: roleLabel,
        adminRole,
        telefono: participant.phoneNumber || '',
        isAdmin,
        selected,
      };
    }),
    [waQrParticipants, waQrSelection],
  );
  const selectedWaQrPreviewContacts = useMemo(
    () => waQrPreviewContacts.filter((contact) => contact.selected),
    [waQrPreviewContacts],
  );
  const selectedWaQrCount = selectedWaQrPreviewContacts.length;
  const waQrAdminCount = useMemo(
    () => waQrPreviewContacts.filter((contact) => contact.isAdmin).length,
    [waQrPreviewContacts],
  );

  const handleLoadWaQrGroups = useCallback(async () => {
    setIsLoadingWaQrGroups(true);
    setInlineNotice(null);

    try {
      const response = await api.listWhatsAppGroups();
      const groups = Array.isArray(response.items)
        ? response.items.map((group) => ({
            id: group.id,
            name: group.name || 'Grupo sin nombre',
            avatarUrl: group.avatarUrl || '',
          }))
        : [];

      setWaQrGroups(groups);
      setSelectedWaQrGroupMeta(groups[0] || null);
      setWaQrParticipants([]);
      setWaQrSelection({});
      setSelectedWaQrGroup((current) => current || groups[0]?.id || '');

      if (groups.length === 0) {
        setInlineNotice({
          tone: 'warning',
          message: 'No encontramos grupos disponibles en la sesión de WhatsApp conectada.',
        });
      }
    } catch (error) {
      setInlineNotice({
        tone: 'warning',
        message: error?.message || 'No se pudieron cargar tus grupos de WhatsApp.',
      });
    } finally {
      setIsLoadingWaQrGroups(false);
    }
  }, []);

  useEffect(() => {
    if (waGroupStatusPollRef.current) {
      window.clearInterval(waGroupStatusPollRef.current);
      waGroupStatusPollRef.current = null;
    }

    if (inputMode !== 'whatsapp' || whatsAppMode !== 'wa-group') {
      return undefined;
    }

    let cancelled = false;

    const syncWaGroups = async () => {
      if (isLoadingWaQrGroups || waQrGroups.length > 0) {
        return;
      }

      try {
        const response = await api.getWhatsAppStatus();
        if (cancelled) return;

        const status = String(response?.connection?.status || '').toLowerCase();
        if (status === 'open') {
          await handleLoadWaQrGroups();
          if (!cancelled && waGroupStatusPollRef.current) {
            window.clearInterval(waGroupStatusPollRef.current);
            waGroupStatusPollRef.current = null;
          }
        }
      } catch {
        // Keep polling quietly; QR linking may still be in progress.
      }
    };

    syncWaGroups().catch(() => {});
    waGroupStatusPollRef.current = window.setInterval(() => {
      syncWaGroups().catch(() => {});
    }, 3000);

    return () => {
      cancelled = true;
      if (waGroupStatusPollRef.current) {
        window.clearInterval(waGroupStatusPollRef.current);
        waGroupStatusPollRef.current = null;
      }
    };
  }, [handleLoadWaQrGroups, inputMode, isLoadingWaQrGroups, waQrGroups.length, whatsAppMode]);

  useEffect(() => {
    if (inputMode !== 'whatsapp' || whatsAppMode !== 'wa-group' || !selectedWaQrGroup) {
      if (inputMode !== 'whatsapp' || whatsAppMode !== 'wa-group') {
        setWaQrParticipants([]);
      }
      if (!selectedWaQrGroup) {
        setSelectedWaQrGroupMeta(null);
      }
      return;
    }

    let cancelled = false;

    const loadParticipants = async () => {
      setIsLoadingWaQrParticipants(true);
      try {
        const response = await api.listWhatsAppGroupParticipants(selectedWaQrGroup);
        if (cancelled) return;

        const participants = Array.isArray(response.items)
          ? response.items.map((participant, index) => ({
              jid: participant.jid || '',
              phoneNumber: participant.phoneNumber || '',
              name: participant.name || '',
              isAdmin: Boolean(participant.isAdmin),
              adminRole: participant.adminRole || null,
              fallbackName: `Participante ${index + 1}`,
            }))
          : [];

        if (response.group?.id) {
          setSelectedWaQrGroupMeta({
            id: response.group.id,
            name: response.group.name || '',
            avatarUrl: response.group.avatarUrl || '',
          });
          setWaQrGroups((current) =>
            current.map((group) =>
              group.id === response.group.id
                ? {
                    ...group,
                    name: response.group.name || group.name,
                    avatarUrl: response.group.avatarUrl || group.avatarUrl || '',
                  }
                : group,
            ),
          );
        }

        setWaQrParticipants(participants);
        setWaQrSelection(
          participants.reduce((accumulator, participant, index) => {
            const key = participant.jid || `participant-${index}`;
            accumulator[key] = !participant.isAdmin;
            return accumulator;
          }, {}),
        );
      } catch (error) {
        if (cancelled) return;
        setWaQrParticipants([]);
        setWaQrSelection({});
        setInlineNotice({
          tone: 'warning',
          message: error?.message || 'No se pudieron cargar los participantes del grupo seleccionado.',
        });
      } finally {
        if (!cancelled) {
          setIsLoadingWaQrParticipants(false);
        }
      }
    };

    loadParticipants();

    return () => {
      cancelled = true;
    };
  }, [inputMode, selectedWaQrGroup, whatsAppMode]);

  const toggleWaQrContactSelection = useCallback((jid) => {
    setWaQrSelection((current) => ({
      ...current,
      [jid]: !(current[jid] ?? true),
    }));
  }, []);

  const handleExportWaQrCsv = useCallback(() => {
    if (selectedWaQrPreviewContacts.length === 0) return;

    const csvRows = [
      ['Rol', 'Telefono'],
      ...selectedWaQrPreviewContacts.map((contact) => [contact.rol, contact.telefono]),
    ];

    const csvContent = csvRows
      .map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `${selectedWaQrGroupData?.name || 'grupo-whatsapp'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }, [selectedWaQrGroupData?.name, selectedWaQrPreviewContacts]);

  const handleImportWaQrGroup = useCallback(async () => {
    if (selectedWaQrPreviewContacts.length === 0) return;

    const newRecords = [];
    const newDuplicates = [];
    const batchSeenKeys = new Set();
    let currentCount = records.length + duplicateRecords.length;

    selectedWaQrPreviewContacts.forEach((contact) => {
      const formatted = String(contact.telefono || '').trim();
      const digits = formatted.replace(/\D/g, '');
      if (digits.length < 8) return;

      const phoneKey = `phone:${digits}`;
      const paisCode = detectCountryCodeFromPhone(formatted, 'OT');
      const dateObj = new Date();
      currentCount++;
      const id = `BIG-TRA-${paisCode}-${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(currentCount).padStart(4, '0')}`;

      const candidateRecord = {
        nombre: contact.nombre || 'Usuario WA',
        pais: paisCode,
        numero: formatted.startsWith('+') ? formatted : `+${digits}`,
        correo: '',
        sector: 'TRA',
        subsector: selectedWaQrGroupData?.name || 'Lead de Grupo',
        origen: 'WhatsApp QR Group',
        fechaIngreso: getLocalISODate(dateObj),
        nota: selectedWaQrGroupData?.name
          ? `Extraído desde grupo conectado: ${selectedWaQrGroupData.name}`
          : 'Extraído desde grupo conectado de WhatsApp.',
        id,
        categoria: 'C',
        canal: 'WhatsApp',
        estadoProspeccion: 'Nuevo',
        stage: normalizeLeadStage('', { estadoProspeccion: 'Nuevo' }),
        mensajeEnviado: false,
        responsable: 'Sin Asignar',
        propietarioId: currentUser.id,
        workspaceId: currentUser.workspaceId,
        inProspecting: false,
        isArchived: false,
      };

      const leadKey = buildLeadIdentity(candidateRecord);
      const existsInBatch = (leadKey && batchSeenKeys.has(leadKey)) || batchSeenKeys.has(phoneKey);

      if (existsInBatch) {
        newDuplicates.push({
          ...candidateRecord,
          historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Duplicado detectado vía WhatsApp QR Group' }],
        });
        return;
      }

      newRecords.push({
        ...candidateRecord,
        historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Importado vía WhatsApp QR Group' }],
      });
      if (leadKey) batchSeenKeys.add(leadKey);
      batchSeenKeys.add(phoneKey);
    });

    if (newRecords.length === 0 && newDuplicates.length === 0) {
      return;
    }

    let importSummary = {
      importedCount: newRecords.length,
      updatedCount: 0,
      duplicateCount: newDuplicates.length,
    };

    if (onImportRecords) {
      importSummary = (await onImportRecords({ newRecords, updatedRecords: [], newDuplicates })) || importSummary;
    } else {
      if (newRecords.length > 0) setRecords((prev) => [...newRecords, ...prev]);
      if (newDuplicates.length > 0 && setDuplicateRecords) {
        setDuplicateRecords((prev) => [...newDuplicates, ...prev]);
      }
    }

    setSkippedCountInfo(
      t('add_res_wa')
        .replace('{n1}', importSummary.importedCount)
        .replace('{n2}', importSummary.updatedCount)
        .replace('{n3}', importSummary.duplicateCount),
    );

    window.setTimeout(() => {
      setSkippedCountInfo(null);
      if (importSummary.importedCount > 0) setActiveTab('database');
    }, 3000);
  }, [currentUser.id, currentUser.workspaceId, duplicateRecords.length, onImportRecords, records.length, selectedWaQrGroupData?.name, selectedWaQrPreviewContacts, setActiveTab, setDuplicateRecords, setRecords, t]);

  const handleWaSubmit = async (e) => {
    e.preventDefault();
    if (!waData.trim()) return;

    const extractedNumbers = extractWhatsAppNumbers(waData);
    const newRecords = [];
    const newDuplicates = [];
    let currentCount = records.length + duplicateRecords.length;

    const batchSeenKeys = new Set();

    extractedNumbers.forEach(({ formatted, digits }) => {
      const phoneKey = `phone:${digits}`;
      const paisCode = detectCountryCodeFromPhone(formatted, 'OT');
      const dateObj = new Date();
      currentCount++;
      const id = `BIG-${waSector}-${paisCode}-${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(currentCount).padStart(4, '0')}`;

      const candidateRecord = {
        nombre: 'Usuario WA',
        pais: paisCode,
        numero: formatted,
        correo: '',
        sector: waSector,
        subsector: 'Lead de Grupo',
        origen: 'Grupo de WhatsApp',
        fechaIngreso: getLocalISODate(dateObj),
        nota: waNota ? `Extraído de WA: ${waNota}` : 'Extraído vía módulo de WhatsApp.',
        id,
        categoria: 'C',
        canal: 'WhatsApp',
        estadoProspeccion: 'Nuevo',
        stage: normalizeLeadStage('', { estadoProspeccion: 'Nuevo' }),
        mensajeEnviado: false,
        responsable: 'Sin Asignar',
        propietarioId: currentUser.id,
        workspaceId: currentUser.workspaceId,
        inProspecting: false,
        isArchived: false,
      };
      const leadKey = buildLeadIdentity(candidateRecord);
      const existsInBatch = (leadKey && batchSeenKeys.has(leadKey)) || batchSeenKeys.has(phoneKey);

      if (existsInBatch) {
        newDuplicates.push({
          ...candidateRecord,
          historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Duplicado detectado vía Extractor WhatsApp' }],
        });
        return;
      }

      const newRecord = {
        ...candidateRecord,
        historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Importado vía Extractor WhatsApp' }],
      };
      newRecords.push(newRecord);
      if (leadKey) batchSeenKeys.add(leadKey);
      batchSeenKeys.add(phoneKey);
    });

    if (newRecords.length > 0 || newDuplicates.length > 0) {
      let importSummary = {
        importedCount: newRecords.length,
        updatedCount: 0,
        duplicateCount: newDuplicates.length,
      };

      if (onImportRecords) {
        importSummary = (await onImportRecords({ newRecords, updatedRecords: [], newDuplicates })) || importSummary;
      } else {
        setRecords(prev => [...newRecords, ...prev]);

        if (newDuplicates.length > 0 && setDuplicateRecords) {
          setDuplicateRecords(prev => [...newDuplicates, ...prev]);
        }
      }

      setSkippedCountInfo(
        t('add_res_wa')
          .replace('{n1}', importSummary.importedCount)
          .replace('{n2}', importSummary.updatedCount)
          .replace('{n3}', importSummary.duplicateCount),
      );
      setWaData('');
      setWaNota('');
      setTimeout(() => {
        setSkippedCountInfo(null);
        if (importSummary.importedCount > 0) setActiveTab('database');
      }, 3000);
    }
  };

  return (
    <div className="relative h-full overflow-y-auto overflow-x-hidden bg-slate-50/50 p-4 no-scrollbar md:p-8">
      <div className="absolute top-10 right-1/4 w-96 h-96 bg-[#FF5A1F] rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-[120px] opacity-15 pointer-events-none"></div>

      <div className="relative z-10 mx-auto w-full max-w-6xl overflow-hidden rounded-[2.5rem] p-5 glass-panel sm:p-8 xl:p-10">
        <div className="relative z-10 mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="max-w-xl">
            <h2 className="text-2xl font-black text-slate-800 sm:text-3xl">{t('add_title')}</h2>
            <p className="text-slate-400 text-sm mt-1">{t('add_subtitle')}</p>
          </div>

          <div className="flex w-full items-center justify-between gap-4 xl:w-auto xl:justify-end">
            <div className="grid w-full grid-cols-1 gap-1.5 rounded-[1.5rem] border border-slate-200 bg-slate-100 p-1.5 shadow-inner sm:grid-cols-3 xl:w-auto">
              <button type="button" onClick={() => { setInputMode('whatsapp'); setWhatsAppMode('wa-group'); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${inputMode === 'whatsapp' ? 'bg-green-500 text-white shadow-[0_4px_12px_rgba(34,197,94,0.4)]' : 'text-slate-500 hover:text-slate-700'}`}>
                <WhatsAppIcon className="h-[21px] w-[21px] shrink-0" /> WhatsApp QR Group
              </button>
              <button type="button" onClick={() => setInputMode('individual')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${inputMode === 'individual' ? 'bg-white text-[#FF5A1F] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <User size={16} /> {t('add_tab_ind')}
              </button>
              <button type="button" onClick={() => setInputMode('masivo')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${inputMode === 'masivo' ? 'bg-white text-[#FF5A1F] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Users size={16} /> {t('add_tab_bulk')}
              </button>
            </div>
          </div>
        </div>

        {inputMode === 'whatsapp' ? (
          <div className="relative z-10 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {inlineNotice ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                inlineNotice.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}>
                {inlineNotice.message}
              </div>
            ) : null}
            <div className="rounded-[1.85rem] border border-slate-200/70 bg-white/70 px-4 py-3 shadow-sm shadow-slate-200/40 backdrop-blur-sm sm:px-5 sm:py-3.5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">WhatsApp</p>
                  <h3 className="mt-1.5 text-base font-black leading-tight text-slate-800 sm:text-lg xl:text-[1.55rem]">Elige cómo importar tus contactos</h3>
                </div>
                <div className="grid grid-cols-1 gap-1.5 rounded-[1.15rem] border border-slate-200 bg-slate-50 p-1.5 shadow-inner sm:grid-cols-2 lg:min-w-[380px]">
                  <button
                    type="button"
                    onClick={() => setWhatsAppMode('wa-group')}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
                      whatsAppMode === 'wa-group'
                        ? 'bg-white text-[#FF5A1F] shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#FF7A00] to-[#FF5A1F] shadow-[0_4px_10px_rgba(255,90,31,0.24)]">
                      <WhatsAppIcon className="h-[19px] w-[19px] shrink-0 text-white" />
                    </span>
                    WhatsApp QR Group
                  </button>
                  <button
                    type="button"
                    onClick={() => setWhatsAppMode('extractor')}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all ${
                      whatsAppMode === 'extractor'
                        ? 'bg-green-500 text-white shadow-[0_4px_12px_rgba(34,197,94,0.28)]'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Play size={16} className={whatsAppMode === 'extractor' ? 'fill-current' : ''} /> {t('add_tab_wa')}
                  </button>
                </div>
              </div>
            </div>

            {whatsAppMode === 'wa-group' ? (
              <div className="rounded-[2rem] border border-slate-200/70 bg-white/70 p-4 shadow-sm shadow-slate-200/40 backdrop-blur-sm sm:p-5">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">WhatsApp QR Group</p>
                      <h3 className="mt-1 text-base font-black text-slate-800 sm:text-lg">Extrae contactos desde un grupo conectado</h3>
                      <p className="mt-1 max-w-2xl text-sm text-slate-500">
                        Carga tus grupos vinculados, selecciona uno y revisa los contactos antes de exportarlos o enviarlos al directorio.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      <span className={`h-2.5 w-2.5 rounded-full ${isLoadingWaQrGroups ? 'animate-pulse bg-amber-400' : waQrGroups.length > 0 ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                      {isLoadingWaQrGroups ? 'Cargando grupos' : waQrGroups.length > 0 ? 'Grupos listos' : 'Esperando conexion'}
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="relative min-h-[15rem] overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/60 p-3.5 pb-24 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-md">
                      <div className="pointer-events-none absolute -bottom-10 left-4 h-28 w-28 rounded-full bg-[#25D366]/20 blur-3xl" />
                      <div className="pointer-events-none absolute -bottom-8 right-8 h-24 w-24 rounded-full bg-[#00C853]/16 blur-3xl" />
                      <label className="relative mb-2 block pl-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        Seleccionar grupo
                      </label>
                      <div className="group relative">
                        <div className="pointer-events-none absolute inset-0 rounded-[1.85rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,253,244,0.78))] shadow-[0_20px_40px_-24px_rgba(21,128,61,0.45)] transition-all duration-300 group-hover:shadow-[0_24px_48px_-26px_rgba(21,128,61,0.52)]" />
                        <select
                          value={selectedWaQrGroup}
                          onChange={(event) => {
                            const nextGroupId = event.target.value;
                            setSelectedWaQrGroup(nextGroupId);
                            setSelectedWaQrGroupMeta(
                              waQrGroups.find((group) => group.id === nextGroupId) || null,
                            );
                          }}
                          disabled={waQrGroups.length === 0 || isLoadingWaQrGroups}
                          className="relative w-full cursor-pointer appearance-none rounded-[1.85rem] border border-emerald-200/80 bg-white/80 px-5 py-4 pr-16 text-[15px] font-semibold leading-tight text-slate-700 outline-none backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white/92 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100/80 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-slate-400"
                        >
                          <option value="">
                            {isLoadingWaQrGroups
                              ? 'Cargando grupos...'
                              : waQrGroups.length === 0
                                ? 'Esperando conexion de WhatsApp...'
                                : 'Selecciona un grupo'}
                          </option>
                          {waQrGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-emerald-700">
                          <ChevronDown className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="relative mt-3 rounded-2xl border border-white/80 bg-white/65 px-4 py-3 pr-24 text-[15px] leading-6 text-slate-500 shadow-inner shadow-white/40">
                        {selectedWaQrGroupData
                          ? `${waQrPreviewContacts.length} contactos listos para revisar en ${selectedWaQrGroupData.name}.`
                          : 'Todavía no has seleccionado un grupo para extraer contactos.'}
                      </div>
                      <div className="absolute bottom-6 left-4 z-10 max-w-[13.5rem] rounded-[1.35rem] border border-white/80 bg-white/72 px-4 py-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                        <div className={`inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] ${hasExportedWaQrGroup ? 'text-emerald-700' : 'text-sky-700'}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${hasExportedWaQrGroup ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                          {hasExportedWaQrGroup ? 'Ya exportado' : 'Listo para exportar'}
                        </div>
                        <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                          {selectedWaQrGroupData
                            ? hasExportedWaQrGroup
                              ? `${exportedWaQrGroupCount} registros de este grupo ya están en base.`
                              : 'Aún no detectamos exportaciones previas de este grupo.'
                            : 'Selecciona un grupo para revisar su estado antes de exportar.'}
                        </p>
                      </div>
                      <div className="pointer-events-none absolute bottom-5 right-5 z-10">
                        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white/85 bg-gradient-to-br from-[#25D366] via-[#14b856] to-[#00C853] shadow-[0_14px_30px_rgba(37,211,102,0.28)]">
                          {selectedWaQrGroupData?.avatarUrl ? (
                            <img
                              src={selectedWaQrGroupData.avatarUrl}
                              alt={selectedWaQrGroupData.name || 'Grupo de WhatsApp'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <WhatsAppIcon className="h-10 w-10 shrink-0 text-white" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/70 bg-white/80 shadow-inner shadow-slate-100">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-2">
                          <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                            {selectedWaQrCount} seleccionados · {waQrAdminCount} admins
                          </div>
                          <div className="text-xs text-slate-400">
                            Los admins se excluyen por defecto.
                          </div>
                        </div>
                        <div className="grid grid-cols-[42px_1.1fr_1fr] gap-3 border-b border-slate-200/70 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                          <span>Sel</span>
                          <span>Rol</span>
                          <span>Teléfono</span>
                        </div>
                        <div className="max-h-[15.5rem] overflow-y-auto">
                          {isLoadingWaQrParticipants ? (
                            <div className="flex min-h-32 items-center justify-center px-6 py-6 text-center text-sm text-slate-400">
                              Cargando participantes del grupo...
                            </div>
                          ) : waQrPreviewContacts.length > 0 ? (
                            waQrPreviewContacts.map((contact, index) => (
                              <div
                                key={`${contact.telefono || contact.jid}-${index}`}
                                className={`grid grid-cols-[42px_1.1fr_1fr] items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0 ${
                                  contact.isAdmin
                                    ? 'border-red-100 bg-red-50/80'
                                    : 'border-slate-100'
                                }`}
                              >
                                <label className="flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={contact.selected}
                                    onChange={() => toggleWaQrContactSelection(contact.jid)}
                                    className={`h-4 w-4 rounded border-slate-300 text-[#FF5A1F] focus:ring-[#FF5A1F] ${
                                      contact.isAdmin ? 'border-red-300' : ''
                                    }`}
                                  />
                                </label>
                                <div className="min-w-0">
                                  <span className={`block truncate font-semibold ${contact.isAdmin ? 'text-red-700' : 'text-slate-700'}`}>
                                    {contact.rol}
                                  </span>
                                  {contact.adminRole === 'superadmin' ? (
                                    <span className="mt-1 inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700">
                                      Nivel máximo
                                    </span>
                                  ) : contact.isAdmin ? (
                                    <span className="mt-1 inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">
                                      Admin
                                    </span>
                                  ) : null}
                                </div>
                                <span className={`${contact.isAdmin ? 'text-red-500' : 'text-slate-500'}`}>{contact.telefono}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex min-h-32 items-center justify-center px-6 py-6 text-center text-sm text-slate-400">
                              Los contactos extraídos aparecerán aquí cuando elijas un grupo conectado.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-1 flex w-full flex-col items-stretch gap-3 border-t border-slate-200/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
                        {skippedCountInfo ? (
                          <span className="animate-in fade-in rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700 sm:mr-auto">
                            {skippedCountInfo}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleExportWaQrCsv}
                          disabled={selectedWaQrCount === 0 || isLoadingWaQrParticipants}
                          className={`rounded-2xl border px-5 py-3 text-sm font-bold transition-all sm:min-w-[148px] ${
                            selectedWaQrCount > 0 && !isLoadingWaQrParticipants
                              ? 'border-slate-200 bg-white text-slate-700 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.22)] hover:-translate-y-0.5 hover:border-orange-200 hover:text-[#FF5A1F]'
                              : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                          }`}
                        >
                          Exportar CSV
                        </button>
                        <button
                          type="button"
                          onClick={handleImportWaQrGroup}
                          disabled={selectedWaQrCount === 0 || isLoadingWaQrParticipants || isViewOnly}
                          className={`rounded-2xl px-5 py-3 text-sm font-bold text-white transition-all sm:min-w-[220px] ${
                            selectedWaQrCount > 0 && !isLoadingWaQrParticipants && !isViewOnly
                              ? 'bg-gradient-to-r from-[#FF3C00] via-[#FF7A00] to-[#FFB36B] shadow-[0_14px_28px_-16px_rgba(255,90,31,0.55)] hover:-translate-y-0.5 hover:brightness-110 active:brightness-95'
                              : 'cursor-not-allowed bg-slate-300'
                          }`}
                        >
                          Añadir al Directorio
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start">
                <div className="flex items-start gap-4 rounded-3xl border border-green-200 bg-green-50 p-4 sm:p-6 xl:h-full">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0 mt-1"><MessageCircle size={20} /></div>
                  <div>
                    <h3 className="font-bold text-green-800 mb-1">{t('add_wa_help_title')}</h3>
                    <ol className="text-sm text-green-700/80 space-y-1.5 list-decimal list-inside marker:font-bold">
                      <li>{t('add_wa_help_1')}</li>
                      <li>{t('add_wa_help_2')}</li>
                    </ol>
                    <p className="text-xs text-green-700/60 mt-3 italic">{t('add_wa_help_note')}</p>

                    <button
                      type="button"
                      onClick={() => setShowWaHelpVideo(true)}
                      className="inline-flex items-center gap-2 mt-4 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-green-600/20 transition-all active:scale-95"
                    >
                      <Play size={14} className="fill-current" /> {t('add_wa_help_btn')}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-4">{t('add_wa_sector')}</label>
                      <select value={waSector} onChange={(e) => setWaSector(e.target.value)} className="w-full px-6 py-3.5 bg-slate-50/50 border border-slate-200/60 rounded-full focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all text-sm appearance-none">
                        {activeSectors.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-4">{t('add_wa_note')}</label>
                      <input type="text" value={waNota} onChange={handleWaNotaChange} placeholder={t('add_wa_note_ph')} className="w-full px-6 py-3.5 bg-slate-50/50 border border-slate-200/60 rounded-full focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all text-sm" />
                    </div>
                  </div>

                  <div className="relative overflow-hidden">
                    <textarea value={waData} onChange={e => setWaData(e.target.value)} className="w-full px-6 py-5 bg-slate-50/50 border border-slate-200/60 rounded-3xl focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all text-sm font-mono placeholder:text-slate-300 min-h-[220px] xl:min-h-[260px] shadow-inner" placeholder={t('add_wa_data_ph')} />
                    <div className="flex justify-between items-center mt-3 px-2">
                      <span className="text-xs text-slate-400 font-medium">{t('add_wa_ignore')}</span>
                      <span className={`text-xs font-bold uppercase tracking-wider ${detectedWaNumbers > 0 ? 'text-green-600' : 'text-slate-400'}`}>{detectedWaNumbers} {t('add_wa_valid_num')}</span>
                    </div>
                  </div>
                  <div className="flex w-full flex-col items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                    {skippedCountInfo && <span className="animate-in fade-in rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-600 sm:mr-auto">{skippedCountInfo}</span>}
                    <button type="button" onClick={handleWaSubmit} disabled={detectedWaNumbers === 0 || isViewOnly} className={`px-8 py-3.5 rounded-full font-bold shadow-lg transition-colors flex items-center gap-2 ${detectedWaNumbers > 0 && !isViewOnly ? 'bg-green-500 text-white hover:bg-green-600 shadow-[0_8px_20px_-6px_rgba(34,197,94,0.5)] cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{t('add_wa_btn')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : inputMode === 'individual' ? (
          <form onSubmit={handleSubmit} className="relative z-10 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {inlineNotice ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                inlineNotice.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}>
                {inlineNotice.message}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 md:gap-6">
              <InputUI label={t('add_ind_name')} name="nombre" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} placeholder={t('add_ind_name_ph')} />
              <InputUI label={t('add_ind_phone')} name="numero" value={formData.numero} onChange={handlePhoneChange} placeholder="+51 987 654 321" />
              <SelectUI label={t('add_ind_country')} name="pais" value={formData.pais} onChange={handleCountryChange} options={PAISES.map(p => ({ code: p.code, nombre: `${p.flag} ${p.nombre}` }))} />
              <InputUI label={t('add_ind_email')} type="email" name="correo" value={formData.correo} onChange={e => setFormData({ ...formData, correo: e.target.value })} placeholder="carlos@email.com" />
              <SelectUI label={t('add_ind_sector')} name="sector" value={formData.sector} onChange={e => setFormData({ ...formData, sector: e.target.value })} options={activeSectors.map((s) => ({ code: s.id, nombre: s.nombre }))} />
              <InputUI label={t('add_ind_subsector')} name="subsector" value={formData.subsector} onChange={e => handleNotaOpcionesChange(e, 'subsector')} placeholder={t('add_ind_subsector_ph')} />
              <SelectUI label={t('add_ind_origin')} name="origen" value={formData.origen} onChange={e => setFormData({ ...formData, origen: e.target.value })} options={ORIGENES} />
              <InputUI label={t('add_ind_date')} type="date" name="fechaIngreso" value={formData.fechaIngreso} onChange={e => setFormData({ ...formData, fechaIngreso: e.target.value })} />
            </div>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-4">{t('add_ind_notes')}</label>
                <textarea value={formData.nota || ''} onChange={e => handleNotaOpcionesChange(e, 'nota')} className="w-full px-6 py-4 bg-slate-50/50 border border-slate-200/60 rounded-3xl focus:bg-white focus:ring-2 focus:ring-orange-100 focus:border-[#FF5A1F] outline-none transition-all text-sm placeholder:text-slate-400 min-h-[180px] resize-none" placeholder={t('add_ind_notes_ph')} />
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <div>
                    <h4 className="font-bold text-sm text-orange-950">{t('add_ind_send_ws')}</h4>
                    <p className="text-xs text-orange-700/80 mt-0.5">{t('add_ind_send_ws_desc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={formData.sendToProspecting} onChange={(e) => setFormData({ ...formData, sendToProspecting: e.target.checked })} />
                    <div className="w-11 h-6 bg-orange-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF5A1F]"></div>
                  </label>
                </div>

                <div className="mt-auto flex justify-end gap-4">
                  <button type="submit" disabled={isViewOnly} className={`px-8 py-3.5 rounded-full text-white font-bold transition-all flex items-center gap-2 ${isViewOnly ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-[#FF3C00] via-[#FF7A00] to-[#FFB36B] shadow-[0_8px_20px_-6px_rgba(255,90,31,0.5)] hover:brightness-110 active:brightness-90'}`}>{t('add_ind_btn')}</button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="relative z-10 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {inlineNotice ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                inlineNotice.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}>
                {inlineNotice.message}
              </div>
            ) : null}
            <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-blue-200 bg-blue-50 p-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-blue-800 text-sm">{t('add_bulk_test_title')}</h3>
                  <p className="text-xs text-blue-700/80 mt-0.5">{t('add_bulk_test_desc')}</p>
                </div>
              </div>
              <a
                href="/leads_ficticios_578.csv"
                download="leads_ficticios_578.csv"
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-600/20 transition-all active:scale-95"
              >
                <Download size={14} className="fill-current" /> {t('add_bulk_test_btn')}
              </a>
            </div>

            <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <div className="group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-5 text-center transition-colors hover:bg-orange-50 sm:p-8 xl:h-full">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform"><Download size={28} className="text-[#FF5A1F]" /></div>
                <span className="text-lg font-bold text-slate-700 mb-1">{t('add_bulk_upload_title')}</span>
                <p className="text-xs text-slate-500 max-w-sm">{t('add_bulk_upload_desc_1')}<strong>{t('add_bulk_upload_desc_2')}</strong>{t('add_bulk_upload_desc_3')}</p>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </div>
              <div className="space-y-4">
                <div className="relative overflow-hidden">
                  <textarea value={massiveData} onChange={e => { setMassiveData(e.target.value); }} className={`w-full px-6 py-5 bg-slate-50/50 border ${isIgCsvDetected ? 'border-purple-300 ring-4 ring-purple-100' : 'border-slate-200/60'} rounded-3xl focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-xs font-mono placeholder:text-slate-300 min-h-[240px] xl:min-h-[320px] whitespace-pre shadow-inner`} placeholder={t('add_bulk_textarea_ph')} />
                  <div className="flex justify-end items-center mt-2 pr-2 text-xs font-bold text-slate-400 uppercase tracking-wider"><span className={detectedLines > 0 ? 'text-emerald-500' : ''}>{detectedLines} {t('add_bulk_rows_ready')}</span></div>
                </div>
                <div className="flex w-full flex-col items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                  {skippedCountInfo && <span className="animate-in fade-in rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-600 sm:mr-auto">{skippedCountInfo}</span>}
                  <button type="button" onClick={handleMassiveSubmit} disabled={detectedLines === 0 || isViewOnly} className={`px-8 py-3.5 rounded-full font-bold shadow-lg transition-colors flex items-center gap-2 ${detectedLines > 0 && !isViewOnly ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_8px_20px_-6px_rgba(5,150,105,0.5)] cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{t('add_bulk_btn')}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showWaHelpVideo ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onClick={() => setShowWaHelpVideo(false)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/12 bg-neutral-950/95 shadow-[0_28px_100px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowWaHelpVideo(false)}
              className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-black/40 text-white transition hover:bg-black/60"
              aria-label="Cerrar video"
            >
              <X size={20} />
            </button>
            <div className="border-b border-white/10 px-6 py-5 pr-20">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-green-400/80">
                Extractor WA
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Aprende como extraer nuevos contactos por WhatsApp
              </h3>
            </div>
            <div className="bg-black p-3 sm:p-4">
              <video
                src="/wa-extractor-guide.mp4"
                controls
                playsInline
                controlsList="nodownload"
                disablePictureInPicture
                className="w-full rounded-[1.5rem] bg-black"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
