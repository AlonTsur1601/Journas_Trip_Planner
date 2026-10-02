export function followCalendarDay(selected: string, previous: string, current: string) {
  return previous !== current && selected === previous ? current : null;
}

export function observeClock(tick: () => void) {
  const interval = setInterval(tick, 30000);
  let midnight: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const next = new Date();
    next.setHours(24, 0, 0, 0);
    midnight = setTimeout(() => { tick(); schedule(); }, next.getTime() - Date.now() + 10);
  };
  schedule();
  document.addEventListener("visibilitychange", tick);
  return () => {
    clearInterval(interval);
    clearTimeout(midnight);
    document.removeEventListener("visibilitychange", tick);
  };
}
