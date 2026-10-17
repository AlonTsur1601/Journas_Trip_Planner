export function followCalendarDay(selected: string, previous: string, current: string) {
  return previous !== current && selected === previous ? current : null;
}

export function observeClock(tick: () => void) {
  let boundary: ReturnType<typeof setTimeout>;
  const schedule=()=>{
    boundary=setTimeout(()=>{tick();schedule();},60000-Date.now()%60000+10);
  };
  const resume=()=>{clearTimeout(boundary);tick();schedule();};
  schedule();
  document.addEventListener("visibilitychange",resume);
  window.addEventListener("focus",resume);
  return()=>{clearTimeout(boundary);document.removeEventListener("visibilitychange",resume);window.removeEventListener("focus",resume);};
}
