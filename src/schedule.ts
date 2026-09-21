import { SESSIONS, type Session } from './sessions';
import {
  addCalendarDays,
  computePrayers,
  type ComputedPrayer,
  type PrayerKey,
} from './prayer';
import { getZonedParts, parseHm, tunisWallTimeToEpoch, type ZonedParts } from './time';

export type SessionStatus = 'completed' | 'live' | 'upcoming';

export type SessionView = Session & {
  startMs: number;
  endMs: number;
  status: SessionStatus;
  remainingMs: number;
  elapsedMs: number;
  progress: number;
};

export type BreakKind = 'morning' | 'between' | 'after';

export type BreakWindow = {
  id: string;
  kind: BreakKind;
  label: string;
  startLabel: string;
  endLabel: string;
  startMs: number;
  endMs: number;
  prayerKeys: PrayerKey[];
};

export type PrayerPlacement = 'in-class' | 'in-break' | 'free';

export type PrayerView = ComputedPrayer & {
  endMs: number;
  status: SessionStatus;
  remainingMs: number;
  placement: PrayerPlacement;
  overlappingSession: SessionView | null;
  recommendedBreak: BreakWindow | null;
  note: string;
};

function dayBounds(parts: ZonedParts) {
  const startMs = tunisWallTimeToEpoch(parts.year, parts.month, parts.day, 0, 0, 0);
  const next = addCalendarDays(parts, 1);
  const endMs = tunisWallTimeToEpoch(next.year, next.month, next.day, 0, 0, 0);
  return { startMs, endMs };
}

export function buildSessionViews(nowMs: number, parts = getZonedParts(new Date(nowMs))): SessionView[] {
  return SESSIONS.map((session) => {
    const startHm = parseHm(session.start);
    const endHm = parseHm(session.end);
    const startMs = tunisWallTimeToEpoch(
      parts.year,
      parts.month,
      parts.day,
      startHm.hour,
      startHm.minute,
    );
    const endMs = tunisWallTimeToEpoch(
      parts.year,
      parts.month,
      parts.day,
      endHm.hour,
      endHm.minute,
    );

    let status: SessionStatus = 'upcoming';
    if (nowMs >= endMs) status = 'completed';
    else if (nowMs >= startMs) status = 'live';

    const remainingMs =
      status === 'live' ? endMs - nowMs : status === 'upcoming' ? startMs - nowMs : 0;
    const elapsedMs = status === 'live' ? nowMs - startMs : status === 'completed' ? endMs - startMs : 0;
    const duration = endMs - startMs;
    const progress = duration > 0 ? Math.min(1, Math.max(0, elapsedMs / duration)) : 0;

    return {
      ...session,
      startMs,
      endMs,
      status,
      remainingMs,
      elapsedMs,
      progress,
    };
  });
}

