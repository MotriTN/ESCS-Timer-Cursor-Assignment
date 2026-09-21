export const TIMEZONE = 'Africa/Tunis';

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

function partValue(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

export function getZonedParts(date: Date, timeZone = TIMEZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  }).formatToParts(date);

  return {
    year: Number(partValue(parts, 'year')),
    month: Number(partValue(parts, 'month')),
    day: Number(partValue(parts, 'day')),
    hour: Number(partValue(parts, 'hour')),
    minute: Number(partValue(parts, 'minute')),
    second: Number(partValue(parts, 'second')),
    weekday: partValue(parts, 'weekday'),
  };
}

/** POSIX epoch ms for a civil wall-clock time in Africa/Tunis. */
export function tunisWallTimeToEpoch(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
): number {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const asTunis = getZonedParts(new Date(utcGuess));
  const tunisAsUtc = Date.UTC(
    asTunis.year,
    asTunis.month - 1,
    asTunis.day,
    asTunis.hour,
    asTunis.minute,
    asTunis.second,
  );
  return utcGuess - (tunisAsUtc - utcGuess);
}

export function parseHm(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

export function formatClock(parts: ZonedParts): string {
  const hh = String(parts.hour).padStart(2, '0');
  const mm = String(parts.minute).padStart(2, '0');
  const ss = String(parts.second).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function formatLongDate(parts: ZonedParts): string {
  const date = tunisWallTimeToEpoch(parts.year, parts.month, parts.day, 12, 0);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
