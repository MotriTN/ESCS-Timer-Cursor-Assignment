import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock3,
  GraduationCap,
  MapPin,
  Radio,
} from 'lucide-react';
import { SESSIONS, SESSION_DURATION_LABEL, type Session } from './sessions';
import {
  formatClock,
  formatDuration,
  formatLongDate,
  getZonedParts,
  parseHm,
  tunisWallTimeToEpoch,
} from './time';

type SessionStatus = 'completed' | 'live' | 'upcoming';

type SessionView = Session & {
  startMs: number;
  endMs: number;
  status: SessionStatus;
  remainingMs: number;
  elapsedMs: number;
  progress: number;
};

function buildSessionViews(nowMs: number): SessionView[] {
  const parts = getZonedParts(new Date(nowMs));

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

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

function StatusBadge({ status, remainingMs }: { status: SessionStatus; remainingMs: number }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-muted uppercase">
        <Check className="size-3.5" strokeWidth={2.4} />
        Completed
      </span>
    );
  }

  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-live/30 bg-live/10 px-3 py-1 text-[11px] font-medium tracking-[0.16em] text-live uppercase">
        <span className="pulse-live relative inline-flex size-1.5 rounded-full bg-live" />
        In Progress
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/8 px-3 py-1 text-[11px] font-medium tracking-[0.14em] text-gold-soft uppercase">
      <Clock3 className="size-3.5" />
      Upcoming · {formatDuration(remainingMs)}
    </span>
  );
}

function HeroCard({ views }: { views: SessionView[] }) {
  const live = views.find((session) => session.status === 'live');
  const next = views.find((session) => session.status === 'upcoming');
  const featured = live ?? next;

  if (!featured) {
    return (
      <section className="glow-gold relative overflow-hidden rounded-[28px] border border-gold/15 bg-panel/80 px-6 py-8 sm:px-10">
        <p className="text-[11px] font-medium tracking-[0.28em] text-gold uppercase">Day complete</p>
        <h2 className="mt-3 font-display text-4xl font-semibold text-cream sm:text-5xl">All sessions finished</h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          The daily sequence for ESC Sfax has ended. The next cycle begins tomorrow at 08:15.
        </p>
      </section>
    );
  }

  const isLive = featured.status === 'live';

  return (
    <section className="glow-gold relative overflow-hidden rounded-[28px] border border-gold/18 bg-linear-to-br from-[#171410] via-panel to-[#0c1014] px-6 py-8 sm:px-10 sm:py-10">
      <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.28em] text-gold uppercase">
            {isLive ? (
              <>
                <span className="pulse-live inline-flex size-1.5 rounded-full bg-live" />
                Current live
              </>
            ) : (
              'Next session'
            )}
          </p>
          <h2 className="mt-3 font-display text-5xl font-semibold tracking-tight text-cream sm:text-6xl">
            {featured.name}
          </h2>
          <p className="mt-3 text-lg text-gold-soft/90">
            {featured.start} — {featured.end}
            <span className="mx-2 text-muted">·</span>
            {SESSION_DURATION_LABEL}
          </p>
        </div>

        <div className="min-w-[220px]">
          <p className="text-[11px] tracking-[0.22em] text-muted uppercase">
            {isLive ? 'Time remaining' : 'Starts in'}
          </p>
          <p className="mt-1 font-display text-4xl text-cream">{formatDuration(featured.remainingMs)}</p>
        </div>
      </div>

      {isLive && (
        <div className="relative mt-8">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-linear-to-r from-gold to-gold-soft transition-[width] duration-700"
              style={{ width: `${featured.progress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs tracking-wide text-muted">
            {Math.round(featured.progress * 100)}% of this séance elapsed
          </p>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const now = useNow();
  const parts = useMemo(() => getZonedParts(new Date(now)), [now]);
  const views = useMemo(() => buildSessionViews(now), [now]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,175,55,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 bottom-0 size-[28rem] rounded-full bg-[#1a2a24]/40 blur-3xl" />

      <main className="relative mx-auto flex max-w-3xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-[11px] tracking-[0.2em] text-muted uppercase">
              <GraduationCap className="size-3.5 text-gold" />
              ESC Sfax
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">
              ESCS TimeTracker
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="size-3.5 text-gold/80" />
              Sfax, Tunisia · Africa/Tunis
            </p>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-[11px] tracking-[0.24em] text-muted uppercase">Live time</p>
            <p className="font-display text-5xl leading-none text-cream sm:text-6xl">{formatClock(parts)}</p>
            <p className="mt-2 text-sm capitalize text-gold-soft/80">{formatLongDate(parts)}</p>
          </div>
        </header>

        <HeroCard views={views} />

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] tracking-[0.24em] text-gold uppercase">Daily sequence</p>
              <h2 className="mt-1 font-display text-3xl text-cream">Six séances</h2>
            </div>
            <p className="text-xs text-muted">{SESSION_DURATION_LABEL} each</p>
          </div>

          <ol className="flex flex-col gap-3">
            {views.map((session, index) => (
              <li
                key={session.id}
                className={`rounded-2xl border px-4 py-4 transition-colors sm:px-5 ${
                  session.status === 'live'
                    ? 'border-live/35 bg-live/6 glow-gold'
                    : session.status === 'completed'
                      ? 'border-white/6 bg-white/[0.03] opacity-70'
                      : 'border-white/8 bg-panel/70'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div
                      className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border text-sm ${
                        session.status === 'live'
                          ? 'border-live/40 text-live'
                          : session.status === 'completed'
                            ? 'border-white/10 text-muted'
                            : 'border-gold/25 text-gold-soft'
                      }`}
                    >
                      {session.status === 'live' ? (
                        <Radio className="size-4" />
                      ) : session.status === 'completed' ? (
                        <Check className="size-4" />
                      ) : (
                        <span className="font-display text-lg">{index + 1}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium tracking-wide text-cream">{session.name}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {session.start} – {session.end}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={session.status} remainingMs={session.remainingMs} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="pb-4 text-center text-[11px] tracking-[0.18em] text-muted/70 uppercase">
          ESC Sfax · academic day clock
        </footer>
      </main>
    </div>
  );
}
