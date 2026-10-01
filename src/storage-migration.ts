// Upgrade existing drafts/layouts on the former site's domain without losing
// edits. Keep an already-present new key, and leave recovery data on failure.
export function migratePlannerStorage(storage: Storage) {
  try {
    const keys = Array.from({ length: storage.length }, (_, i) =>
      storage.key(i),
    );
    for (const key of keys) {
      if (!key || !/^(origin|tevel)-(drafts|layout|viewlayout):/.test(key)) continue;
      const next = key.replace(/^(origin|tevel)-/, "journas-");
      const value = storage.getItem(key);
      if (value === null) continue;
      if (storage.getItem(next) === null) storage.setItem(next, value);
      // A differing newer draft must not cause the older recovery copy to vanish.
      if (storage.getItem(next) === value) storage.removeItem(key);
    }
  } catch {
    // Storage can be blocked/full; the original recovery data stays untouched.
  }
}
