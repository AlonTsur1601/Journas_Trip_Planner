const recoveryKey = 'journas-module-recovery';

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading (?:CSS )?chunk .* failed|Unable to preload CSS/i.test(message);
}

/** A stale deployment chunk can only be recovered by loading the current entry. */
export function reloadAfterModuleFailure(error: unknown): boolean {
  if (!isModuleLoadError(error) || !navigator.onLine) return false;
  try {
    const previous = Number(sessionStorage.getItem(recoveryKey));
    if (previous && Date.now() - previous < 60_000) return false;
    // Persist before navigating so a broken deployment cannot create a reload loop.
    sessionStorage.setItem(recoveryKey, String(Date.now()));
  } catch {
    // Without a persistent guard, keep the recovery button instead of auto-reloading.
    return false;
  }
  window.location.reload();
  return true;
}

export function installModuleRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    reloadAfterModuleFailure((event as Event & { payload: unknown }).payload);
  });
}
