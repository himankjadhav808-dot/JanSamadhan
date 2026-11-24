export function timeAgo(value) {
  if (!value) return 'Just now';

  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return 'Just now';

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 45) return 'Just now';
  if (seconds < 90) return '1 minute ago';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function issueId(issue) {
  return issue?._id || issue?.id;
}

export function hasVoted(ids = [], userId) {
  if (!userId) return false;
  return ids.some((id) => String(id) === String(userId));
}

export function withUserVote(issue, userId) {
  const up = hasVoted(issue.upvotes, userId);
  const down = hasVoted(issue.downvotes, userId);
  return {
    ...issue,
    userVote: up ? 'upvote' : down ? 'downvote' : null,
    netScore: typeof issue.netScore === 'number' ? issue.netScore : (issue.upvotes?.length || 0) - (issue.downvotes?.length || 0),
  };
}

export function applyOptimisticVote(issue, voteType, userId) {
  const upvotes = (issue.upvotes || []).map(String);
  const downvotes = (issue.downvotes || []).map(String);
  const uid = String(userId);
  
  // Determine current state
  const hasUpvoted = upvotes.includes(uid);
  const hasDownvoted = downvotes.includes(uid);
  const currentVote = hasUpvoted ? 'upvote' : hasDownvoted ? 'downvote' : null;

  // 1. Wipe user from both arrays for a clean slate
  const nextUp = upvotes.filter(id => id !== uid);
  const nextDown = downvotes.filter(id => id !== uid);

  let finalUserVote = null;

  // 2. Apply the new vote if they are not just toggling it off
  if (voteType === 'upvote' && currentVote !== 'upvote') {
    nextUp.push(uid);
    finalUserVote = 'upvote';
  } else if (voteType === 'downvote' && currentVote !== 'downvote') {
    nextDown.push(uid);
    finalUserVote = 'downvote';
  }

  // 3. Calculate absolute truth
  const updatedNetScore = nextUp.length - nextDown.length;

  return {
    ...issue,
    _id: issue._id || issue.id,
    upvotes: nextUp,
    downvotes: nextDown,
    userVote: finalUserVote,
    netScore: updatedNetScore,
  };
}

export function toLatLng(issue) {
  const coords = issue?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return [lat, lng];
}
