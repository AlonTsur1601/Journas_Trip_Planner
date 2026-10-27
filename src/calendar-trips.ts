import type {Trip} from './types';

/** The original staging fixtures have an account prefix in their saved names. */
export function calendarTripName(trip: Trip): string {
 return trip.calendarDemoGroup === 'paris-original-demo'
  ? trip.name.replace(/^(tourist|traveler|adventurer) · /, '')
  : trip.name;
}

/** Explicitly marked staging copies share one calendar entry; unrelated trips never merge. */
export function calendarTripsForDisplay(trips: Trip[], currentTripId?: string): Trip[] {
 const grouped = new Map<string, Trip>();
 for (const trip of trips) {
  const key = trip.calendarDemoGroup ? `demo:${trip.calendarDemoGroup}:${trip.startDate}:${trip.endDate}` : `trip:${trip.id}`;
  if (!grouped.has(key) || trip.id === currentTripId) grouped.set(key, trip);
 }
 return [...grouped.values()];
}
