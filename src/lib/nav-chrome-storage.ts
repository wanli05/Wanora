export const NAV_COLLAPSED_STORAGE_KEY = "wanora:nav-collapsed";

let memoryCollapsed = false;
let memoryReady = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function readNavCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeNavCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      NAV_COLLAPSED_STORAGE_KEY,
      collapsed ? "1" : "0",
    );
  } catch {
    // Ignore quota / private-mode failures; in-memory state still works.
  }
}

export function getNavCollapsedSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  if (!memoryReady) {
    memoryCollapsed = readNavCollapsed();
    memoryReady = true;
  }
  return memoryCollapsed;
}

export function getNavCollapsedServerSnapshot(): boolean {
  return false;
}

export function setNavCollapsedSnapshot(next: boolean): void {
  memoryCollapsed = next;
  memoryReady = true;
  writeNavCollapsed(next);
  emit();
}

export function subscribeNavCollapsed(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
