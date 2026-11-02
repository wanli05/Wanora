// Full page loads drop all client router state; wrapped so tests can mock them.
export function reloadPage(): void {
  window.location.reload();
}

export function loadPage(path: string): void {
  window.location.assign(path);
}
