import data from '../data/events.json';

export type ListingEvent = {
  slug: string;
  title: string;
  start: string;
  end: string | null;
  city: string;
  venue: string;
  address: string;
  category: string;
  cost: string;
  audience: string;
  url: string;
  blurb: string;
  /** Optional board time override (e.g. "From noon") when the primary gives no clock range. */
  timeLabel?: string;
};

export type Issue = {
  weekStart: string;
  weekEnd: string;
  label: string;
};

export type EventsFile = {
  issue: Issue;
  nextIssue: Issue;
  lastIssue: Issue;
  events: ListingEvent[];
};

export const catalog = data as EventsFile;
export const nextIssue = catalog.nextIssue;
export const lastIssue = catalog.lastIssue;

const TZ = 'America/Los_Angeles';

const weekdayLong = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'long',
});

const weekdayShort = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
});

const dateLong = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const dateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Date-only events (start/end like "2026-10-09") have no confirmed clock time.
 * They render and emit dates only: no clock on the row, event page, or JSON-LD.
 */
export function isDateOnly(iso: string): boolean {
  return DATE_ONLY.test(iso);
}

/** Parse for display. Date-only values are pinned to noon UTC so the LA calendar day is unchanged. */
export function toDate(iso: string): Date {
  return isDateOnly(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
}

export function laDateKey(iso: string): string {
  if (isDateOnly(iso)) return iso;
  const parts = dateParts.formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function isMultiDay(event: ListingEvent): boolean {
  if (!event.end) return false;
  return laDateKey(event.start) !== laDateKey(event.end);
}

export function overlapsIssue(event: ListingEvent, issue: Issue): boolean {
  const startDay = laDateKey(event.start);
  const endDay = event.end ? laDateKey(event.end) : startDay;
  return startDay <= issue.weekEnd && endDay >= issue.weekStart;
}

/** Include an event iff its LA start date falls within the issue window. */
export function weekEvents(issue: Issue = catalog.issue): ListingEvent[] {
  return catalog.events
    .filter((event) => {
      const startDay = laDateKey(event.start);
      return startDay >= issue.weekStart && startDay <= issue.weekEnd;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function getEvent(slug: string): ListingEvent | undefined {
  return catalog.events.find((event) => event.slug === slug);
}

export function weekdayLabel(iso: string): string {
  return weekdayLong.format(toDate(iso)).toUpperCase();
}

export function formatClock(iso: string): string {
  if (isDateOnly(iso)) return '';
  const parts = timeParts.formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  const dayPeriod = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '')
    .replace(/\s/g, '')
    .toLowerCase();
  if (minute === '00') return `${hour}${dayPeriod}`;
  return `${hour}:${minute}${dayPeriod}`;
}

export function formatTimeRange(event: ListingEvent): string {
  if (event.timeLabel) return event.timeLabel;
  if (isMultiDay(event) && event.end) {
    return `${weekdayShort.format(toDate(event.start))}–${weekdayShort.format(toDate(event.end))}`;
  }
  if (isDateOnly(event.start)) return '';
  const start = formatClock(event.start);
  if (!event.end) return start;
  return `${start}–${formatClock(event.end)}`;
}

export function formatWhen(event: ListingEvent): string {
  const day = dateLong.format(toDate(event.start));
  if (isMultiDay(event) && event.end) {
    return `${day}–${dateLong.format(toDate(event.end))}`;
  }
  if (event.timeLabel) return `${day}, ${event.timeLabel}`;
  if (isDateOnly(event.start)) return day;
  if (event.end) return `${day}, ${formatClock(event.start)}–${formatClock(event.end)}`;
  return `${day}, ${formatClock(event.start)}`;
}

export type DayGroup = {
  key: string;
  label: string;
  events: ListingEvent[];
};

export function groupByWeekday(events: ListingEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();

  for (const event of events) {
    const key = laDateKey(event.start);
    let group = index.get(key);
    if (!group) {
      group = { key, label: weekdayLabel(event.start), events: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.events.push(event);
  }

  return groups;
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function allSlugs(): string[] {
  return catalog.events.map((event) => event.slug);
}

export function eventMetaDescription(event: ListingEvent): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).formatToParts(toDate(event.start));
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const dateLabel = `${weekday} ${month} ${day}`;
  const blurb = (event.blurb || '').trim();
  const blurbPart = blurb ? `${blurb} ` : '';
  return `${event.title} — ${dateLabel} in ${event.city} at ${event.venue}. ${blurbPart}Times and details from This Week South Bay.`;
}

export function cityWeekEvents(city: string, issue: Issue = catalog.issue): ListingEvent[] {
  return weekEvents(issue).filter((event) => event.city === city);
}
