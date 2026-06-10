// Thin, crash-proof wrappers around localStorage. Reading/parsing can throw
// (private-mode browsers, quota, corrupt JSON), so every access is guarded and
// falls back to a default rather than taking the app down.

export const readJson = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writeJson = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write failures (quota/private mode) — persistence is best-effort.
  }
};
