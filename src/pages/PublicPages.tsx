import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Lock,
  MapPin,
  Mic,
  Search,
  Shield,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CIVIC_CATEGORIES,
  CATEGORY_MAP,
  COMPLAINT_STATUS_LABELS,
  DEPARTMENTS,
  LANGUAGE_OPTIONS,
  SupportedLanguage,
  WARDS,
} from '../lib/civicData';
import {
  AwardRecord,
  fetchTrackByTokenOrCode,
  PublicProfileRecord,
  PublicTrackRecord,
  submitAuthorityRequest,
  subscribeAwards,
  subscribePublicLeaderboard,
  updateUserProfileSettings,
} from '../lib/firestoreService';
import SevaSaathiPanel from '../components/SevaSaathiPanel';
import SpeakButton from '../components/SpeakButton';

function PublicHeader() {
  const { user, isAuthority, language, setLanguage } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-8 px-4 md:px-6">
        <Link
          to="/"
          className="font-serif text-xl font-bold tracking-tight text-foreground whitespace-nowrap shrink-0"
        >
          SEVA AI
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="/#services" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
            Services
          </a>
          <a href="/#how" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
            How it works
          </a>
          <Link to="/hall-of-fame" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
            Hall of Fame
          </Link>
          <Link to="/track" className="hover:text-foreground transition-colors whitespace-nowrap shrink-0">
            Track report
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <select
            aria-label="Language"
            value={language}
            onChange={(e) => void setLanguage(e.target.value as SupportedLanguage)}
            className="hidden sm:block h-9 rounded-lg border border-input bg-card px-2 text-xs font-medium text-foreground"
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeLabel}
              </option>
            ))}
          </select>

          <Link
            to={user ? (isAuthority ? '/authority' : '/citizen') : '/login'}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
          >
            {user ? 'Open Portal' : 'Sign in'}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function LandingPage() {
  const { publicTracks, user, isAuthority } = useAuth();
  const [showSaathiModal, setShowSaathiModal] = useState(false);

  const verifiedCount = publicTracks.filter((t) => t.status !== 'submitted' && t.status !== 'rejected').length;
  const resolvedCount = publicTracks.filter((t) => t.status === 'resolved').length;

  const stats = [
    { label: 'Total public reports', value: publicTracks.length },
    { label: 'Verified & active', value: verifiedCount },
    { label: 'Issues resolved', value: resolvedCount },
    { label: 'Departments onboard', value: DEPARTMENTS.length },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.08fr_0.92fr] md:items-center md:gap-14 md:px-6 md:py-20">
            <div>
              <p className="ed-meta mb-3">Smart City Civic Intelligence &amp; Public Safety</p>
              <h1 className="ed-display text-4xl leading-[1.12] md:text-5xl text-foreground">
                Your City. Your Voice.{' '}
                <span className="text-primary">Your Safety.</span>
              </h1>
              <p className="mt-5 max-w-prose text-base leading-relaxed text-muted-foreground">
                SEVA AI connects citizens, municipal departments, police, animal welfare, and hospitals on one platform. Speak naturally with <strong>SEVA SAATHI</strong> in English, Hindi, Bengali, or Assamese to report civic issues, ask city guidance, or raise emergency alerts.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={user ? (isAuthority ? '/authority' : '/citizen/report/new') : '/login'}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  {user ? 'Report Civic Issue' : 'Get Started'}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => setShowSaathiModal(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-input bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors whitespace-nowrap"
                >
                  <Mic className="h-4 w-4 text-primary" />
                  Talk to SEVA SAATHI
                </button>
              </div>

              <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Location and microphone access are used only with explicit permission. Voice audio is never stored on SEVA AI servers.
                </span>
              </p>
            </div>

            {/* City Operations Live Card */}
            <div className="ed-card p-6 space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="ed-meta">Live Platform Ledger</p>
                  <h2 className="mt-1 text-lg font-bold text-foreground">City Operations</h2>
                </div>
                <span className="text-xs font-semibold text-primary">Firestore Live</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-lg border border-border bg-muted/40 p-3.5">
                    <p className="ed-stat text-2xl text-foreground">{s.value}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-primary">SEVA SAATHI Voice Intelligence</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Powered by ElevenLabs Speech-to-Text and Text-to-Speech across English, Hindi, Bengali, and Assamese.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    to="/track"
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Track a report
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                  <span className="text-muted-foreground">·</span>
                  <Link
                    to="/hall-of-fame"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Civic Hall of Fame
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Civic & Safety Services */}
        <section id="services" className="border-b border-border py-14 md:py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="ed-meta">Civic &amp; Safety Coverage</p>
              <h2 className="ed-display text-2xl md:text-3xl text-foreground">
                Eight integrated reporting &amp; emergency response workflows
              </h2>
              <p className="text-sm text-muted-foreground">
                Every submission is automatically routed to the responsible municipal, police, animal welfare, or emergency control room.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CIVIC_CATEGORIES.map((cat) => (
                <div key={cat.value} className="ed-card p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-mono-tabular font-semibold text-primary">{cat.departmentCode}</span>
                      <span>{cat.emergency ? 'Urgent SLA' : `${cat.slaHours}h SLA`}</span>
                    </div>
                    <h3 className="text-base font-bold text-foreground">{cat.label}</h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{cat.description}</p>
                  </div>
                  <Link
                    to={user ? `/citizen/report/new?category=${cat.value}` : '/login'}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    Report {cat.short}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how" className="border-b border-border py-14 md:py-16 bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 md:px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="ed-meta">End-to-End Accountability</p>
              <h2 className="ed-display text-2xl md:text-3xl text-foreground">
                How SEVA AI &amp; SEVA SAATHI resolve city issues
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
              {[
                {
                  step: '01. Speak or Capture',
                  body: 'Describe the issue by voice using SEVA SAATHI or fill the form with GPS location and photo evidence.',
                },
                {
                  step: '02. AI Classification',
                  body: 'SEVA AI identifies the category, severity, and ward, and asks you to review and confirm before submitting.',
                },
                {
                  step: '03. Department Dispatch',
                  body: 'Your report enters the real-time Authority Control Room queue for PWD, Sanitation, Drainage, Traffic, Police, or Animal Welfare.',
                },
                {
                  step: '04. Track & Earn Rewards',
                  body: 'Follow live updates via your SEVA report code and earn verified civic reward points and badges upon resolution.',
                },
              ].map((item) => (
                <div key={item.step} className="ed-card p-5 space-y-2">
                  <h3 className="text-base font-bold text-foreground">{item.step}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Embedded Voice Assistant Preview */}
        <section className="py-14 md:py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] items-start">
            <div className="space-y-4">
              <p className="ed-meta">SEVA SAATHI Voice Interface</p>
              <h2 className="ed-display text-2xl md:text-3xl text-foreground">
                Ask civic questions or draft a report by voice
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Citizens can ask how to report a pothole, waste accumulation, blocked drains, animal rescue, or emergency assistance—and hear clear responses in English, Hindi, Bengali, or Assamese.
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  Real-time microphone waveform &amp; editable speech transcription
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  Play, Pause, Resume, Stop &amp; Mute spoken responses
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  Full text fallback when microphone or API is unavailable
                </li>
              </ul>
            </div>

            <SevaSaathiPanel mode="citizen_assistant" embedded />
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card py-8">
        <div className="mx-auto max-w-6xl px-4 md:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-muted-foreground">
          <div>
            <span className="font-serif text-sm font-bold text-foreground">SEVA AI Platform</span>
            <span className="mx-2">·</span>
            <span>Seva First Innovation Challenge 2026</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/track" className="hover:text-foreground">Track Report</Link>
            <Link to="/hall-of-fame" className="hover:text-foreground">Hall of Fame</Link>
            <Link to="/register/authority" className="hover:text-foreground">Authority Registration</Link>
          </div>
        </div>
      </footer>

      {showSaathiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <SevaSaathiPanel mode="citizen_assistant" onClose={() => setShowSaathiModal(false)} />
        </div>
      )}
    </div>
  );
}

export function LoginPage() {
  const { user, profile, isAuthority, signInWithGoogle, authError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isAuthorityReg = searchParams.get('type') === 'authority';

  useEffect(() => {
    if (user && profile && !isAuthorityReg) {
      navigate(isAuthority ? '/authority' : '/citizen', { replace: true });
    }
  }, [user, profile, isAuthority, isAuthorityReg, navigate]);

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setBusy(true);
    try {
      const p = await signInWithGoogle();
      if (p) {
        if (isAuthorityReg) {
          navigate('/register/authority');
        } else {
          navigate(p.role === 'authority' || p.role === 'admin' ? '/authority' : '/citizen');
        }
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="ed-card w-full max-w-md p-6 md:p-8 space-y-6">
          <div className="space-y-1.5">
            <p className="ed-meta">SEVA AI Account Access</p>
            <h1 className="text-2xl font-bold text-foreground">Sign in to SEVA AI</h1>
            <p className="text-sm text-muted-foreground">
              Access civic reporting, SEVA SAATHI voice assistance, SEVA Shield SOS, and authority control rooms.
            </p>
          </div>

          {(localError || authError) && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {localError || authError}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={busy}
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Continue with Google
          </button>

          <div className="border-t border-border pt-4 space-y-2 text-xs text-muted-foreground">
            <p>
              Municipal or police officer?{' '}
              <Link to="/register/authority" className="font-semibold text-primary hover:underline">
                Register as an Authority Officer
              </Link>
            </p>
            <p>
              Just want to check an existing complaint?{' '}
              <Link to="/track" className="font-semibold text-primary hover:underline">
                Track a report publicly
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export function RegisterPage() {
  const { user, profile, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [ward, setWard] = useState(profile?.ward || WARDS[0].name);
  const [language, setLang] = useState<SupportedLanguage>(profile?.language || 'en');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setPhone(profile.phone);
      setWard(profile.ward || WARDS[0].name);
      setLang(profile.language || 'en');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await updateUserProfileSettings(user.uid, {
        fullName,
        phone,
        ward,
        language,
      });
      navigate('/citizen');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="ed-card w-full max-w-lg p-6 md:p-8 space-y-6">
          <div className="space-y-1">
            <p className="ed-meta">Citizen Onboarding</p>
            <h1 className="text-2xl font-bold text-foreground">Create your citizen profile</h1>
            <p className="text-sm text-muted-foreground">
              Set your default ward and preferred language for SEVA SAATHI voice assistance.
            </p>
          </div>

          {!user ? (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Sign in with Google first
            </button>
          ) : (
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              {msg && <p className="text-xs text-destructive">{msg}</p>}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground" htmlFor="reg-name">Full name</label>
                <input
                  id="reg-name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground" htmlFor="reg-phone">Mobile number (optional)</label>
                <input
                  id="reg-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground" htmlFor="reg-ward">City Ward</label>
                  <select
                    id="reg-ward"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {WARDS.map((w) => (
                      <option key={w.name} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground" htmlFor="reg-lang">Preferred Language</label>
                  <select
                    id="reg-lang"
                    value={language}
                    onChange={(e) => setLang(e.target.value as SupportedLanguage)}
                    className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>{l.nativeLabel} ({l.label})</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue to Citizen Portal
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export function RegisterAuthorityPage() {
  const { user, profile, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [departmentCode, setDepartmentCode] = useState<string>('PWD');
  const [designation, setDesignation] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [assignedWard, setAssignedWard] = useState(WARDS[0].name);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.fullName) setFullName(profile.fullName);
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const id = await submitAuthorityRequest({
        uid: user.uid,
        fullName,
        email: user.email || '',
        departmentCode,
        designation,
        badgeNumber,
        assignedWard,
      });
      setSubmittedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit officer request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="ed-card w-full max-w-lg p-6 md:p-8 space-y-6">
          <div className="space-y-1">
            <p className="ed-meta">Authority Verification</p>
            <h1 className="text-2xl font-bold text-foreground">Register as Municipal or Police Officer</h1>
            <p className="text-sm text-muted-foreground">
              Officer requests require administrator approval before accessing the Authority Control Room.
            </p>
          </div>

          {!user ? (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full min-h-[44px] rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Sign in with Google to apply
            </button>
          ) : submittedId ? (
            <div className="rounded-lg border border-primary/30 bg-secondary/30 p-4 space-y-2">
              <p className="text-sm font-semibold text-primary">Request Submitted ({submittedId})</p>
              <p className="text-xs text-muted-foreground">
                Your verification request is pending review by an administrator. You can continue using the Citizen Portal meanwhile.
              </p>
              <Link to="/citizen" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Go to Citizen Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="auth-name">Officer full name</label>
                <input
                  id="auth-name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="auth-dept">Department</label>
                <select
                  id="auth-dept"
                  value={departmentCode}
                  onChange={(e) => setDepartmentCode(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="auth-desig">Designation</label>
                  <input
                    id="auth-desig"
                    required
                    placeholder="e.g. Junior Engineer / Inspector"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" htmlFor="auth-badge">Official ID / Badge No.</label>
                  <input
                    id="auth-badge"
                    required
                    placeholder="e.g. PWD-4092"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="auth-ward">Assigned Ward</label>
                <select
                  id="auth-ward"
                  value={assignedWard}
                  onChange={(e) => setAssignedWard(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {WARDS.map((w) => (
                    <option key={w.name} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Authority Verification
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export function TrackReportPage() {
  const { token } = useParams();
  const [queryInput, setQueryInput] = useState(token || '');
  const [record, setRecord] = useState<PublicTrackRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (val: string) => {
    if (!val.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetchTrackByTokenOrCode(val);
      setRecord(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      void runSearch(token);
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 space-y-6">
        <div className="space-y-1">
          <p className="ed-meta">Public Accountability</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Track a civic report</h1>
          <p className="text-sm text-muted-foreground">
            Enter your SEVA report code (e.g. SEVA-2026-...) or tracking token to check its real status.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(queryInput);
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Enter report code or tracking token..."
            className="flex-1 min-h-[44px] rounded-lg border border-input bg-card px-3.5 text-sm font-mono-tabular"
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Track
          </button>
        </form>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {searched && !loading && !record && (
          <div className="ed-card p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">No report matched that code or token</p>
            <p className="text-xs text-muted-foreground">
              Verify the exact report code from your My Reports page and try again.
            </p>
          </div>
        )}

        {record && (
          <div className="ed-card p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="font-mono-tabular text-xs font-semibold text-primary">{record.reportCode}</p>
                <h2 className="mt-1 text-xl font-bold text-foreground">{record.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {CATEGORY_MAP[record.category]?.label || record.category} · {record.ward} · {record.departmentName}
                </p>
              </div>
              <SpeakButton
                label="Listen to status"
                text={`Report ${record.reportCode}, ${record.title}. Current status is ${
                  COMPLAINT_STATUS_LABELS[record.status]
                }, assigned to ${record.departmentName} in ${record.ward}. ${
                  record.resolutionNote ? `Officer note: ${record.resolutionNote}` : ''
                }`}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-muted-foreground">Current Status</p>
                <p className="mt-1 font-semibold text-foreground">{COMPLAINT_STATUS_LABELS[record.status]}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-muted-foreground">Severity</p>
                <p className="mt-1 font-semibold capitalize text-foreground">{record.severity}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-muted-foreground">Citizen Confirmations</p>
                <p className="mt-1 font-mono-tabular font-semibold text-foreground">{record.confirmationsCount}</p>
              </div>
            </div>

            {record.resolutionNote && (
              <div className="rounded-lg border border-border bg-secondary/20 p-3.5 text-xs">
                <p className="font-semibold text-foreground">Authority Note</p>
                <p className="mt-1 text-muted-foreground">{record.resolutionNote}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export function HallOfFamePage() {
  const [awards, setAwards] = useState<AwardRecord[]>([]);
  const [leaders, setLeaders] = useState<PublicProfileRecord[]>([]);

  useEffect(() => {
    const u1 = subscribeAwards(setAwards);
    const u2 = subscribePublicLeaderboard(setLeaders);
    return () => {
      u1();
      u2();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 space-y-10">
        <div className="space-y-1">
          <p className="ed-meta">Civic Recognition</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Hall of Fame &amp; Top Contributors</h1>
          <p className="text-sm text-muted-foreground">
            Citizens recognized for verified civic reporting, emergency assistance, and neighbourhood stewardship.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Annual Civic Awards
          </h2>
          {awards.length === 0 ? (
            <div className="ed-card p-6 text-center text-xs text-muted-foreground">
              No annual awards have been granted yet for the current cycle.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {awards.map((a) => (
                <div key={a.id} className="ed-card p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-primary">{a.year} · {a.title}</span>
                    <span className="font-mono-tabular">{a.points} pts</span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{a.recipientName}</h3>
                  <p className="text-xs text-muted-foreground">{a.ward} · {a.verifiedReports} verified reports</p>
                  {a.citation && <p className="text-xs text-foreground/90 pt-1">{a.citation}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            City Civic Leaderboard
          </h2>
          {leaders.length === 0 ? (
            <div className="ed-card p-6 text-center text-xs text-muted-foreground">
              Leaderboard entries will appear as citizens verify and resolve reports.
            </div>
          ) : (
            <div className="ed-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Rank</th>
                    <th className="px-4 py-3 font-semibold">Citizen</th>
                    <th className="px-4 py-3 font-semibold">Ward</th>
                    <th className="px-4 py-3 font-semibold">Tier</th>
                    <th className="px-4 py-3 font-semibold text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leaders.map((l, idx) => (
                    <tr key={l.uid} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono-tabular text-xs font-semibold">#{idx + 1}</td>
                      <td className="px-4 py-3 font-medium">{l.displayName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{l.ward || 'City'}</td>
                      <td className="px-4 py-3 text-xs capitalize">{l.tier}</td>
                      <td className="px-4 py-3 text-right font-mono-tabular font-semibold text-primary">
                        {l.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
