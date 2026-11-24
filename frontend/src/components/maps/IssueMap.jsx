import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapContainer, Marker, Popup, TileLayer, Circle, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toLatLng } from '../../lib/issues';
import { ExternalLink, CheckCircle, Crosshair, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
});

// Fixed Indore service-area anchor — this NEVER changes
const INDORE_CENTER    = [22.7196, 75.8577];
const RADIUS_IN_METERS = 20000;
const INDORE_BOUNDS    = [[22.50, 75.60], [22.90, 76.10]];

// ---------------------------------------------------------------------------
// MapViewMover
// Calls map.setView on every mapTarget.seq increment so the camera always
// jumps even when coordinates haven't changed between recenter presses.
// ---------------------------------------------------------------------------
function MapViewMover({ mapTarget }) {
  const map = useMap();
  useEffect(() => {
    if (!mapTarget?.coords) return;
    map.setView(mapTarget.coords, 14, { animate: true });
  }, [mapTarget?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ---------------------------------------------------------------------------
// IssueMap
//
// Props:
//   issues       — issue objects to render as map pins
//   className    — forwarded to outer wrapper div
//   onRecenter   — () => void — Recenter button callback
//   isLocating   — boolean — spinner on Recenter button
//   liveLocation — [lat, lng] | null — live GPS position (single marker, read-only)
//   mapTarget    — { coords:[lat,lng], seq:number } | null — fly-to target
//   gpsStatus    — string — displayed in the status bar below the map
//
// Design:
//   • 20 km Indore circle is FIXED to INDORE_CENTER, never moves.
//   • User location is driven exclusively by device geolocation — no map
//     click or drag can reposition the pin.
//   • Recenter button is absolutely positioned over the map — not inside
//     Leaflet controls — so it is always visible and clickable.
// ---------------------------------------------------------------------------
export default function IssueMap({
  issues       = [],
  className    = '',
  onRecenter,
  isLocating   = false,
  liveLocation = null,
  mapTarget    = null,
  gpsStatus    = '',
}) {
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const isAuthority = user && ['admin', 'super-admin', 'sub-admin', 'SubAdmin'].includes(user.role);

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card ${className}`}>
      <style>{`
        .custom-map-popup .leaflet-popup-content-wrapper {
          padding: 0; border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .custom-map-popup .leaflet-popup-content { margin: 0; border-radius: 12px; }
        .custom-map-popup .leaflet-popup-tip     { background: white; }
        .description-clamp {
          display: -webkit-box; -webkit-line-clamp: 2;
          -webkit-box-orient: vertical; overflow: hidden;
        }
      `}</style>

      {/* Relative wrapper keeps the Recenter button above Leaflet's layers */}
      <div className="relative min-h-[320px] flex-1">
        <MapContainer
          center={INDORE_CENTER}
          zoom={11}
          minZoom={10}
          maxZoom={18}
          maxBounds={INDORE_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom
          className="h-full w-full"
          style={{ minHeight: 320 }}
        >
          {/* Animate camera whenever mapTarget.seq increments */}
          <MapViewMover mapTarget={mapTarget} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Fixed 20 km Indore coverage boundary — never moves */}
          <Circle
            center={INDORE_CENTER}
            radius={RADIUS_IN_METERS}
            pathOptions={{
              color: '#2563eb', fillColor: '#3b82f6',
              fillOpacity: 0.06, weight: 2, dashArray: '6, 12',
            }}
          />

          {/* Live GPS user marker — read-only, geolocation-driven only */}
          {liveLocation && (
            <Marker position={liveLocation}>
              <Popup>
                <div className="py-0.5 text-xs font-medium text-slate-800">
                  <p className="mb-0.5 font-bold text-blue-600">📍 Your Live Location</p>
                  <p>{liveLocation[0].toFixed(5)}°N, {liveLocation[1].toFixed(5)}°E</p>
                  <p className="mt-1 text-[11px] text-slate-500">Updated from device GPS</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Issue report pins */}
          {issues.map((issue) => {
            const position = toLatLng(issue);
            if (!position) return null;
            return (
              <Marker key={issue._id} position={position}>
                <Popup className="custom-map-popup">
                  <div className="w-56 space-y-2 p-1">
                    {issue.originalImageUrl && (
                      <img
                        src={issue.originalImageUrl}
                        alt={issue.category}
                        className="h-24 w-full rounded-xl border border-slate-100 object-cover"
                      />
                    )}
                    <div className="flex items-center justify-between gap-1">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                        {issue.category || 'Civic Issue'}
                      </span>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        issue.status === 'Solved'             ? 'bg-emerald-50 text-emerald-700' :
                        issue.status === 'Pending_Validation' ? 'bg-amber-50 text-amber-700'    :
                        issue.status === 'Live'               ? 'bg-rose-50 text-rose-700'       :
                        'bg-slate-50 text-slate-700'
                      }`}>
                        {issue.status || 'Pending'}
                      </span>
                    </div>
                    <p className="description-clamp text-xs font-medium text-slate-700">
                      {issue.description || 'No description provided.'}
                    </p>
                    <div className="flex flex-col gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/issues/${issue._id}`)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
                      >
                        <span>View Issue Details</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      {isAuthority && issue.status !== 'Solved' && (
                        <button
                          type="button"
                          onClick={() => navigate(`/issues/${issue._id}?action=resolve`)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Resolve Issue</span>
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Recenter button — absolute over the map, never inside Leaflet controls */}
        {onRecenter && (
          <button
            type="button"
            onClick={onRecenter}
            disabled={isLocating}
            title="Recenter to my location"
            className="absolute bottom-4 right-4 z-[1000] flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-md transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLocating
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              : <Crosshair className="h-3.5 w-3.5 text-blue-600" />
            }
            <span>{isLocating ? 'Locating…' : 'Recenter'}</span>
          </button>
        )}
      </div>

      {/* Status bar below the map */}
      <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-1.5">
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
          gpsStatus.startsWith('GPS active') || gpsStatus.startsWith('Pinned')
            ? 'bg-emerald-500'
            : gpsStatus.startsWith('Acquiring') || gpsStatus.startsWith('Detecting')
              ? 'bg-amber-400'
              : 'bg-red-400'
        }`} />
        <span className={`text-[11px] font-medium ${
          gpsStatus.startsWith('GPS active') || gpsStatus.startsWith('Pinned')
            ? 'text-emerald-700'
            : gpsStatus.startsWith('Acquiring') || gpsStatus.startsWith('Detecting')
              ? 'text-amber-600'
              : 'text-red-600'
        }`}>
          {gpsStatus || 'GPS unavailable'}
        </span>
      </div>
    </div>
  );
}
