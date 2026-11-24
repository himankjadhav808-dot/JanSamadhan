/**
 * formatTimestamp
 *
 * - Under 1 minute  → "just now" / "अभी-अभी"
 * - Under 1 hour    → "X mins ago" / "X मिनट पहले"
 * - Under 24 hours  → "X hours ago" / "X घंटे पहले"
 * - 24 hours+       → locale-formatted exact date (e.g. "15 Jan 2025")
 *
 * @param {string|Date} createdAt
 * @param {string}      lang  'en' (default) | 'hi'
 * @returns {string}
 */
export function formatTimestamp(createdAt, lang = 'en') {
  if (!createdAt) return '';

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return '';

  const now = new Date();
  const diffMs      = Math.max(0, now - createdDate);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours   = diffMs / (1000 * 60 * 60); // keep as float for the < 24 check

  // Under 1 minute
  if (diffMinutes < 1) {
    return lang === 'hi' ? 'अभी-अभी' : 'just now';
  }

  // Under 1 hour
  if (diffMinutes < 60) {
    return lang === 'hi'
      ? `${diffMinutes} मिनट पहले`
      : `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
  }

  // Under 24 hours
  if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    return lang === 'hi'
      ? `${hours} घंटे पहले`
      : `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  // 24 hours or older → exact date
  return createdDate.toLocaleDateString(
    lang === 'hi' ? 'hi-IN' : 'en-US',
    { day: 'numeric', month: 'short', year: 'numeric' }
  );
}
