import { useEffect, useState } from "react";
import { readJson, writeJson } from "../utils/storage";

// useState that persists to localStorage under `key`. The initial value is read
// back from storage on first render (lazy initializer so it runs only once), and
// every change is written back. Returns the same [value, setValue] shape as
// useState, so callers can pass either a value or an updater function.
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => readJson(key, initialValue));

  useEffect(() => {
    writeJson(key, value);
  }, [key, value]);

  return [value, setValue];
}
