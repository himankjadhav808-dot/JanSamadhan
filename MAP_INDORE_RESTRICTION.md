# Leaflet Map Indore Region Restriction - 30 km Boundary

## ✅ Implementation Complete

Restricted the Leaflet map view to the Indore region and added a visual 30 km boundary circle around the city center.

---

## 📋 Changes Made

### 1. Map Component Update
**File:** `frontend/src/components/maps/IssueMap.jsx`

**Added:**
1. **Indore Center Coordinates:**
   ```javascript
   const INDORE_CENTER = [22.7196, 75.8577];
   ```

2. **30 km Radius Constant:**
   ```javascript
   const RADIUS_IN_METERS = 30000; // 30 km radius
   ```

3. **Map Bounds (Indore Metro Zone):**
   ```javascript
   const INDORE_BOUNDS = [
     [22.40, 75.50], // South-West limit
     [23.00, 76.20]  // North-East limit
   ];
   ```

4. **MapContainer Restrictions:**
   - `zoom={11}` - Initial zoom level shows entire Indore region
   - `minZoom={10}` - Prevents zooming out too far
   - `maxZoom={18}` - Allows detailed street-level zoom
   - `maxBounds={INDORE_BOUNDS}` - Restricts panning to Indore region
   - `maxBoundsViscosity={1.0}` - Hard boundary (no bounce back)

5. **Visual Boundary Circle:**
   - Blue dashed circle showing 30 km service area
   - Semi-transparent fill (8% opacity)
   - Centered on Indore coordinates
   - 30 km radius

### 2. Dashboard Default Center Update
**File:** `frontend/src/pages/Citizen/Dashboard.jsx`

**Changed:**
- Updated `DEFAULT_CENTER` from `[28.6139, 77.209]` to `[22.7196, 75.8577]`
- Matches the Indore center used in the map component

---

## 🎯 Map Configuration Details

### Indore Center
- **Latitude:** 22.7196° N
- **Longitude:** 75.8577° E
- **Coordinates:** Central Indore

### Map Bounds
- **South-West:** [22.40, 75.50]
- **North-East:** [23.00, 76.20]
- **Coverage:** Approximately 60 km × 70 km area
- **Purpose:** Prevents users from panning outside Indore metro area

### Zoom Levels
- **Initial Zoom:** 11 (shows entire Indore region)
- **Minimum Zoom:** 10 (prevents zooming out too far)
- **Maximum Zoom:** 18 (street-level detail)

