import { TIMEZONE, type ZonedParts } from './time';

export const LOCATION = 'Sfax, Tunisia';
export const LATITUDE = 34.7406;
export const LONGITUDE = 10.7603;
export const PRAYER_METHOD = 'Muslim World League · Fajr 17° · Isha 17° · Asr shadow 1';

const DAY_MS = 86_400_000;

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

type PrayerDefinition = {
  key: PrayerKey;
  label: string;
  angle?: number;
  obligatory: boolean;
};

export const PRAYERS: PrayerDefinition[] = [
  { key: 'fajr', label: 'Fajr', angle: 18, obligatory: true },
  { key: 'sunrise', label: 'Sunrise', angle: 0.833, obligatory: false },
  { key: 'dhuhr', label: 'Dhuhr', obligatory: true },
  { key: 'asr', label: 'Asr', obligatory: true },
  { key: 'maghrib', label: 'Maghrib', angle: 0.833, obligatory: true },
  { key: 'isha', label: 'Isha', angle: 17, obligatory: true },
];

export type CalendarDay = Pick<ZonedParts, 'year' | 'month' | 'day'>;

function dayOfYear(parts: CalendarDay): number {
  return Math.floor(
    (Date.UTC(parts.year, parts.month - 1, parts.day) - Date.UTC(parts.year, 0, 0)) / DAY_MS,
  );
}

function solarPosition(parts: CalendarDay) {
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear(parts) - 1);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  return {
    declination,
    solarNoonUtcMinutes: 720 - 4 * LONGITUDE - equationOfTime,
  };
}

function prayerUtcMillis(parts: CalendarDay, key: PrayerKey, angle?: number): number {
  const { declination, solarNoonUtcMinutes } = solarPosition(parts);
  const latitudeRad = LATITUDE * (Math.PI / 180);
  const solarAltitude =
    key === 'asr' ? Math.atan(1 / (1 + Math.tan(Math.abs(latitudeRad - declination)))) : 0;
  const zenithRad =
    key === 'dhuhr'
      ? Math.PI / 2
      : key === 'asr'
        ? Math.PI / 2 - solarAltitude
        : ((90 + (angle ?? 0)) * Math.PI) / 180;
  const cosine =
    (Math.cos(zenithRad) - Math.sin(latitudeRad) * Math.sin(declination)) /
    (Math.cos(latitudeRad) * Math.cos(declination));

  if (key === 'dhuhr') {
    return Date.UTC(parts.year, parts.month - 1, parts.day) + solarNoonUtcMinutes * 60_000;
  }

  const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosine))) * (180 / Math.PI);
  const isMorning = key === 'fajr' || key === 'sunrise';
  const utcMinutes = solarNoonUtcMinutes + (isMorning ? -4 * hourAngle : 4 * hourAngle);
  return Date.UTC(parts.year, parts.month - 1, parts.day) + utcMinutes * 60_000;
}

export function formatPrayerClock(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ms));
}

export function addCalendarDays(parts: CalendarDay, days: number): CalendarDay {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days);
  const next = new Date(utc);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export type ComputedPrayer = {
  key: PrayerKey;
  label: string;
  obligatory: boolean;
  startMs: number;
  time: string;
};

export function computePrayers(parts: CalendarDay): ComputedPrayer[] {
  return PRAYERS.map((definition) => {
    const startMs = prayerUtcMillis(parts, definition.key, definition.angle);
    return {
      key: definition.key,
      label: definition.label,
      obligatory: definition.obligatory,
      startMs,
      time: formatPrayerClock(startMs),
    };
  });
}
