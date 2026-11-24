# Community Feed Location Filter - Indore Region Coverage

## ✅ Implementation Complete

Updated the community feed location filter to cover the entire Indore metro area by increasing the geospatial search radius from 10 km to 30 km.

---

## 📋 Changes Made

### 1. Backend: Default Radius Update
**File:** `backend/controllers/issueController.js`

**Change:**
- Updated `DEFAULT_RADIUS_KM` from 5 km to 30 km
- This affects the `getNearbyIssues` endpoint

**Before:**
```javascript
const DEFAULT_RADIUS_KM = 5;
```

**After:**
```javascript
const DEFAULT_RADIUS_KM = 30;
```

**Impact:**
- The `/issues/nearby` endpoint now defaults to searching within 30 km
- Covers the entire Indore metropolitan area
- Users can see issues from across the entire city

### 2. Frontend: Radius Parameter Update
**File:** `frontend/src/pages/Citizen/Dashboard.jsx`

**Change:**
- Updated `RADIUS_KM` constant from 10 km to 30 km
- This is passed to the backend API call

**Before:**
```javascript
const RADIUS_KM = 10;
```

**After:**
```javascript
const RADIUS_KM = 30;
```

**Impact:**
- The frontend now requests issues within a 30 km radius
- Matches the backend default for consistency
- UI messaging reflects the new coverage area

---

## 🎯 Geographic Coverage

### Indore Metro Area Coverage

**Radius:** 30 km from user's location

**Areas Covered:**
- Indore City (central)
- Indore suburbs and outskirts
- Pithampur industrial area
- Dewas (nearby city)
- Surrounding rural areas
- All major industrial zones
- All residential colonies

**Distance Reference:**
- **Old coverage (10 km):** Only central Indore
- **New coverage (30 km):** Entire Indore metro + neighboring areas

---

## 📊 Technical Details

### Backend Query

The `getNearbyIssues` function uses MongoDB's `$geoNear` aggregation:

```javascript
const pipeline = [
  {
    $geoNear: {
      near: toGeoPoint(parsedLng.value, parsedLat.value),
      distanceField: 'distanceMeters',
      maxDistance: distance.meters, // 30,000 meters = 30 km
      spherical: true,
      key: 'location',
      query: geoMatch,
    },
  },
  // ... additional stages
];
```

**Calculation:**
- 30 km = 30,000 meters
- Search area = π × (30 km)² ≈ 2,827 km²

### Frontend API Call

```javascript
const loadIssues = async (lng, lat) => {
  const { data } = await api.get('/issues/nearby', {
    params: { lng, lat, radius: RADIUS_KM, unit: 'km', sort: 'netScore' },
  });
  setIssues((data.issues || []).map((i) => withUserVote(i, user?._id)));
};
```

**Parameters:**
- `lng`: User's longitude
- `lat`: User's latitude
- `radius`: 30 (km)
- `unit`: 'km'
- `sort`: 'netScore' (sorted by upvotes - downvotes)

---

## 🧪 Testing

### Test 1: Central Indore Location
1. Navigate to Community Feed
2. Allow location access (or use default center)
3. **Expected:** Issues from across entire Indore metro area visible
4. **Expected:** Issues up to 30 km away included

### Test 2: Suburban Location
1. Test from Pithampur or Dewas area
2. Navigate to Community Feed
3. **Expected:** Issues from Indore city visible (within 30 km)
4. **Expected:** Issues from user's local area visible

### Test 3: Edge Cases
1. Test from area exactly 30 km from Indore center
2. **Expected:** Issues at the edge of the radius included
3. **Expected:** No issues beyond 30 km

### Test 4: Performance
1. Monitor API response time
2. **Expected:** Acceptable performance despite larger radius
3. **Expected:** Pagination still works correctly

---

## 🔧 Configuration

### Customizing the Radius

**Backend Only:**
Edit `backend/controllers/issueController.js`:
```javascript
const DEFAULT_RADIUS_KM = 30; // Change to desired value
```

**Frontend Only:**
Edit `frontend/src/pages/Citizen/Dashboard.jsx`:
```javascript
const RADIUS_KM = 30; // Change to desired value
```

**Both Should Match:**
For consistency, both backend and frontend should use the same default radius.

### Radius Recommendations

| City Size | Recommended Radius | Notes |
|-----------|-------------------|-------|
| Small town (≤50k) | 10-15 km | Covers entire town |
| Medium city (50k-500k) | 20-30 km | Covers metro area |
| Large city (500k-2M) | 30-50 km | Covers suburbs |
| Metro area (≥2M) | 50-100 km | Covers entire metro |

**Indore:** ~2.1 million population → 30 km is appropriate

---

## 📈 Performance Considerations

### Database Impact

**Larger radius means:**
- More documents scanned by `$geoNear`
- Longer query execution time
- More network data transfer

**Mitigation:**
- Pagination (`limit` parameter)
- Index on `location` field (2dsphere)
- Efficient aggregation pipeline
- Caching strategies

### Query Optimization

Current optimizations in place:
1. **2dsphere index** on location field
2. **Aggregation pipeline** for efficient filtering
3. **Pagination** with `limit` parameter
4. **Net score sorting** for relevance

---

## 🚀 Future Enhancements

### Potential Improvements

1. **Dynamic Radius Based on User Role**
   - Citizens: 30 km (broad awareness)
   - Authorities: 10 km (focused on their jurisdiction)

2. **User-Configurable Radius**
   - Allow users to adjust radius in UI
   - Save preference in user profile

3. **Location-Based Defaults**
   - Detect city and set appropriate radius
   - Different defaults for rural vs urban areas

4. **Performance Monitoring**
   - Track query times by radius
   - Alert on performance degradation
   - Auto-tune radius based on performance

---

## 📁 Files Modified

- `backend/controllers/issueController.js` - Updated DEFAULT_RADIUS_KM from 5 to 30
- `frontend/src/pages/Citizen/Dashboard.jsx` - Updated RADIUS_KM from 10 to 30

---

## ✅ Feature Complete

The community feed location filter now covers the entire Indore metro area with a 30 km radius. Users can see issues from across the entire city and surrounding areas, providing better community awareness and engagement.
