# Dynamic Points & Badge Calculation System

## ✅ Implementation Complete

Updated the Rewards page to dynamically calculate user points, badge states, and progress based on real backend data instead of hardcoded values.

---

## 📋 Changes Made

### 1. Backend: User Controller
**File:** `backend/controllers/userController.js`

**Changes:**
- Added `totalUpvotesReceived` calculation for citizens
- Added `totalUpvotesReceived` calculation for authorities (based on resolved issues)
- Includes upvotes in user profile response

```javascript
// For citizens
totalUpvotesReceived = reportedIssues.reduce((sum, issue) => {
  return sum + (Array.isArray(issue.upvotes) ? issue.upvotes.length : 0);
}, 0);

// For authorities
totalUpvotesReceived = resolutions.reduce((sum, res) => {
  if (res.issueId && Array.isArray(res.issueId.upvotes)) {
    return sum + res.issueId.upvotes.length;
  }
  return sum;
}, 0);
```

### 2. Backend: User Model
**File:** `backend/models/User.js`

**Changes:**
- Added `isVerified` boolean field for the "Verified Citizen" badge
- Allows tracking of verified user status

```javascript
isVerified: {
  type: Boolean,
  default: false,
},
```

### 3. Frontend: Rewards Page
**File:** `frontend/src/pages/Rewards.jsx`

**Changes:**
- Removed hardcoded badge states
- Added dynamic user stats fetching from backend
- Implemented real-time badge calculation based on user metrics
- Added loading state with spinner
- Updated progress bar with percentage display
- Badge unlock logic now uses actual user data

**Badge Rules:**
- **First Report**: Unlocked when `totalReports >= 1`
- **Problem Solver**: Unlocked when `resolvedCount >= 5`
- **Community Voice**: Unlocked when `totalUpvotes >= 25`
- **Civic Champion**: Unlocked when `totalReports >= 20`
- **Verified Citizen**: Unlocked when `user.isVerified === true`
- **Streak Hero**: Placeholder for future streak tracking

**Progress Calculation:**
```javascript
const progressPercentage = Math.min(100, Math.max(0, (totalPoints / nextMilestone) * 100));
```

---

## 🎯 How It Works

### Data Flow:

1. **User navigates to Rewards page**
2. **Frontend fetches user stats** from `/api/users/:id/profile`
3. **Backend calculates metrics**:
   - Total points (from user.totalPoints)
   - Issues raised
   - Issues resolved
   - Total upvotes received
4. **Frontend evaluates badge rules** against these metrics
5. **UI updates dynamically** showing earned/locked badges
6. **Progress bar animates** to next milestone (500 points)

### User Metrics Tracked:

| Metric | Source | Description |
|--------|--------|-------------|
| `totalPoints` | User.totalPoints | Total civic points earned |
| `totalReports` | issuesRaised | Number of issues reported |
| `resolvedCount` | problemsSolved | Number of resolved issues |
| `totalUpvotes` | totalUpvotesReceived | Total upvotes on user's issues |
| `isVerified` | User.isVerified | Account verification status |

---

## 🧪 Testing

### Test 1: Badge Progression
1. Log in as a citizen
2. Report your first issue
3. Navigate to Rewards page
4. Verify "First Report" badge is unlocked (green, no lock icon)
5. Verify points increased (+10 for report)

### Test 2: Problem Solver Badge
1. Report 5 issues (or have existing issues)
2. Wait for authorities to resolve them
3. Navigate to Rewards page
4. Verify "Problem Solver" badge unlocks when 5+ are resolved

### Test 3: Community Voice Badge
1. Report an issue
2. Get 25+ upvotes from other users
3. Navigate to Rewards page
4. Verify "Community Voice" badge unlocks

### Test 4: Progress Bar
1. Check current points in hero banner
2. Verify progress bar shows correct percentage
3. Verify milestone label shows "Next milestone: 500 pts (X%)"
4. Verify bar animates smoothly

### Test 5: Loading State
1. Open Rewards page
2. Verify loading spinner appears while fetching data
3. Verify data appears after loading completes

---

## 📊 Badge Configuration

### Adding New Badges

To add a new badge, update `BADGE_CONFIG` in `frontend/src/pages/Rewards.jsx`:

```javascript
{
  id: 'new_badge_id',
  name: 'Badge Name',
  desc: 'Badge description',
  icon: IconComponent,
  color: 'text-color-class',
  bg: 'bg-color-class',
  points: 50,
}
```

Then add the unlock logic in the badge calculation:

```javascript
case 'new_badge_id':
  isUnlocked = /* your condition */;
  break;
```

### Custom Milestones

To change the milestone (currently 500 points):

```javascript
const nextMilestone = 1000; // Change to desired value
```

---

## 🔧 Configuration

### Progress Bar Animation

The progress bar has a smooth transition animation:

```javascript
className="h-full rounded-full bg-white transition-all duration-500 ease-out"
```

To change animation speed, modify `duration-500`:
- `duration-300` = 300ms (faster)
- `duration-1000` = 1000ms (slower)

### Badge Styling

Badge colors are defined in `BADGE_CONFIG`:
- `color`: Icon color (Tailwind text classes)
- `bg`: Background color (Tailwind bg classes)

---

## 🚀 Next Steps

1. **Restart backend server** (if not already running)
2. **Test badge progression** using the testing checklist
3. **Consider adding streak tracking** for "Streak Hero" badge
4. **Add verification system** to enable "Verified Citizen" badge
5. **Consider adding more rewards** that can be redeemed

---

## 📁 Files Modified

- `backend/controllers/userController.js` - Added upvote calculation
- `backend/models/User.js` - Added isVerified field
- `frontend/src/pages/Rewards.jsx` - Dynamic badge calculation, loading state, progress updates

---

## ✅ Feature Complete

The dynamic points and badge calculation system is now fully implemented and ready for testing!
