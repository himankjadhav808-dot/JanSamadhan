import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Upload, X, AlertTriangle, Mic, MicOff, Globe } from 'lucide-react';
import useVoiceToText from '../../hooks/useVoiceToText';
import { MapContainer, Marker, TileLayer, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import api from '../../lib/api';
import { DEPARTMENTS } from '../../constants/index';

const DEFAULT_LAT = 22.7196;
const DEFAULT_LNG = 75.8577;

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

// ---------------------------------------------------------------------------
// MapFlyController — fires flyTo only when recenterTrigger increments.
// ---------------------------------------------------------------------------
function MapFlyController({ targetCoords, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords?.[0] && targetCoords?.[1]) {
      map.flyTo(targetCoords, 16, { animate: true, duration: 1.0 });
    }
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ---------------------------------------------------------------------------
// InteractiveLocationPin — draggable marker + click-to-move + synced circle.
// ---------------------------------------------------------------------------
function InteractiveLocationPin({ position, setPosition }) {
  const markerRef = useRef(null);

  useMapEvents({
    click(e) { setPosition([e.latlng.lat, e.latlng.lng]); },
  });

  const eventHandlers = useMemo(() => ({
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const { lat, lng } = marker.getLatLng();
        setPosition([lat, lng]);
      }
    },
  }), [setPosition]);

  if (!position) return null;

  return (
    <>
      <Circle
        center={position}
        radius={80}
        pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.25, weight: 2 }}
      />
      <Marker draggable position={position} ref={markerRef} eventHandlers={eventHandlers} />
    </>
  );
}

