export type Session = {
  id: number;
  name: string;
  start: string;
  end: string;
};

export const SESSIONS: Session[] = [
  { id: 1, name: 'Séance 1', start: '08:15', end: '09:45' },
  { id: 2, name: 'Séance 2', start: '10:00', end: '11:30' },
  { id: 3, name: 'Séance 3', start: '11:45', end: '13:15' },
  { id: 4, name: 'Séance 4', start: '13:30', end: '15:00' },
  { id: 5, name: 'Séance 5', start: '15:15', end: '16:45' },
  { id: 6, name: 'Séance 6', start: '17:00', end: '18:30' },
];

export const SESSION_DURATION_LABEL = '1h 30m';
