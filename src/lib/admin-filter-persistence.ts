// Refonte admin mai 2026 — PR 12 polish UX (ADR 0028, audit A8 #6).
//
// Helpers localStorage pour persistance des filtres admin (status, search,
// sort, etc.). Namespaced par page key. Pure module, no React.
//
// SSR-safe : guards `typeof window === "undefined"`.

const PREFIX = "axion-admin-filters:";

export interface AdminFilterState {
  [key: string]: string | number | boolean | null | undefined;
}

export function loadAdminFilters<T extends AdminFilterState>(pageKey: string, defaults: T): T {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(PREFIX + pageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveAdminFilters<T extends AdminFilterState>(pageKey: string, state: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + pageKey, JSON.stringify(state));
  } catch {
    // Quota / private mode — silent no-op (filters reset à reload).
  }
}

export function clearAdminFilters(pageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIX + pageKey);
  } catch {
    // ignore
  }
}
