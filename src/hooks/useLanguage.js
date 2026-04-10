import { useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../lib/constants';
import { readStorage, writeStorage } from '../lib/storage';

const getLanguageKey = (scope = 'guest') => `${STORAGE_KEYS.language}:${scope}`;

export function useLanguage(defaultLanguage = 'es', scope = 'guest') {
  const storageKey = getLanguageKey(scope);
  const [language, setLanguage] = useState(() => readStorage(storageKey, defaultLanguage));

  useEffect(() => {
    setLanguage(readStorage(storageKey, defaultLanguage));
  }, [storageKey, defaultLanguage]);

  useEffect(() => {
    writeStorage(storageKey, language);
  }, [language, storageKey]);

  return [language, setLanguage];
}
