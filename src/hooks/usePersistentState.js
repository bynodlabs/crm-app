import { useCallback, useEffect, useRef, useState } from 'react';
import { readStorage, removeStorage, writeStorage } from '../lib/storage';

export function usePersistentState(key, initialValue) {
  const initialValueRef = useRef(initialValue);
  const [state, setState] = useState(() => ({
    key,
    value: readStorage(key, initialValue),
  }));

  useEffect(() => {
    initialValueRef.current = initialValue;
  }, [initialValue]);

  const value = state.key === key ? state.value : readStorage(key, initialValue);

  const setValue = useCallback((nextValue) => {
    setState((prev) => {
      const baseValue =
        prev.key === key ? prev.value : readStorage(key, initialValueRef.current);
      const resolvedValue = typeof nextValue === 'function' ? nextValue(baseValue) : nextValue;
      return { key, value: resolvedValue };
    });
  }, [key]);

  useEffect(() => {
    if (value === null || typeof value === 'undefined') {
      removeStorage(key);
      return;
    }

    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue];
}
