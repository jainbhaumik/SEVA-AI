import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Copy,
  FilePlus2,
  Loader2,
  LocateFixed,
  Mic,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CATEGORY_MAP,
  CIVIC_CATEGORIES,
  CivicCategoryKey,
  COMPLAINT_STATUS_LABELS,
  SEVERITY_OPTIONS,
  SeverityLevel,
  WARDS,
} from '../lib/civicData';
import { ComplaintRecord, submitComplaint } from '../lib/firestoreService';
import { ExtractedVoiceReport } from '../lib/voiceClient';
import PortalLayout from '../components/PortalLayout';
import SevaSaathiPanel from '../components/SevaSaathiPanel';
import SpeakButton from '../components/SpeakButton';

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function CitizenDashboardPage() {
  const { profile, complaints, sosAlerts, setSaathiOpen } = useAuth();

  const inProgressCount = complaints.filter(
    (c) => c.status === 'under_verification' || c.status === 'assigned' || c.status === 'in_progress'
  ).length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;
  const activeSosCount = sosAlerts.filter(
    (s) => s.status !== 'resolved' && s.status !== 'cancelled'
  ).length;

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ed-meta">Citizen Overview</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Welcome, {profile?.fullName || 'Citizen'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.ward || 'Ward 1 — Central'} · Tier:{' '}
              <span className="capitalize font-semibold text-foreground">{profile?.tier || 'bronze'}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSaathiOpen(true)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-primary/30 bg-secondary/50 px-4 text-xs font-semibold text-primary hover:bg-secondary transition-colors"
            >
              <Mic className="h-4 w-4" />
              Report Using Voice
            </button>
            <Link
              to="/citizen/report/new"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <FilePlus2 className="h-4 w-4" />
              New Civic Report
            </Link>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'My Reports', value: complaints.length, to: '/citizen/reports' },
            { label: 'Active / In Progress', value: inProgressCount, to: '/citizen/reports' },
            { label: 'Resolved Issues', value: resolvedCount, to: '/citizen/reports' },
            { label: 'Civic Reward Points', value: profile?.points ?? 0, to: '/citizen/rewards' },
          ].map((stat) => (
            <Link
              key={stat.label}
              to={stat.to}
              className="ed-card p-4 hover:border-primary/40 transition-colors"
            >
              <p className="ed-stat text-2xl md:text-3xl text-foreground">{stat.value}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{stat.label}</p>
            </Link>
          ))}
        </div>

        {activeSosCount > 0 && (
          <div className="rounded-xl border-2 border-destructive bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-destructive">
                  You have {activeSosCount} active emergency alert{activeSosCount > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  View live control room acknowledgement and unit status in SEVA Shield.
                </p>
              </div>
            </div>
            <Link
              to="/citizen/shield"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-destructive px-4 text-xs font-semibold text-destructive-foreground shrink-0"
            >
              View SOS Status
            </Link>
          </div>
        )}

        {/* Quick Actions + Recent Reports */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="ed-card p-5 lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-foreground">Recent reports</h2>
              <Link
                to="/citizen/reports"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {complaints.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">No civic reports submitted yet</p>
                <p className="text-xs text-muted-foreground">
                  Report potholes, waste accumulation, blocked drains, traffic obstructions, accidents, animal rescue, or safety concerns.
                </p>
                <Link
                  to="/citizen/report/new"
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
                >
                  Submit your first report
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {complaints.slice(0, 5).map((c) => (
                  <li key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono-tabular">{c.reportCode}</span> ·{' '}
                        {CATEGORY_MAP[c.category]?.short || c.category} · {c.ward}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary shrink-0">
                      {COMPLAINT_STATUS_LABELS[c.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-4">
            <div className="ed-card p-5 space-y-3">
              <h2 className="text-base font-bold text-foreground">SEVA SAATHI Voice</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Speak in English, Hindi, Bengali, or Assamese to report civic issues or ask how city services work.
              </p>
              <button
                type="button"
                onClick={() => setSaathiOpen(true)}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
              >
                <Mic className="h-4 w-4" />
                Launch Voice Assistant
              </button>
            </div>

            <div className="ed-card p-5 space-y-2.5">
              <h2 className="text-base font-bold text-foreground">Emergency &amp; Safety Tools</h2>
              <div className="grid gap-2 text-xs font-semibold">
                <Link
                  to="/citizen/shield"
                  className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-destructive hover:bg-destructive/10"
                >
                  <span>SEVA Shield (Women &amp; Child Safety)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/citizen/medical"
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-foreground hover:bg-muted"
                >
                  <span>Medical &amp; Ambulance Assistance</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/citizen/accident"
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-foreground hover:bg-muted"
                >
                  <span>Road Accident Reporting</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

export function ReportNewPage() {
  const { user, profile, language } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const voiceDraftFromNav = (location.state as { voiceDraft?: ExtractedVoiceReport } | null)?.voiceDraft;

  const initialCat = (searchParams.get('category') as CivicCategoryKey) || 'roads';
  const validInitialCat = CATEGORY_MAP[initialCat] ? initialCat : 'roads';

  const [category, setCategory] = useState<CivicCategoryKey>(validInitialCat);
  const [subcategory, setSubcategory] = useState(CATEGORY_MAP[validInitialCat].subcategories[0]);
  const [severity, setSeverity] = useState<SeverityLevel>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ward, setWard] = useState(profile?.ward || WARDS[0].name);
  const [locationText, setLocationText] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: WARDS[0].lat,
    lng: WARDS[0].lng,
  });
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [source, setSource] = useState<'form' | 'voice_seva_saathi'>('form');
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const [voiceBanner, setVoiceBanner] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    id: string;
    reportCode: string;
    trackToken: string;
  } | null>(null);

  const applyDraft = (draft: ExtractedVoiceReport) => {
    if (draft.category && CATEGORY_MAP[draft.category as CivicCategoryKey]) {
      const cKey = draft.category as CivicCategoryKey;
      setCategory(cKey);
      setSubcategory(
        draft.subcategory && CATEGORY_MAP[cKey].subcategories.includes(draft.subcategory)
          ? draft.subcategory
          : CATEGORY_MAP[cKey].subcategories[0]
      );
    }
    if (draft.severity && ['low', 'medium', 'high', 'critical'].includes(draft.severity)) {
      setSeverity(draft.severity as SeverityLevel);
    }
    if (draft.title) setTitle(draft.title);
    if (draft.description) setDescription(draft.description);
    if (draft.ward) {
      const matched = WARDS.find((w) => w.name.toLowerCase().includes(draft.ward.toLowerCase()));
      if (matched) {
        setWard(matched.name);
        setCoords({ lat: matched.lat, lng: matched.lng });
      }
    }
    if (draft.locationText) setLocationText(draft.locationText);
    setSource('voice_seva_saathi');
    setShowVoiceAssistant(false);
    setVoiceBanner(
      draft.missingFields?.length
        ? `Voice draft populated. Please verify all fields and provide: ${draft.missingFields.join(', ')}.`
        : 'Voice draft populated. Review the details below and click Submit Report to save.'
    );
  };

  useEffect(() => {
    if (voiceDraftFromNav) {
      applyDraft(voiceDraftFromNav);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategoryChange = (next: CivicCategoryKey) => {
    setCategory(next);
    setSubcategory(CATEGORY_MAP[next].subcategories[0]);
  };

  const handleWardChange = (nextWard: string) => {
    setWard(nextWard);
    const found = WARDS.find((w) => w.name === nextWard);
    if (found) setCoords({ lat: found.lat, lng: found.lng });
  };

  const detectGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation is not supported in this browser.');
      return;
    }
    setGpsStatus('Requesting GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus(
          `Captured GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
        );
        if (!locationText.trim()) {
          setLocationText(`GPS ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        }
      },
      () => {
        setGpsStatus('Location permission denied or unavailable. Enter your street address manually.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Image exceeds the 10 MB upload limit.');
      return;
    }
    try {
      const compressed = await compressImageToDataUrl(file);
      setPhotoDataUrl(compressed);
      setError(null);
    } catch {
      setError('Could not process image. Please try a JPG or PNG photo.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    setError(null);

    if (title.trim().length < 3 || description.trim().length < 5 || locationText.trim().length < 2) {
      setError('Please enter a clear title, description, and street/landmark location before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitComplaint({
        citizenId: user.uid,
        citizenName: profile?.fullName || user.displayName || 'Citizen',
        category,
        subcategory,
        title,
        description,
        severity,
        ward,
        locationText,
        lat: coords.lat,
        lng: coords.lng,
        source,
        language,
        photoDataUrl,
      });
      setSubmittedResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedResult) {
    return (
      <PortalLayout portal="citizen">
        <div className="mx-auto max-w-xl">
          <div className="ed-card p-6 md:p-8 text-center space-y-5">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <div className="space-y-1">
              <p className="ed-meta">Report Submitted</p>
              <h1 className="text-2xl font-bold text-foreground">Your civic report is recorded</h1>
              <p className="text-sm text-muted-foreground">
                Routed to <strong>{CATEGORY_MAP[category].department}</strong> ({CATEGORY_MAP[category].departmentCode}).
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Official Complaint ID</p>
              <p className="font-mono-tabular text-xl font-bold text-primary">
                {submittedResult.reportCode}
              </p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(submittedResult.reportCode)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy complaint ID
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <SpeakButton
                label="Hear confirmation"
                text={`Your ${CATEGORY_MAP[category].label} report has been submitted with complaint ID ${submittedResult.reportCode} and routed to ${CATEGORY_MAP[category].department}.`}
              />
              <Link
                to={`/track/${submittedResult.trackToken}`}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-input bg-card px-4 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Open Public Track Link
              </Link>
              <Link
                to="/citizen/reports"
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
              >
                View My Reports
              </Link>
            </div>
          </div>
        </div>
      </PortalLayout>
    );
  }

  const catInfo = CATEGORY_MAP[category];

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="ed-meta">Civic Intake</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Report a civic issue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit by form or speak naturally using SEVA SAATHI voice reporting.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowVoiceAssistant((v) => !v)}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity shrink-0"
          >
            <Mic className="h-4 w-4" />
            {showVoiceAssistant ? 'Hide Voice Reporting' : 'Report Using Voice'}
          </button>
        </div>

        {showVoiceAssistant && (
          <SevaSaathiPanel
            mode="voice_report"
            embedded
            onApplyReportDraft={(draft) => applyDraft(draft)}
          />
        )}

        {voiceBanner && (
          <div className="rounded-xl border border-primary/30 bg-secondary/40 p-4 text-xs text-foreground flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>{voiceBanner}</p>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="ed-card p-5 md:p-7 space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Category Grid */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Issue Category</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {CIVIC_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleCategoryChange(c.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    category === c.value
                      ? 'border-primary bg-secondary/40 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <p className="text-xs font-bold text-foreground">{c.short}</p>
                  <p className="mt-0.5 text-[11px] line-clamp-2">{c.label}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Routed to: <strong className="text-foreground">{catInfo.department}</strong> ({catInfo.departmentCode})
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="rep-sub" className="text-xs font-semibold">Subcategory</label>
              <select
                id="rep-sub"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
              >
                {catInfo.subcategories.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-sev" className="text-xs font-semibold">Severity</label>
              <select
                id="rep-sev"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label} — {s.hint}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rep-title" className="text-xs font-semibold">Short Title</label>
            <input
              id="rep-title"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Deep pothole near Central Market gate"
              className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rep-desc" className="text-xs font-semibold">Detailed Description</label>
            <textarea
              id="rep-desc"
              required
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the hazard, landmarks, and impact on citizens or traffic..."
              className="w-full rounded-lg border border-input bg-background p-3 text-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="rep-ward" className="text-xs font-semibold">City Ward</label>
              <select
                id="rep-ward"
                value={ward}
                onChange={(e) => handleWardChange(e.target.value)}
                className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
              >
                {WARDS.map((w) => (
                  <option key={w.name} value={w.name}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-loc" className="text-xs font-semibold">Street / Landmark Location</label>
              <div className="flex gap-2">
                <input
                  id="rep-loc"
                  required
                  maxLength={240}
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="Street name, junction, or landmark"
                  className="flex-1 min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={detectGps}
                  title="Capture GPS coordinates"
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-semibold hover:bg-muted shrink-0"
                >
                  <LocateFixed className="h-4 w-4 text-primary" />
                  GPS
                </button>
              </div>
              {gpsStatus && <p className="text-[11px] text-muted-foreground">{gpsStatus}</p>}
            </div>
          </div>

          {/* Photo Attachment */}
          <div className="space-y-2">
            <label className="text-xs font-semibold block">Photo Evidence (optional, max 10 MB)</label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-4 text-xs font-semibold text-foreground hover:bg-muted">
                <Camera className="h-4 w-4 text-primary" />
                Attach Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handlePhotoUpload(e)}
                  className="sr-only"
                />
              </label>
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl('')}
                  className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove photo
                </button>
              )}
            </div>
            {photoDataUrl && (
              <img
                src={photoDataUrl}
                alt="Attached evidence preview"
                className="mt-2 h-40 w-auto rounded-lg border border-border object-cover"
              />
            )}
          </div>

          <div className="border-t border-border pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Review all fields carefully before submitting to {catInfo.department}.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm &amp; Submit Report
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}

export function MyReportsPage() {
  const { complaints } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<ComplaintRecord | null>(null);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.reportCode.toLowerCase().includes(q) ||
          c.locationText.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [complaints, search, statusFilter]);

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="ed-meta">Citizen Records</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">My reports</h1>
          </div>
          <Link
            to="/citizen/report/new"
            className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shrink-0"
          >
            <FilePlus2 className="h-4 w-4" />
            New Report
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, title, or location..."
              className="w-full min-h-[42px] rounded-lg border border-input bg-card pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[42px] rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="all">All statuses</option>
            {Object.entries(COMPLAINT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="ed-card p-8 text-center space-y-3">
            <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">No matching reports</p>
            <p className="text-xs text-muted-foreground">
              Submit a new report via form or SEVA SAATHI voice assistant to track it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((c) => (
              <div key={c.id} className="ed-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono-tabular text-xs font-semibold text-primary">{c.reportCode}</p>
                    <h2 className="mt-0.5 text-base font-bold text-foreground truncate">{c.title}</h2>
                  </div>
                  <span className="text-xs font-semibold text-primary shrink-0">
                    {COMPLAINT_STATUS_LABELS[c.status]}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>

                <div className="text-xs text-muted-foreground">
                  {CATEGORY_MAP[c.category]?.label} · {c.ward} · {c.locationText}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                  <SpeakButton
                    label="Listen"
                    text={`Report ${c.reportCode}: ${c.title}. Status is ${COMPLAINT_STATUS_LABELS[c.status]}. ${c.resolutionNote ? `Officer update: ${c.resolutionNote}` : ''}`}
                  />
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <Link to={`/track/${c.trackToken}`} className="text-primary hover:underline">
                      Public Track
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSelected(c)}
                      className="text-foreground hover:underline"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelected(null)}
          >
            <div
              className="ed-card max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono-tabular text-xs font-semibold text-primary">{selected.reportCode}</p>
                  <h2 className="text-xl font-bold text-foreground">{selected.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{selected.description}</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Department: <strong className="text-foreground">{selected.departmentName}</strong></p>
                <p>Status: <strong className="text-foreground">{COMPLAINT_STATUS_LABELS[selected.status]}</strong></p>
                <p>Location: {selected.locationText} ({selected.ward})</p>
                <p>Submitted via: {selected.source === 'voice_seva_saathi' ? 'SEVA SAATHI Voice' : 'Civic Form'}</p>
              </div>
              {selected.photoDataUrl && (
                <img
                  src={selected.photoDataUrl}
                  alt="Report evidence"
                  className="rounded-lg border border-border max-h-60 object-cover"
                />
              )}
              {selected.resolutionNote && (
                <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
                  <p className="font-semibold text-foreground">Authority Note</p>
                  <p className="mt-1 text-muted-foreground">{selected.resolutionNote}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