### Boundary Circle
- **Radius:** 30,000 meters (30 km)
- **Center:** Indore coordinates
- **Color:** Blue (#2563eb)
- **Fill:** Soft blue (#3b82f6)
- **Fill Opacity:** 8%
- **Border Weight:** 2px
- **Style:** Dashed (6, 12)

---

## 🗺️ Geographic Coverage

### Areas Visible
- **Indore City:** Central business district
- **Suburbs:** Vijay Nagar, Palasia, Rajendra Nagar
- **Industrial Areas:** Pithampur, Sanwer Road
- **Nearby Towns:** Dewas, Mhow
- **Rural Areas:** Surrounding villages within 30 km

### Areas Restricted
- **Beyond Bounds:** Users cannot pan outside defined bounds
- **Other Cities:** Cannot pan to Mumbai, Delhi, etc.
- **International:** Cannot pan outside India

---

## 🎨 Visual Design

### Boundary Circle Appearance
- **Type:** Dashed line circle
- **Color:** Blue (matches JanSamadhan brand)
- **Fill:** Semi-transparent blue
- **Purpose:** Visual indicator of service area
- **Clarity:** Clearly shows the 30 km coverage zone

### Issue Markers
- Standard Leaflet markers
- Positioned at issue coordinates
- Popup shows title and net score
- Work within the restricted bounds

---

## 🧪 Testing

### Test 1: Initial View
1. Navigate to Community Feed
2. Switch to Map View
3. **Expected:** Map centered on Indore at zoom level 11
4. **Expected:** Blue dashed circle visible showing 30 km boundary

### Test 2: Panning Restriction
1. Try to pan the map outside the bounds
2. **Expected:** Map stops at boundary
3. **Expected:** Cannot pan to other cities/regions
4. **Expected:** No bounce-back effect (hard boundary)

### Test 3: Zoom Limits
1. Try to zoom out below level 10
2. **Expected:** Cannot zoom out further
3. Try to zoom in to level 18
4. **Expected:** Can zoom to street-level detail

### Test 4: Boundary Circle
1. Observe the blue dashed circle
2. **Expected:** Circle centered on Indore
3. **Expected:** Circle radius represents 30 km
4. **Expected:** Semi-transparent fill allows map features to show through

### Test 5: Issue Markers
1. Check issue markers within the boundary
2. **Expected:** All markers visible within 30 km circle
3. **Expected:** Markers outside 30 km not shown (by API filter)

---

## 🔧 Configuration

### Adjusting the Bounds

To change the restricted area, modify `INDORE_BOUNDS`:

```javascript
const INDORE_BOUNDS = [
  [southWestLat, southWestLng], // South-West corner
  [northEastLat, northEastLng]  // North-East corner
];
```

**For larger area:**
```javascript
const INDORE_BOUNDS = [
  [22.30, 75.30], // Larger bounds
  [23.10, 76.40],
];
```

**For smaller area:**
```javascript
const INDORE_BOUNDS = [
  [22.50, 75.60], // Smaller bounds
  [22.90, 76.10],
];
```

### Adjusting the Circle Radius

To change the visual boundary circle radius:

```javascript
const RADIUS_IN_METERS = 30000; // Change to desired value in meters
```

**Examples:**
- 10000 = 10 km
- 20000 = 20 km
- 50000 = 50 km

### Adjusting Zoom Levels

To change zoom restrictions:

```javascript
<MapContainer
  zoom={11}        // Initial zoom
  minZoom={10}     // Minimum zoom
  maxZoom={18}     // Maximum zoom
  // ...
/>
```

**Recommendations:**
- **City view:** 10-12
- **Neighborhood view:** 13-15
- **Street view:** 16-18

---

## 📊 Technical Details

### Leaflet Configuration

**maxBoundsViscosity:**
- `1.0` = Hard boundary (no bounce back)
- `0.0` = Soft boundary (bounce back)
- `0.5` = Medium boundary

**Circle PathOptions:**
- `color`: Border color
- `fillColor`: Fill color
- `fillOpacity`: Transparency (0-1)
- `weight`: Border thickness in pixels
- `dashArray`: Dashed line pattern (dash, gap)

### Coordinate System

**Leaflet uses [lat, lng] format:**
- Latitude: -90 to 90 (North-South)
- Longitude: -180 to 180 (East-West)
- Indore: [22.7196, 75.8577]

**MongoDB uses [lng, lat] format:**
- Opposite order from Leaflet
- Must be converted when displaying on map

---

## 🚀 Future Enhancements

### Potential Improvements

1. **Dynamic Bounds by User Role**
   - Citizens: Full 30 km bounds
   - Authorities: Restricted to their jurisdiction

2. **Location-Based Auto-Center**
   - Detect user's location
   - Auto-center map on user's position
   - Still respect bounds

3. **Multiple Boundary Circles**
   - Different zones with different colors
   - Priority zones (inner 10 km, outer 30 km)
   - Service area tiers

4. **Interactive Boundary Controls**
   - Toggle boundary circle visibility
   - Adjust radius with slider
   - Display distance from center

5. **Boundary Labels**
   - Label the boundary circle
   - Show radius in UI
   - Display coverage percentage

---

## 📁 Files Modified

- `frontend/src/components/maps/IssueMap.jsx` - Added Indore center, bounds, and boundary circle
- `frontend/src/pages/Citizen/Dashboard.jsx` - Updated default center to Indore coordinates

---

## ✅ Feature Complete

The Leaflet map is now restricted to the Indore metro area with:
- Fixed center on Indore coordinates
- Visual 30 km boundary circle
- Panning restricted to defined bounds
- Zoom levels limited to appropriate range
- Hard boundary prevents navigation outside service area

Users can now see the service coverage area clearly and cannot navigate outside the Indore region.
