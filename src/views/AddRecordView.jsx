import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, MessageCircle, Play, User, Users, X } from 'lucide-react';
import { ORIGENES, PAISES } from '../lib/constants';
import { detectCountryCodeFromPhone } from '../lib/country';
import { getLocalISODate, getLocalISOTime } from '../lib/date';
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
  const [massiveData, setMassiveData] = useState('');
  const [waData, setWaData] = useState('');
  const [waSector, setWaSector] = useState('TRA');
  const [waNota, setWaNota] = useState('');
  const [skippedCountInfo, setSkippedCountInfo] = useState(null);
  const [showWaHelpVideo, setShowWaHelpVideo] = useState(false);
  const [inlineNotice, setInlineNotice] = useState(null);

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

  const decodeHtmlEntities = (value = '') => {
    if (typeof document === 'undefined') {
      return String(value || '');
    }

    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value;
  };

  const extractWhatsAppNumbers = (rawValue = '') => {
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
  };

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
          estadoProspeccion: 'Nuevo', mensajeEnviado: false, responsable: 'Sin Asignar', propietarioId: currentUser.id, workspaceId: currentUser.workspaceId, inProspecting: false, isArchived: false, historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Importado masivamente vía Instagram Scraping' }]
        };
        const leadKey = buildLeadIdentity(newRecord);
        const isDup = leadKey && batchSeenKeys.has(leadKey);

        if (isDup) newDuplicates.push(newRecord);
        else {
          newRecords.push(newRecord);
          if (leadKey) batchSeenKeys.add(leadKey);
        }
      }
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
          estadoProspeccion: 'Nuevo', mensajeEnviado: false, responsable: 'Sin Asignar', propietarioId: currentUser.id, workspaceId: currentUser.workspaceId, inProspecting: false, isArchived: false, historial: [{ fecha: getLocalISOTime(dateObj), accion: 'Importado masivamente (Formato Genérico)' }]
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

  const detectedLines = massiveData.split('\n').filter(l => l.trim()).length;
  const isIgCsvDetected = massiveData.includes('source_username') && massiveData.includes('full_name');

  const detectedWaNumbers = waData ? extractWhatsAppNumbers(waData).length : 0;

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

      <div className="relative z-10 mx-auto w-full max-w-3xl overflow-hidden rounded-[2.5rem] p-5 glass-panel sm:p-8 md:p-12">
        <div className="relative z-10 mb-8 flex flex-col items-start justify-between gap-5 md:mb-10 md:flex-row md:items-center md:gap-6">
          <div>
            <h2 className="text-2xl font-black text-slate-800 sm:text-3xl">{t('add_title')}</h2>
            <p className="text-slate-400 text-sm mt-1">{t('add_subtitle')}</p>
          </div>

          <div className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-end">
            <div className="grid w-full grid-cols-3 gap-1.5 rounded-[1.5rem] border border-slate-200 bg-slate-100 p-1.5 shadow-inner md:flex md:w-auto">
              <button type="button" onClick={() => setInputMode('whatsapp')} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${inputMode === 'whatsapp' ? 'bg-green-500 text-white shadow-[0_4px_12px_rgba(34,197,94,0.4)]' : 'text-slate-500 hover:text-slate-700'}`}>
                <MessageCircle size={16} /> {t('add_tab_wa')}
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
            <div className="flex items-start gap-4 rounded-3xl border border-green-200 bg-green-50 p-4 sm:p-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <textarea value={waData} onChange={e => setWaData(e.target.value)} className="w-full px-6 py-6 bg-slate-50/50 border border-slate-200/60 rounded-3xl focus:bg-white focus:ring-2 focus:ring-green-100 focus:border-green-400 outline-none transition-all text-sm font-mono placeholder:text-slate-300 min-h-[150px] shadow-inner" placeholder={t('add_wa_data_ph')} />
              <div className="flex justify-between items-center mt-3 px-2">
                <span className="text-xs text-slate-400 font-medium">{t('add_wa_ignore')}</span>
                <span className={`text-xs font-bold uppercase tracking-wider ${detectedWaNumbers > 0 ? 'text-green-600' : 'text-slate-400'}`}>{detectedWaNumbers} {t('add_wa_valid_num')}</span>
              </div>
            </div>
            <div className="flex w-full flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              {skippedCountInfo && <span className="animate-in fade-in rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-600 sm:mr-auto">{skippedCountInfo}</span>}
              <button type="button" onClick={handleWaSubmit} disabled={detectedWaNumbers === 0 || isViewOnly} className={`px-8 py-3.5 rounded-full font-bold shadow-lg transition-colors flex items-center gap-2 ${detectedWaNumbers > 0 && !isViewOnly ? 'bg-green-500 text-white hover:bg-green-600 shadow-[0_8px_20px_-6px_rgba(34,197,94,0.5)] cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{t('add_wa_btn')}</button>
            </div>
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
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
              <InputUI label={t('add_ind_name')} name="nombre" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} placeholder={t('add_ind_name_ph')} />
              <InputUI label={t('add_ind_phone')} name="numero" value={formData.numero} onChange={handlePhoneChange} placeholder="+51 987 654 321" />
              <SelectUI label={t('add_ind_country')} name="pais" value={formData.pais} onChange={handleCountryChange} options={PAISES.map(p => ({ code: p.code, nombre: `${p.flag} ${p.nombre}` }))} />
              <InputUI label={t('add_ind_email')} type="email" name="correo" value={formData.correo} onChange={e => setFormData({ ...formData, correo: e.target.value })} placeholder="carlos@email.com" />
              <SelectUI label={t('add_ind_sector')} name="sector" value={formData.sector} onChange={e => setFormData({ ...formData, sector: e.target.value })} options={activeSectors.map((s) => ({ code: s.id, nombre: s.nombre }))} />
              <InputUI label={t('add_ind_subsector')} name="subsector" value={formData.subsector} onChange={e => handleNotaOpcionesChange(e, 'subsector')} placeholder={t('add_ind_subsector_ph')} />
              <SelectUI label={t('add_ind_origin')} name="origen" value={formData.origen} onChange={e => setFormData({ ...formData, origen: e.target.value })} options={ORIGENES} />
              <InputUI label={t('add_ind_date')} type="date" name="fechaIngreso" value={formData.fechaIngreso} onChange={e => setFormData({ ...formData, fechaIngreso: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-4">{t('add_ind_notes')}</label>
              <textarea value={formData.nota || ''} onChange={e => handleNotaOpcionesChange(e, 'nota')} className="w-full px-6 py-3.5 bg-slate-50/50 border border-slate-200/60 rounded-3xl focus:bg-white focus:ring-2 focus:ring-orange-100 focus:border-[#FF5A1F] outline-none transition-all text-sm placeholder:text-slate-400 min-h-[100px] resize-none" placeholder={t('add_ind_notes_ph')} />
            </div>

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

            <div className="pt-2 flex justify-end gap-4">
              <button type="submit" disabled={isViewOnly} className={`px-8 py-3.5 rounded-full text-white font-bold transition-all flex items-center gap-2 ${isViewOnly ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-[#FF3C00] via-[#FF7A00] to-[#FFB36B] shadow-[0_8px_20px_-6px_rgba(255,90,31,0.5)] hover:brightness-110 active:brightness-90'}`}>{t('add_ind_btn')}</button>
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

            <div className="group relative flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-orange-200 bg-orange-50/50 p-5 text-center transition-colors hover:bg-orange-50 sm:p-8">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform"><Download size={28} className="text-[#FF5A1F]" /></div>
              <span className="text-lg font-bold text-slate-700 mb-1">{t('add_bulk_upload_title')}</span>
              <p className="text-xs text-slate-500 max-w-sm">{t('add_bulk_upload_desc_1')}<strong>{t('add_bulk_upload_desc_2')}</strong>{t('add_bulk_upload_desc_3')}</p>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
            <div className="relative overflow-hidden">
              <textarea value={massiveData} onChange={e => { setMassiveData(e.target.value); }} className={`w-full px-6 py-6 bg-slate-50/50 border ${isIgCsvDetected ? 'border-purple-300 ring-4 ring-purple-100' : 'border-slate-200/60'} rounded-3xl focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-xs font-mono placeholder:text-slate-300 min-h-[150px] whitespace-pre shadow-inner`} placeholder={t('add_bulk_textarea_ph')} />
              <div className="flex justify-end items-center mt-2 pr-2 text-xs font-bold text-slate-400 uppercase tracking-wider"><span className={detectedLines > 0 ? 'text-emerald-500' : ''}>{detectedLines} {t('add_bulk_rows_ready')}</span></div>
            </div>
            <div className="flex w-full flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              {skippedCountInfo && <span className="animate-in fade-in rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-600 sm:mr-auto">{skippedCountInfo}</span>}
              <button type="button" onClick={handleMassiveSubmit} disabled={detectedLines === 0 || isViewOnly} className={`px-8 py-3.5 rounded-full font-bold shadow-lg transition-colors flex items-center gap-2 ${detectedLines > 0 && !isViewOnly ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_8px_20px_-6px_rgba(5,150,105,0.5)] cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>{t('add_bulk_btn')}</button>
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
