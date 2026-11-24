# Leaflet Map View - 15 km Radius Around Indore

## ✅ Implementation Complete

Updated the Leaflet map view and geospatial query to use a 15 km radius around Indore for more focused local coverage.

---

## 📋 Changes Made

### 1. Backend: Default Radius Update
**File:** `backend/controllers/issueController.js`

**Change:**
- Updated `DEFAULT_RADIUS_KM` from 30 km to 15 km
- MongoDB `$geoNear` query now uses 15,000 meters max distance

**Before:**
```javascript
const DEFAULT_RADIUS_KM = 30;
```

**After:**
```javascript
const DEFAULT_RADIUS_KM = 15;
```

**Impact:**
- The `/issues/nearby` endpoint now searches within 15 km
- More focused local coverage
- Faster queries due to smaller search area

### 2. Frontend: Radius Parameter Update
**File:** `frontend/src/pages/Citizen/Dashboard.jsx`

**Change:**
- Updated `RADIUS_KM` from 30 km to 15 km
- Passed to backend API call

**Before:**
```javascript
const RADIUS_KM = 30;
```

**After:**
```javascript
const RADIUS_KM = 15;
```

**Impact:**
- Frontend requests issues within 15 km radius
- Matches backend default for consistency
- UI messaging reflects focused local coverage

### 3. Map Component: Boundary Circle Update
**File:** `frontend/src/components/maps/IssueMap.jsx`

**Changes:**
- Updated `RADIUS_IN_METERS` from 30,000 to 15,000
- Updated `INDORE_BOUNDS` for smaller coverage area
- Updated initial zoom from 11 to 12 (closer view)
- Updated min zoom from 10 to 11

**Before:**
```javascript
const RADIUS_IN_METERS = 30000; // 30 km radius
const INDORE_BOUNDS = [
  [22.40, 75.50], // South-West limit
  [23.00, 76.20]  // North-East limit
];
```

**After:**
```javascript
const RADIUS_IN_METERS = 15000; // 15 km radius
const INDORE_BOUNDS = [
  [22.55, 75.65], // South-West limit
  [22.85, 76.05]  // North-East limit
];
```

**Zoom Changes:**
```javascript
zoom={12}        // Was 11 - closer view for smaller radius
minZoom={11}     // Was 10 - prevents zooming out too far
```

---

## 🎯 Geographic Coverage

### Previous Coverage (30 km)
- **Indore City:** Entire city and suburbs
- **Suburbs:** Vijay Nagar, Palasia, Rajendra Nagar
- **Industrial Areas:** Pithampur, Sanwer Road
- **Nearby Towns:** Dewas, Mhow
- **Search Area:** π × (30 km)² ≈ 2,827 km²

### New Coverage (15 km)
- **Indore City:** Central and inner suburbs
- **Core Areas:** Vijay Nagar, Palasia, Rajendra Nagar, AB Road
- **Industrial Areas:** Sanwer Road (inner zone)
- **Nearby Areas:** Mhow (within 15 km)
- **Search Area:** π × (15 km)² ≈ 707 km²

### Excluded Areas
- **Pithampur:** ~35 km from center (outside 15 km)
- **Dewas:** ~35 km from center (outside 15 km)
- **Outer Suburbs:** Beyond 15 km radius

---

## 🎨 Visual Design