export default function ReportIssue() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const mapInitializedRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !mapInitializedRef.current) {
      import('leaflet/dist/images/marker-icon.png');
      import('leaflet/dist/images/marker-icon-2x.png');
      import('leaflet/dist/images/marker-shadow.png');

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      mapInitializedRef.current = true;
    }
  }, []);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    originalImageUrl: '',
  });
  const [location, setLocation] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, accuracy: null });
  const [locationError, setLocationError] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageSize, setImageSize]       = useState('');   // human-readable size shown below preview
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isLocating, setIsLocating] = useState(true);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const pinManuallyMoved = useRef(false);
  const [voiceLang, setVoiceLang] = useState('hi-IN');

  const { isListening, transcript, start: startVoice, stop: stopVoice, supported: voiceSupported } = useVoiceToText(voiceLang);

  // Append new transcript segment to description (does not replace existing text)
  useEffect(() => {
    if (transcript) {
      setFormData((prev) => ({
        ...prev,
        description: prev.description ? prev.description + ' ' + transcript : transcript,
      }));
    }
  }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Continuous GPS watch ─────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError(true);
      setIsLocating(false);
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setIsLocating(false);
        setLocationError(false);
        if (!pinManuallyMoved.current) {
          setLocation({
            lat:      pos.coords.latitude,
            lng:      pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        }
      },
      () => {
        setLocationError(true);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleDetectLocation = async () => {
    setIsLocating(true);
    setLocationError(false);
    try {
      const position = await getCurrentPosition();
      setLocation(position);
      setLocationError(false);
      pinManuallyMoved.current = false;
      setRecenterTrigger((n) => n + 1);
    } catch {
      setLocation({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, accuracy: null });
      setLocationError(true);
    } finally {
      setIsLocating(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t.imageTooLarge);
      return;
    }
    setError('');

    // Auto-compress files larger than 1.5 MB using canvas
    const COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
    const MAX_SIDE = 1600;

    let finalFile = file;
    if (file.size > COMPRESS_THRESHOLD) {
      try {
        const bitmap = await createImageBitmap(file);
        let { width, height } = bitmap;
        if (width > MAX_SIDE || height > MAX_SIDE) {
          const ratio = Math.min(MAX_SIDE / width, MAX_SIDE / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
        if (blob && blob.size < file.size) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
          finalFile = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
        }
      } catch {
        // Compression failed — fall back to original file silently
      }
    }

    const fmt = (n) => n < 1024 * 1024
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / (1024 * 1024)).toFixed(1)} MB`;

    const sizeLabel = finalFile !== file
      ? `Compressed: ${fmt(finalFile.size)} (original ${fmt(file.size)})`
      : fmt(file.size);
    setImageSize(sizeLabel);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setImagePreview(reader.result);
        setFormData((prev) => ({ ...prev, originalImageUrl: reader.result }));
      }
    };
    reader.readAsDataURL(finalFile);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageSize('');
    setFormData((prev) => ({ ...prev, originalImageUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      navigate('/login');
      return;
    }

    if (locationError) {
      setError(t.locationRequiredBody);
      return;
    }

    if (!formData.title || !formData.description || !formData.category || !formData.originalImageUrl) {
      setError(t.fillAllFields);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await api.post('/issues', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        originalImageUrl: formData.originalImageUrl,
        longitude: location.lng,
        latitude: location.lat,
        locationAccuracyMeters: location.accuracy,
      });

      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || t.submitFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const mapCenter = [location.lat, location.lng];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{t.reportHeader}</h1>
        <p className="mt-1 text-sm text-slate-500">{t.reportSubheader}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {locationError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">{t.locationRequired}</p>
              <p className="mt-1">{t.locationRequiredBody}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" lang={lang}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">{t.beforePhoto}</label>
          <div className="relative">
            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 transition hover:border-brand-400 hover:bg-brand-50"
              >
                <Upload className="h-10 w-10 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-600">{t.uploadPhoto}</p>
                <p className="mt-1 text-xs text-slate-500">{t.uploadPhotoHint}</p>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200">
                <img src={imagePreview} alt="Preview" className="h-64 w-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {imageSize && (
              <p className="mt-1.5 text-[11px] font-medium text-slate-500">{imageSize}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium text-slate-700">
            {t.titleLabel}
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t.titlePlaceholder}
            maxLength={120}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            required
          />
        </div>

        <div>
          <label htmlFor="category" className="mb-2 block text-sm font-medium text-slate-700">
            {t.deptLabel}
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            required
          >
            <option value="">{t.selectDept}</option>
            {Array.isArray(DEPARTMENTS) && DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {t[`dept_${dept}`] || dept}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="description" className="mb-2 block text-sm font-medium text-slate-700">
            {t.descLabel}
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t.descPlaceholder}
            rows={4}
            maxLength={2000}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            required
          />
          {voiceSupported && (
            <div className="mt-2 flex items-center gap-2">
              <Globe className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="hi-IN">हिन्दी (hi-IN)</option>
                <option value="mr-IN">मराठी (mr-IN)</option>
                <option value="en-US">English (en-US)</option>
              </select>
              <button
                type="button"
                onClick={isListening ? stopVoice : startVoice}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  isListening
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    : 'bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100'
                }`}
              >
                {isListening ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <MicOff className="h-3.5 w-3.5" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    Voice Input
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">{t.locationLabel}</label>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MapPin className="h-4 w-4" />
              {isLocating ? t.detecting : t.detectLocation}
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {location && (
              <MapContainer
                center={mapCenter}
                zoom={16}
                scrollWheelZoom={false}
                className="h-48 w-full"
                attributionControl={false}
              >
                <MapFlyController
                  targetCoords={mapCenter}
                  trigger={recenterTrigger}
                />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <InteractiveLocationPin
                  position={mapCenter}
                  setPosition={([lat, lng]) => {
                    pinManuallyMoved.current = true;
                    setLocation((prev) => ({ ...prev, lat, lng }));
                  }}
                />
              </MapContainer>
            )}
          </div>
          {location && (
            <p className="mt-2 text-xs text-slate-500">
              {t.coordinates}: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              {location.accuracy && ` (±${Math.round(location.accuracy)}m ${t.accuracy})`}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || locationError || !formData.originalImageUrl}
          className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t.submitting : t.submitIssueBtn}
        </button>
      </form>
    </div>
  );
}
