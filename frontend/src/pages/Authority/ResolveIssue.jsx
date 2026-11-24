import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ImagePlus, LoaderCircle } from 'lucide-react';
import api from '../../lib/api';
import { toLatLng } from '../../lib/issues';
import Loader from '../../components/Loader';

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image'));
    reader.readAsDataURL(file);
  });
}

export default function ResolveIssue() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [afterPreview, setAfterPreview] = useState('');
  const [afterUrl, setAfterUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/issues/${id}`);
        if (!cancelled) setIssue(data.issue);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || 'Could not load this issue');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Please choose an image under 5MB');
      return;
    }
    setError('');
    const dataUrl = await readFileAsDataUrl(file);
    setAfterPreview(dataUrl);
    setAfterUrl(dataUrl);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!afterUrl) {
      setError('Upload an after photo before submitting');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const position = await getCurrentPosition();
      const { data } = await api.post(`/issues/${id}/resolve`, {
        resolutionImageUrl: afterUrl,
        longitude: position.coords.longitude,
        latitude: position.coords.latitude,
        locationAccuracyMeters: position.coords.accuracy,
      });
      setSuccess(data.message || 'Resolution submitted');
      setTimeout(() => navigate('/authority/dashboard'), 1200);
    } catch (err) {
      if (err.code === 1 || err.code === 2 || err.code === 3) {
        setError('Location access is required. Enable GPS and try again while standing at the issue site.');
      } else {
        setError(err.response?.data?.message || err.message || 'Could not submit resolution');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader text="Loading issue…" />;
  }

  if (!issue) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-8 text-sm text-red-700">
        {error || 'Issue not found'}
      </div>
    );
  }

  const coords = toLatLng(issue);

  return (
    <section className="mx-auto max-w-5xl">
      <div className="mb-5">
        <Link to="/authority/dashboard" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Back to queue
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Submit resolution</h1>
        <p className="mt-1 text-sm text-slate-500">
          {issue.title} · {issue.category}
          {coords ? ` · ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}` : ''}
        </p>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p>
          <span className="font-semibold">Device location must match original issue coordinates.</span> You
          must be within 100 meters of the reported site. Off-site submissions will be rejected.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <figcaption className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
              Before photo
            </figcaption>
            {issue.originalImageUrl ? (
              <img src={issue.originalImageUrl} alt="Original issue" className="h-72 w-full object-cover" />
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-slate-400">No photo</div>
            )}
          </figure>

          <label className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white shadow-card">
            <span className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
              After photo
            </span>
            {afterPreview ? (
              <img src={afterPreview} alt="Resolution preview" className="h-72 w-full object-cover" />
            ) : (
              <span className="flex h-72 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
                <ImagePlus className="h-8 w-8 text-brand-600" />
                Click to upload a resolution photo
              </span>
            )}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            to="/authority/dashboard"
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || issue.status !== 'Live'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Submit Resolution
          </button>
        </div>
      </form>
    </section>
  );
}