### Boundary Circle
- **Radius:** 15 km (smaller, more focused)
- **Color:** Blue (#2563eb)
- **Fill:** Semi-transparent blue (#3b82f6)
- **Fill Opacity:** 8%
- **Style:** Dashed line
- **Purpose:** Visual indicator of 15 km service area

### Map Bounds
- **Tighter:** Smaller bounding box for 15 km coverage
- **South-West:** [22.55, 75.65]
- **North-East:** [22.85, 76.05]
- **Coverage:** Approximately 30 km × 40 km area

### Zoom Level
- **Initial:** 12 (closer view, better for smaller radius)
- **Minimum:** 11 (prevents zooming out too far)
- **Maximum:** 18 (street-level detail unchanged)

---

## 🧪 Testing

### Test 1: Map Initial View
1. Navigate to Community Feed
2. Switch to Map View
3. **Expected:** Map centered on Indore at zoom level 12
4. **Expected:** Blue dashed circle shows 15 km boundary
5. **Expected:** View is closer than before (zoom 12 vs 11)

### Test 2: Boundary Circle Size
1. Observe the blue dashed circle
2. **Expected:** Circle is smaller than before (15 km vs 30 km)
3. **Expected:** Circle centered on Indore
4. **Expected:** Visual match with actual 15 km radius

### Test 3: Issue Coverage
1. Check issue markers on map
2. **Expected:** Only issues within 15 km visible
3. **Expected:** Issues from Pithampur/Dewas not shown
4. **Expected:** Focus on central Indore area

### Test 4: API Query
1. Monitor network requests
2. **Expected:** API call with `radius: 15`
3. **Expected:** Response contains issues within 15 km
4. **Expected:** Faster response due to smaller search area

### Test 5: Zoom Limits
1. Try to zoom out below level 11
2. **Expected:** Cannot zoom out further
3. **Expected:** Prevents viewing too large an area

---

## 🔧 Configuration

### Adjusting the Radius

**Backend Only:**
```javascript
const DEFAULT_RADIUS_KM = 15; // Change to desired value
```

**Frontend Only:**
```javascript
const RADIUS_KM = 15; // Change to desired value
```

**Map Component:**
```javascript
const RADIUS_IN_METERS = 15000; // Change to desired value in meters
```

### Adjusting Map Bounds

For different radii, adjust bounds accordingly:

**10 km radius:**
```javascript
const INDORE_BOUNDS = [
  [22.60, 75.70],
  [22.80, 75.95],
];
```

**20 km radius:**
```javascript
const INDORE_BOUNDS = [
  [22.50, 75.60],
  [22.90, 76.10],
];
```

### Adjusting Zoom Levels

For smaller radii, use higher initial zoom:

```javascript
zoom={12}        // Closer view for 15 km
minZoom={11}     // Prevents zooming out too far
```

For larger radii, use lower initial zoom:

```javascript
zoom={11}        // Wider view for 30 km
minZoom={10}     // Allows more context
```

---

## 📊 Performance Impact

### Query Performance

**Smaller radius improvements:**
- **Faster queries:** Fewer documents scanned
- **Less data transfer:** Smaller result sets
- **Better caching:** More focused cache keys
- **Lower server load:** Reduced aggregation work

**Estimated improvements:**
- 15 km radius ≈ 707 km² search area
- 30 km radius ≈ 2,827 km² search area
- **~75% reduction** in search area
- **~2-3x faster** query performance

### User Experience

**Benefits:**
- More relevant local issues
- Faster load times
- Better focus on immediate area
- Clearer map visualization

**Trade-offs:**
- Less coverage of outer areas
- May miss issues in distant suburbs
- Need to relocate to see other areas

---

## 🚀 Comparison: 15 km vs 30 km

| Aspect | 15 km Radius | 30 km Radius |
|--------|--------------|--------------|
| Search Area | ~707 km² | ~2,827 km² |
| Coverage | Central Indore | Entire metro area |
| Query Speed | Faster | Slower |
| Relevance | High local relevance | Broader coverage |
| Zoom Level | 12 (closer) | 11 (wider) |
| Pithampur | Not included | Included |
| Dewas | Not included | Included |
| Suburbs | Inner suburbs | All suburbs |

---

## 📁 Files Modified

- `backend/controllers/issueController.js` - Updated DEFAULT_RADIUS_KM from 30 to 15
- `frontend/src/pages/Citizen/Dashboard.jsx` - Updated RADIUS_KM from 30 to 15
- `frontend/src/components/maps/IssueMap.jsx` - Updated radius, bounds, and zoom levels

---

## ✅ Feature Complete

The Leaflet map now uses a 15 km radius around Indore:
- Backend searches within 15 km (15,000 meters)
- Frontend visual boundary circle shows 15 km coverage
- Map bounds restricted to 15 km area
- Zoom levels adjusted for closer view
- More focused local coverage with better performance

Users see a more focused view of central Indore with better performance and relevance.
