import { afterEach, describe, expect, it, vi } from "vitest";
import { followCalendarDay, observeClock } from "../src/day-clock";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("midnight calendar follow", () => {
  it("follows today across month and year boundaries, preserving planned dates", () => {
    expect(followCalendarDay("2026-12-31", "2026-12-31", "2027-01-01")).toBe("2027-01-01");
    expect(followCalendarDay("2027-01-07", "2026-12-31", "2027-01-01")).toBeNull();
    expect(followCalendarDay("2026-12-20", "2026-12-31", "2027-01-01")).toBeNull();
    expect(followCalendarDay("2026-10-02", "2026-10-02", "2026-10-02")).toBeNull();
  });
  it("ticks immediately after midnight, reschedules each minute, and cancels on cleanup", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 2, 23, 59, 59, 900));
    vi.stubGlobal("document", new EventTarget());
    vi.stubGlobal("window",new EventTarget());
    const tick = vi.fn();
    const stop = observeClock(tick);
    vi.advanceTimersByTime(110);
    expect(tick).toHaveBeenCalledOnce();
    expect(new Date().getDate()).toBe(3);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(tick).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(60000);
    expect(tick).toHaveBeenCalledTimes(3);
    window.dispatchEvent(new Event("focus"));
    expect(tick).toHaveBeenCalledTimes(4);
    stop();
    expect(vi.getTimerCount()).toBe(0);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(tick).toHaveBeenCalledTimes(4);
  });
  it("follows midnight in the displayed timezone and updates the next minute",()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-12-31T18:29:59.900Z'));
    vi.stubGlobal('document',new EventTarget());vi.stubGlobal('window',new EventTarget());
    const format=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
    let selected=format.format(new Date()),previous=selected;
    const times:string[]=[];
    const stop=observeClock(()=>{const next=format.format(new Date());selected=followCalendarDay(selected,previous,next)??selected;previous=next;times.push(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()));});
    vi.advanceTimersByTime(110);
    expect(selected).toBe('2027-01-01');expect(times).toEqual(['00:00']);
    vi.advanceTimersByTime(60000);expect(times).toEqual(['00:00','00:01']);stop();
  });
});
