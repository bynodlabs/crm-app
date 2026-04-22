import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { normalizeRecordCountry } from '../lib/country';

export function useBackendSync({
  sessionToken,
  setUsersDb,
  setRecords,
  setDuplicateRecords,
  setSharedLinks,
}) {
  const [backendStatus, setBackendStatus] = useState('idle');
  const isBackendReachable = Boolean(sessionToken) && backendStatus === 'reachable';

  useEffect(() => {
    if (!sessionToken) {
      setUsersDb([]);
      setRecords([]);
      setDuplicateRecords([]);
      setSharedLinks([]);
      setBackendStatus('idle');
      return undefined;
    }

    let isCancelled = false;

    Promise.all([api.listUsers(), api.listAllRecords(), api.listDuplicates(), api.listSharedLinks()])
      .then(([usersResult, recordsResult, duplicatesResult, linksResult]) => {
        if (isCancelled) return;

        setUsersDb(usersResult.items || []);
        setRecords((recordsResult.items || []).map(normalizeRecordCountry));
        setDuplicateRecords((duplicatesResult.items || []).map(normalizeRecordCountry));
        setSharedLinks(linksResult.items || []);
        setBackendStatus('reachable');
      })
      .catch(() => {
        if (isCancelled) return;
        setBackendStatus('unreachable');
      });

    return () => {
      isCancelled = true;
    };
  }, [sessionToken, setDuplicateRecords, setRecords, setSharedLinks, setUsersDb]);

  return { isBackendReachable };
}
