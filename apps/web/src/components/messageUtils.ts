// ─── Shared timestamp helpers (used by MessageItem, SearchBar, MessageInput) ──
export const IST = 'Asia/Kolkata';

const timeFmt   = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST });
const fullFmt   = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST });
const dateParts = new Intl.DateTimeFormat('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: IST });

function istDateKey(d: Date) {
  const p = dateParts.formatToParts(d);
  return `${p.find(x => x.type === 'year')!.value}-${p.find(x => x.type === 'month')!.value}-${p.find(x => x.type === 'day')!.value}`;
}
export function isTodayIST(d: Date)     { return istDateKey(d) === istDateKey(new Date()); }
export function isYesterdayIST(d: Date) { return istDateKey(d) === istDateKey(new Date(Date.now() - 86400000)); }

export function formatTimestamp(iso: string) {
  const d = new Date(iso);
  if (isTodayIST(d))     return `Today at ${timeFmt.format(d)}`;
  if (isYesterdayIST(d)) return `Yesterday at ${timeFmt.format(d)}`;
  return fullFmt.format(d);
}
export function shortTime(iso: string) { return timeFmt.format(new Date(iso)); }

export function isSameAuthorWithin5Min(a: { userId: string; createdAt: string; replyToId?: string | null }, b: { userId: string; createdAt: string; replyToId?: string | null }) {
  if (a.userId !== b.userId) return false;
  if (b.replyToId) return false;
  return Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60 * 1000;
}

export function scrollToMessage(id: string) {
  const el = document.getElementById(`msg-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('message-flash');
  setTimeout(() => el.classList.remove('message-flash'), 1800);
}
