import { ApiError } from './types.js';
/** Resolve a dated wall-clock time against IANA rules, never silently shifting a DST gap. */
export function resolveWallTime(date: string, time: string, timezone: string, disambiguation: unknown = null): number {
    const wall = Date.parse(`${date}T${time === '24:00' ? '00:00' : time}:00Z`) + (time === '24:00' ? 86400000 : 0);
    const formatter = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const formatted = (epoch: number) => {
        const parts = formatter.formatToParts(epoch);
        const p = (key: string) => Number(parts.find(part => part.type === key)!.value);
        return Date.UTC(p('year'), p('month') - 1, p('day'), p('hour'), p('minute'), p('second'));
    };
    const offsets = new Set<number>();
    // Probe both sides of every possible civil offset and DST boundary around this day.
    for (let hours = -36; hours <= 36; hours += 6) {
        const epoch = wall + hours * 3600000;
        offsets.add(formatted(epoch) - epoch);
    }
    const candidates = [...offsets].map(offset => wall - offset).filter(epoch => formatted(epoch) === wall).sort((a, b) => a - b);
    if (!candidates.length)
        throw new ApiError(400, 'NONEXISTENT_TIME', `${time} does not exist on ${date} in ${timezone} because the clocks change. Choose another time.`, { date, time, timezone });
    if (candidates.length > 1 && disambiguation !== 'earlier' && disambiguation !== 'later')
        throw new ApiError(409, 'AMBIGUOUS_TIME', `${time} occurs twice on ${date} in ${timezone}. Choose the earlier or later occurrence.`, { date, time, timezone, candidates });
    return disambiguation === 'later' ? candidates[candidates.length - 1]! : candidates[0]!;
}