export function buildBreaks(sessions: SessionView[], parts: ZonedParts): BreakWindow[] {
  const { startMs: dayStart, endMs: dayEnd } = dayBounds(parts);
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const breaks: BreakWindow[] = [];

  if (first) {
    breaks.push({
      id: 'morning',
      kind: 'morning',
      label: 'Before classes',
      startLabel: '00:00',
      endLabel: first.start,
      startMs: dayStart,
      endMs: first.startMs,
      prayerKeys: [],
    });
  }

  for (let index = 0; index < sessions.length - 1; index += 1) {
    const current = sessions[index];
    const next = sessions[index + 1];
    breaks.push({
      id: `between-${current.id}`,
      kind: 'between',
      label: `Break after ${current.name}`,
      startLabel: current.end,
      endLabel: next.start,
      startMs: current.endMs,
      endMs: next.startMs,
      prayerKeys: [],
    });
  }

  if (last) {
    breaks.push({
      id: 'after',
      kind: 'after',
      label: 'After classes',
      startLabel: last.end,
      endLabel: 'onward',
      startMs: last.endMs,
      endMs: dayEnd,
      prayerKeys: [],
    });
  }

  return breaks;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

function prayerWindowEnd(prayer: ComputedPrayer, all: ComputedPrayer[], nextFajrMs: number): number {
  if (prayer.key === 'sunrise') {
    const dhuhr = all.find((item) => item.key === 'dhuhr');
    return dhuhr?.startMs ?? prayer.startMs;
  }

  const order = all.filter((item) => item.obligatory);
  const index = order.findIndex((item) => item.key === prayer.key);
  const next = order[index + 1];
  return next?.startMs ?? nextFajrMs;
}

function placementNote(prayer: ComputedPrayer, placement: PrayerPlacement, session: SessionView | null, brk: BreakWindow | null) {
  if (!prayer.obligatory) return 'Informational marker · not a prayer time';
  if (placement === 'in-class' && brk) {
    const window =
      brk.kind === 'after' ? `from ${brk.startLabel}` : `in the ${brk.startLabel}–${brk.endLabel} break`;
    return `Falls during ${session?.name}. Pray ${window}.`;
  }
  if (placement === 'in-break' && brk) {
    return `Break is open · ${brk.startLabel}–${brk.endLabel}`;
  }
  if (brk?.kind === 'after') return 'Pray after the academic day.';
  if (brk?.kind === 'morning') return 'Pray before the first séance.';
  return 'Free time · pray at the adhan.';
}

export function buildPrayerViews(
  nowMs: number,
  sessions: SessionView[],
  breaks: BreakWindow[],
  parts: ZonedParts,
): PrayerView[] {
  const today = computePrayers(parts);
  const tomorrow = computePrayers(addCalendarDays(parts, 1));
  const nextFajrMs = tomorrow.find((item) => item.key === 'fajr')?.startMs ?? nowMs + 86_400_000;

  const views = today.map((prayer) => {
    const endMs = prayerWindowEnd(prayer, today, nextFajrMs);
    const overlappingSession =
      sessions.find((session) => prayer.startMs >= session.startMs && prayer.startMs < session.endMs) ?? null;
    const containingBreak =
      breaks.find((item) => prayer.startMs >= item.startMs && prayer.startMs < item.endMs) ?? null;

    const recommendedBreak = prayer.obligatory
      ? (breaks.find((item) => overlaps(item.startMs, item.endMs, prayer.startMs, endMs) && item.endMs > prayer.startMs) ??
        null)
      : containingBreak;

    let placement: PrayerPlacement = 'free';
    if (overlappingSession) placement = 'in-class';
    else if (containingBreak && containingBreak.kind === 'between') placement = 'in-break';
    else if (containingBreak) placement = 'free';

    let status: SessionStatus = 'upcoming';
    if (!prayer.obligatory) {
      status = nowMs >= prayer.startMs ? 'completed' : 'upcoming';
    } else if (nowMs >= endMs) {
      status = 'completed';
    } else if (nowMs >= prayer.startMs) {
      status = 'live';
    }

    const remainingMs =
      status === 'live' ? endMs - nowMs : status === 'upcoming' ? prayer.startMs - nowMs : 0;

    if (recommendedBreak && prayer.obligatory && !recommendedBreak.prayerKeys.includes(prayer.key)) {
      recommendedBreak.prayerKeys.push(prayer.key);
    }

    return {
      ...prayer,
      endMs,
      status,
      remainingMs,
      placement,
      overlappingSession,
      recommendedBreak,
      note: placementNote(prayer, placement, overlappingSession, recommendedBreak),
    };
  });

  return views;
}

export type HeroMode =
  | { kind: 'prayer'; prayer: PrayerView; availableNow: boolean }
  | { kind: 'session'; session: SessionView; prayerHint: PrayerView | null }
  | { kind: 'complete'; prayerHint: PrayerView | null };

export function resolveHero(nowMs: number, sessions: SessionView[], prayers: PrayerView[]): HeroMode {
  const due = prayers.find((prayer) => prayer.obligatory && prayer.status === 'live');
  const liveSession = sessions.find((session) => session.status === 'live');
  const nextSession = sessions.find((session) => session.status === 'upcoming');

  if (due) {
    const rec = due.recommendedBreak;
    const inRecommendedBreak = Boolean(rec && nowMs >= rec.startMs && nowMs < rec.endMs);
    const blockedByClass = Boolean(
      liveSession && due.startMs < liveSession.endMs && due.endMs > liveSession.startMs,
    );

    if (inRecommendedBreak || (due.placement !== 'in-class' && !blockedByClass)) {
      return { kind: 'prayer', prayer: due, availableNow: true };
    }

    if (liveSession) {
      return { kind: 'session', session: liveSession, prayerHint: due };
    }
  }

  if (liveSession) {
    const upcomingPrayer = prayers.find(
      (prayer) =>
        prayer.obligatory &&
        prayer.status === 'upcoming' &&
        prayer.startMs < liveSession.endMs,
    );
    return { kind: 'session', session: liveSession, prayerHint: upcomingPrayer ?? due ?? null };
  }

  if (nextSession) {
    return { kind: 'session', session: nextSession, prayerHint: due ?? null };
  }

  return { kind: 'complete', prayerHint: due ?? null };
}

export type TimelineItem =
  | { type: 'session'; session: SessionView }
  | { type: 'break'; brk: BreakWindow; prayers: PrayerView[] };

export function buildTimeline(sessions: SessionView[], breaks: BreakWindow[], prayers: PrayerView[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const between = breaks.filter((item) => item.kind === 'between');
  const after = breaks.find((item) => item.kind === 'after');

  sessions.forEach((session, index) => {
    items.push({ type: 'session', session });
    const gap = between[index];
    if (gap) {
      items.push({
        type: 'break',
        brk: gap,
        prayers: prayers.filter((prayer) => gap.prayerKeys.includes(prayer.key)),
      });
    }
  });

  if (after && after.prayerKeys.length > 0) {
    items.push({
      type: 'break',
      brk: after,
      prayers: prayers.filter((prayer) => after.prayerKeys.includes(prayer.key)),
    });
  }

  return items;
}
