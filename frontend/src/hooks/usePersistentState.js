import { useEffect, useState } from 'react';
import { readStoredValue, writeStoredValue } from '../utils/storage';

export function usePersistentState(key, fallback, validate) {
  const [value, setValue] = useState(() => {
    try {
      return readStoredValue(window.localStorage, key, fallback, validate);
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      writeStoredValue(window.localStorage, key, value);
    } catch {
      // Some browser privacy settings also block access to the storage object.
    }
  }, [key, value]);

  return [value, setValue];
}
