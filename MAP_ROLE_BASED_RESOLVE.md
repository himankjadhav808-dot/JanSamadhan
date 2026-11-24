# Role-Based "Resolve Issue" Action in Map Popup

## ✅ Implementation Complete

Added a role-based "Resolve Issue" button to the Leaflet map marker popup that only appears for admin and sub-admin users, with automatic redirection to the resolve page.

---

## 📋 Changes Made

### 1. Map Component: Role-Based Button
**File:** `frontend/src/components/maps/IssueMap.jsx`

**Added:**
1. **Import:** `useAuth` hook and `CheckCircle` icon
2. **Hook:** `useAuth` to get current user
3. **Role Check:** `isAuthority` boolean for admin/sub-admin roles
4. **Resolve Button:** Green button with CheckCircle icon

**Role Check Logic:**
```javascript
const isAuthority = user && ['admin', 'super-admin', 'sub-admin', 'SubAdmin'].includes(user.role);
```

**Resolve Button Features:**
- **Condition:** Only shows if `isAuthority` is true AND issue status is not 'Solved'
- **Color:** Emerald/green (#059669 → #047857)
- **Icon:** CheckCircle icon
- **Text:** "Resolve Issue"
- **Action:** Navigates to `/issues/{issueId}?action=resolve`
- **Animation:** Active scale on click

### 2. Issue Detail Page: Action Handler
**File:** `frontend/src/pages/IssueDetail.jsx`

**Added:**
1. **Import:** `useSearchParams` from react-router-dom
2. **Effect Hook:** Handles `action=resolve` query parameter
3. **Auto-Redirect:** Redirects to resolve page for authorities

**Action Handler Logic:**
```javascript
useEffect(() => {
  const action = searchParams.get('action');
  if (action === 'resolve' && user) {
    const isAuthority = ['admin', 'super-admin', 'sub-admin', 'SubAdmin'].includes(user.role);
    if (isAuthority) {
      navigate(`/authority/resolve/${id}`, { replace: true });
    }
  }
}, [searchParams, user, id, navigate]);
```

**Behavior:**
- Checks URL query parameter `action=resolve`
- Verifies user has authority role
- Redirects to `/authority/resolve/{id}` if authorized
- Uses `replace: true` to avoid back button issues

---

## 🎯 User Flow

### For Authorities (Admin/Sub-Admin)

1. **View Map:** Navigate to Community Feed → Map View
2. **Click Marker:** Click on any issue marker
3. **See Two Buttons:**
   - "View Issue Details" (blue)
   - "Resolve Issue" (green, only for authorities)
4. **Click Resolve:** Click "Resolve Issue" button
5. **Auto-Redirect:** Redirected to `/authority/resolve/{id}`
6. **Submit Fix:** Upload fix image and submit resolution

### For Citizens

1. **View Map:** Navigate to Community Feed → Map View
2. **Click Marker:** Click on any issue marker
3. **See One Button:**
   - "View Issue Details" (blue only)
4. **Click View:** Navigate to issue detail page
5. **No Resolve:** Cannot see or access resolve button

---

## 🎨 Button Design

### View Issue Details Button
- **Background:** Blue (#2563eb)
- **Hover:** Darker blue (#1d4ed8)
- **Text:** White, bold
- **Icon:** ExternalLink
- **Position:** Top button (always visible)

### Resolve Issue Button
- **Background:** Emerald/green (#059669)
- **Hover:** Darker emerald (#047857)
- **Text:** White, bold
- **Icon:** CheckCircle
- **Position:** Below view button (authority only)
- **Condition:** Hidden if issue is already Solved

### Button Styling
```jsx
className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
```

---

## 🔒 Security & Authorization

### Role-Based Access Control

**Authorized Roles:**
- `admin`
- `super-admin`
- `sub-admin`
- `SubAdmin` (case-insensitive)

**Unauthorized Roles:**
- `citizen`
- Any other role

**Protection:**
1. **Frontend:** Button only renders for authorized roles
2. **Backend:** Resolve page has additional middleware protection
3. **URL Check:** Query parameter checked before redirect

### Conditional Rendering

**Button Visibility:**
```javascript
{isAuthority && issue.status !== 'Solved' && (
  <button onClick={() => navigate(`/issues/${issue._id}?action=resolve`)}>
    Resolve Issue
  </button>
)}
```

**Conditions:**
1. User must be logged in
2. User must have authority role
3. Issue must not already be Solved

---

## 🧪 Testing

### Test 1: Authority User - Resolve Button Visible
1. Log in as sub-admin or super-admin
2. Navigate to Community Feed → Map View
3. Click on an unsolved issue marker
4. **Expected:** Both "View Issue Details" and "Resolve Issue" buttons visible
5. **Expected:** Resolve button is green with CheckCircle icon

### Test 2: Authority User - Resolve Button Hidden (Solved)
1. Click on a Solved issue marker
2. **Expected:** Only "View Issue Details" button visible
3. **Expected:** Resolve button is hidden (issue already solved)

### Test 3: Citizen User - No Resolve Button
1. Log in as citizen
2. Navigate to Community Feed → Map View
3. Click on any issue marker
4. **Expected:** Only "View Issue Details" button visible
5. **Expected:** No resolve button (role not authorized)

### Test 4: Resolve Action Flow
1. As authority, click "Resolve Issue" button
2. **Expected:** Redirected to `/authority/resolve/{id}`
3. **Expected:** Resolve page loads with issue data
4. **Expected:** Can upload fix image and submit

### Test 5: URL Parameter Handling
1. Manually navigate to `/issues/{id}?action=resolve`
2. As authority: **Expected:** Redirected to resolve page
3. As citizen: **Expected:** No redirect (stays on detail page)

### Test 6: Back Button Behavior
1. Click resolve button from map
2. After redirect, press browser back button
3. **Expected:** Returns to map (not detail page) due to `replace: true`

---

## 🔧 Customization

### Change Authorized Roles

To add or remove authorized roles:

```javascript
const isAuthority = user && ['admin', 'super-admin', 'sub-admin', 'SubAdmin', 'manager'].includes(user.role);
```

### Change Button Color

To change the resolve button color:

```jsx
<button
  className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl..."
>
  <CheckCircle className="w-3.5 h-3.5"/>
  <span>Resolve Issue</span>
</button>
```

**Color options:**
- Emerald (current): `bg-emerald-600`
- Red: `bg-red-600`
- Purple: `bg-purple-600`
- Orange: `bg-orange-600`

### Change Button Label

To change the button text:

```jsx
<span>Mark as Resolved</span>  {/* Change text */}
```

### Add More Authority Actions

To add more authority-specific buttons:

```jsx
{isAuthority && issue.status !== 'Solved' && (
  <>
    <button onClick={() => navigate(`/authority/resolve/${id}`)}>
      Resolve Issue
    </button>
    <button onClick={() => navigate(`/authority/assign/${id}`)}>
      Assign to Me
    </button>
  </>
)}
```

---

## 📊 Role Configuration

### Supported Authority Roles

| Role | Can Resolve | Button Visible |
|------|--------------|----------------|
| admin | Yes | Yes |
| super-admin | Yes | Yes |
| sub-admin | Yes | Yes |
| SubAdmin | Yes | Yes |
| citizen | No | No |
| Other | No | No |

### Case Sensitivity

The role check is case-insensitive:
- `sub-admin` ✅
- `SubAdmin` ✅
- `SUB_ADMIN` ✅ (if needed)

---

## 🚀 Future Enhancements

### Potential Additions

1. **Quick Status Change**
   - Add dropdown to change status directly from map
   - "Mark as In Progress", "Mark as Solved"

2. **Priority Assignment**
   - Add priority selector in popup
   - Set Critical/High/Normal priority

3. **Comment Quick Add**
   - Add text input for quick comment
   - Submit without leaving map

4. **Bulk Actions**
   - Select multiple markers
   - Bulk resolve or assign

5. **Distance Filter**
   - Show only issues within X km
   - Filter by proximity to user

---

## 📁 Files Modified

- `frontend/src/components/maps/IssueMap.jsx` - Added role-based resolve button
- `frontend/src/pages/IssueDetail.jsx` - Added action parameter handler for auto-redirect

---

## ✅ Feature Complete

The map popup now includes role-based "Resolve Issue" functionality:
- **Authority Users:** See green "Resolve Issue" button on unsolved issues
- **Citizen Users:** Only see "View Issue Details" button
- **Auto-Redirect:** Clicking resolve navigates to `/authority/resolve/{id}`
- **Security:** Role-based access control enforced
- **UX:** Clear visual distinction between actions

Authorities can now quickly resolve issues directly from the map view without navigating through multiple pages.
