import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Award,
  Bell,
  Car,
  Check,
  CheckCircle2,
  HeartPulse,
  Loader2,
  LocateFixed,
  MapPin,
  Mic,
  MicOff,
  Phone,
  Plus,
  Shield,
  ShieldAlert,
  ThumbsUp,
  Trash2,
  Trophy,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  BADGE_DEFINITIONS,
  CATEGORY_MAP,
  COMPLAINT_STATUS_LABELS,
  EMERGENCY_PHRASES,
  haversineKm,
  LANGUAGE_OPTIONS,
  PUBLIC_FACILITIES,
  SeverityLevel,
  SOS_STATUS_LABELS,
  SupportedLanguage,
  TIER_THRESHOLDS,
  WARDS,
} from '../lib/civicData';
import {
  AwardRecord,
  cancelSosAlert,
  confirmPublicIncident,
  createSosAlert,
  EmergencyContact,
  markNotificationRead,
  PublicProfileRecord,
  submitComplaint,
  submitDpdpRequest,
  subscribeAwards,
  subscribePublicLeaderboard,
  updateUserProfileSettings,
} from '../lib/firestoreService';
import PortalLayout from '../components/PortalLayout';
import SpeakButton from '../components/SpeakButton';
import SevaSaathiPanel from '../components/SevaSaathiPanel';

function playSafetySiren() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 980;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.22);
    });
  } catch {
    // ignore audio restrictions
  }
}

export function SevaShieldPage() {
  const { user, profile, sosAlerts, language } = useAuth();
  const [ward, setWard] = useState(profile?.ward || WARDS[0].name);
  const [locationText, setLocationText] = useState('Current location');
  const [coords, setCoords] = useState({ lat: WARDS[0].lat, lng: WARDS[0].lng });
  const [notes, setNotes] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trusted Contacts state
  const [contacts, setContacts] = useState<EmergencyContact[]>(profile?.emergencyContacts || []);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRel, setNewContactRel] = useState('');
  const [savingContacts, setSavingContacts] = useState(false);

  // Opt-in voice emergency phrase recognition ("Help me" / "Help me SEVA" / "Seva madad karo")
  const [phraseListening, setPhraseListening] = useState(false);
  const [phraseMatchText, setPhraseMatchText] = useState<string | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (profile?.emergencyContacts) setContacts(profile.emergencyContacts);
  }, [profile]);

  const activeSos = sosAlerts.find(
    (s) => s.type === 'women_safety' && s.status !== 'resolved' && s.status !== 'cancelled'
  );

  const captureGps = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationText(`GPS ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      () => {}
    );
  };

  const triggerSosNow = async (triggerSource: 'manual_button' | 'voice_phrase') => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      playSafetySiren();
      await createSosAlert({
        citizenId: user.uid,
        citizenName: profile?.fullName || 'Citizen',
        type: 'women_safety',
        triggerSource,
        ward,
        locationText: locationText || ward,
        lat: coords.lat,
        lng: coords.lng,
        notes: notes || 'SEVA Shield emergency assistance requested.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create SOS alert.');
    } finally {
      setBusy(false);
      setCountdown(null);
    }
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      void triggerSosNow('manual_button');
      return;
    }
    const timer = window.setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Opt-in phrase detector using browser SpeechRecognition only when user clicks Enable
  const toggleVoicePhraseGuard = async () => {
    setError(null);
    if (phraseListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setPhraseListening(false);
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setError(
        'Continuous browser wake-phrase detection is not supported in this browser. Use the Manual SOS button or SEVA SAATHI voice assistant.'
      );
      return;
    }

    try {
      // Explicitly verify microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());

      const rec = new SpeechRec() as {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = LANGUAGE_OPTIONS.find((l) => l.code === language)?.speechLocale || 'en-IN';

      const targetPhrases = [
        ...EMERGENCY_PHRASES.en,
        ...EMERGENCY_PHRASES[language],
      ].map((p) => p.toLowerCase());

      rec.onresult = (ev) => {
        const lastIdx = ev.results.length - 1;
        const transcript = String(ev.results[lastIdx]?.[0]?.transcript || '').toLowerCase();
        if (targetPhrases.some((phrase) => transcript.includes(phrase))) {
          setPhraseMatchText(transcript);
          rec.stop();
          setPhraseListening(false);
          setCountdown(3);
        }
      };
      rec.onerror = () => {
        setPhraseListening(false);
      };
      rec.onend = () => {
        setPhraseListening(false);
      };

      rec.start();
      recognitionRef.current = rec;
      setPhraseListening(true);
    } catch {
      setError('Microphone permission was denied. Manual SOS button remains available at all times.');
    }
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const saveContactsList = async (next: EmergencyContact[]) => {
    if (!user) return;
    setSavingContacts(true);
    try {
      setContacts(next);
      await updateUserProfileSettings(user.uid, { emergencyContacts: next });
    } finally {
      setSavingContacts(false);
    }
  };

  const safetyInstructions =
    'Move toward a well-lit public space or trusted shop if safe to do so. Keep your phone audible, press Activate SOS Emergency to notify the Police Control Room inside SEVA AI, and call local emergency helpline 112 or 1091 if you need immediate voice dispatch.';

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="ed-meta">Women &amp; Child Safety</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">SEVA Shield</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Accessible emergency SOS dispatch to the Authority Control Centre with spoken safety guidance.
            </p>
          </div>
          <SpeakButton label="Hear safety instructions" text={safetyInstructions} />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Active SOS Card or SOS Trigger Card */}
        {activeSos ? (
          <div className="ed-card border-2 border-destructive bg-destructive/5 p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-destructive uppercase tracking-wider">
                  Emergency Request Active
                </p>
                <h2 className="mt-1 text-2xl font-bold font-mono-tabular text-foreground">
                  {activeSos.requestCode}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Status: <strong className="text-foreground">{SOS_STATUS_LABELS[activeSos.status]}</strong> ·{' '}
                  {activeSos.locationText} ({activeSos.ward})
                </p>
              </div>
              <button
                type="button"
                onClick={() => void cancelSosAlert(activeSos.id)}
                className="min-h-[40px] rounded-lg border border-input bg-card px-4 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Cancel Alert
              </button>
            </div>

            <div className="rounded-lg border border-border bg-card p-3.5 text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Honest status notice:</strong> This SOS is recorded in the live SEVA AI Authority Control Centre. Status only changes to Acknowledged when an officer actually accepts it.
              </p>
              {activeSos.unitAssigned && (
                <p className="text-foreground font-semibold">
                  Assigned Unit: {activeSos.unitAssigned} (Officer: {activeSos.acknowledgedBy})
                </p>
              )}
              <p>
                For direct telecom emergency dispatch, dial <strong>112</strong> or <strong>1091</strong>.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Manual SOS Panel */}
            <div className="ed-card p-6 space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                <h2 className="text-lg font-bold">Manual SOS Control</h2>
              </div>

              <div className="grid gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold" htmlFor="sos-ward">Ward</label>
                  <select
                    id="sos-ward"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {WARDS.map((w) => (
                      <option key={w.name} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold" htmlFor="sos-loc">Location / Landmark</label>
                  <div className="flex gap-2">
                    <input
                      id="sos-loc"
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      className="flex-1 min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={captureGps}
                      className="min-h-[40px] rounded-lg border border-input px-3 text-xs font-semibold hover:bg-muted"
                    >
                      <LocateFixed className="h-4 w-4 text-primary" />
                    </button>
                  </div>
                </div>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional quick note (e.g. near bus stand, wearing blue jacket)"
                  className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-xs"
                />
              </div>

              {countdown !== null ? (
                <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 text-center space-y-3">
                  <p className="text-sm font-bold text-destructive">
                    Sending SOS to Control Room in {countdown}s...
                  </p>
                  {phraseMatchText && (
                    <p className="text-xs text-muted-foreground">
                      Triggered by voice phrase: &ldquo;{phraseMatchText}&rdquo;
                    </p>
                  )}
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCountdown(null)}
                      className="min-h-[42px] rounded-lg border border-input bg-card px-4 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void triggerSosNow(phraseMatchText ? 'voice_phrase' : 'manual_button')}
                      className="min-h-[42px] rounded-lg bg-destructive px-4 text-xs font-semibold text-destructive-foreground"
                    >
                      Send Immediately
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setCountdown(5)}
                  className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-5 py-3 text-sm font-bold text-destructive-foreground shadow-sm hover:opacity-90"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldAlert className="h-5 w-5" />}
                  Activate SOS Emergency (5s Confirm)
                </button>
              )}
            </div>

            {/* Opt-In Voice Trigger + Trusted Contacts */}
            <div className="space-y-4">
              <div className="ed-card p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-foreground">Voice Emergency Phrase</h2>
                  <button
                    type="button"
                    onClick={() => void toggleVoicePhraseGuard()}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
                      phraseListening
                        ? 'bg-destructive text-destructive-foreground'
                        : 'border border-input bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    {phraseListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    {phraseListening ? 'Listening (Click to Stop)' : 'Enable Voice Guard'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Only listens when you explicitly enable it and grant microphone permission. Saying{' '}
                  <strong>&ldquo;Help me&rdquo;</strong>, <strong>&ldquo;Help me SEVA&rdquo;</strong>, or{' '}
                  <strong>&ldquo;Seva madad karo&rdquo;</strong> opens a 3-second cancelable SOS countdown.
                </p>
              </div>

              <div className="ed-card p-5 space-y-3">
                <h2 className="text-base font-bold text-foreground">
                  Trusted Emergency Contacts ({contacts.length}/5)
                </h2>
                {contacts.length > 0 && (
                  <ul className="divide-y divide-border text-xs">
                    {contacts.map((c, idx) => (
                      <li key={idx} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{c.name} ({c.relation || 'Contact'})</p>
                          <p className="font-mono-tabular text-muted-foreground">{c.phone}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void saveContactsList(contacts.filter((_, i) => i !== idx))}
                          className="text-destructive hover:underline"
                          aria-label={`Remove ${c.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {contacts.length < 5 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newContactName.trim() || !newContactPhone.trim()) return;
                      void saveContactsList([
                        ...contacts,
                        { name: newContactName.trim(), phone: newContactPhone.trim(), relation: newContactRel.trim() },
                      ]);
                      setNewContactName('');
                      setNewContactPhone('');
                      setNewContactRel('');
                    }}
                    className="grid grid-cols-3 gap-2"
                  >
                    <input
                      placeholder="Name"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      className="min-h-[38px] rounded-lg border border-input bg-background px-2.5 text-xs"
                    />
                    <input
                      placeholder="Phone"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      className="min-h-[38px] rounded-lg border border-input bg-background px-2.5 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={savingContacts}
                      className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </form>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Note: Trusted contacts are stored in your profile for quick access and responder reference; SEVA AI does not send automated external SMS unless a carrier gateway is connected.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Voice-Guided Safety Assistant */}
        <SevaSaathiPanel mode="safety_guide" embedded />
      </div>
    </PortalLayout>
  );
}

export function MedicalAssistancePage() {
  const { user, profile, sosAlerts } = useAuth();
  const [ward, setWard] = useState(profile?.ward || WARDS[0].name);
  const [locationText, setLocationText] = useState('');
  const [coords, setCoords] = useState({ lat: WARDS[0].lat, lng: WARDS[0].lng });
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const hospitals = useMemo(() => {
    return PUBLIC_FACILITIES.filter((f) => f.type === 'hospital')
      .map((f) => ({ ...f, dist: haversineKm(coords.lat, coords.lng, f.lat, f.lng) }))
      .sort((a, b) => a.dist - b.dist);
  }, [coords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    try {
      const res = await createSosAlert({
        citizenId: user.uid,
        citizenName: profile?.fullName || 'Citizen',
        type: 'medical',
        triggerSource: 'form',
        ward,
        locationText: locationText || ward,
        lat: coords.lat,
        lng: coords.lng,
        notes: notes || 'Urgent medical & ambulance assistance requested.',
      });
      setCreatedCode(res.requestCode);
    } finally {
      setBusy(false);
    }
  };

  const myMedical = sosAlerts.filter((s) => s.type === 'medical');

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="ed-meta">Emergency Control Room · ECR</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Medical assistance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Request urgent medical dispatch and locate nearest 24x7 trauma centres. Dial <strong>108</strong> or <strong>112</strong> for immediate ambulance voice dispatch.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <form onSubmit={(e) => void handleSubmit(e)} className="ed-card p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <HeartPulse className="h-5 w-5 text-destructive" />
              Request Medical Assistance
            </h2>

            {createdCode && (
              <div className="rounded-lg border border-primary/30 bg-secondary/40 p-3 text-xs">
                Request recorded with ID <strong className="font-mono-tabular">{createdCode}</strong>. Visible to Emergency Control Room officers.
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="med-ward">Ward</label>
              <select
                id="med-ward"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
              >
                {WARDS.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="med-loc">Exact Location / Landmark</label>
              <div className="flex gap-2">
                <input
                  id="med-loc"
                  required
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  placeholder="House, street, or junction"
                  className="flex-1 min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    navigator.geolocation?.getCurrentPosition((p) => {
                      setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
                      setLocationText(`GPS ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`);
                    })
                  }
                  className="min-h-[40px] rounded-lg border border-input px-3 text-xs font-semibold"
                >
                  GPS
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="med-notes">Condition &amp; Symptoms</label>
              <textarea
                id="med-notes"
                rows={3}
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe injury, consciousness, or ambulance requirement..."
                className="w-full rounded-lg border border-input bg-background p-3 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 text-sm font-semibold text-destructive-foreground"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Medical Request to Control Room
            </button>
          </form>

          <div className="space-y-4">
            <div className="ed-card p-5 space-y-3">
              <h2 className="text-base font-bold text-foreground">Nearest Emergency Hospitals</h2>
              <ul className="divide-y divide-border text-xs">
                {hospitals.map((h) => (
                  <li key={h.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{h.name}</p>
                      <p className="text-muted-foreground">{h.address}</p>
                      <p className="mt-1 font-mono-tabular text-primary">{h.phone}</p>
                    </div>
                    <span className="font-mono-tabular font-semibold shrink-0">{h.dist.toFixed(1)} km</span>
                  </li>
                ))}
              </ul>
            </div>

            {myMedical.length > 0 && (
              <div className="ed-card p-5 space-y-2">
                <h2 className="text-base font-bold text-foreground">Your Medical Requests</h2>
                {myMedical.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs border-t border-border pt-2">
                    <span className="font-mono-tabular font-semibold">{m.requestCode}</span>
                    <span className="text-primary font-semibold">{SOS_STATUS_LABELS[m.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

export function AccidentAssistancePage() {
  const { user, profile, language } = useAuth();
  const [ward, setWard] = useState(profile?.ward || WARDS[0].name);
  const [locationText, setLocationText] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('high');
  const [description, setDescription] = useState('');
  const [alsoAlertControlRoom, setAlsoAlertControlRoom] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ reportCode: string; sosCode?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    setBusy(true);
    try {
      const w = WARDS.find((item) => item.name === ward) || WARDS[0];
      const rep = await submitComplaint({
        citizenId: user.uid,
        citizenName: profile?.fullName || 'Citizen',
        category: 'accident',
        subcategory: 'Vehicle collision',
        title: `Road accident near ${locationText}`,
        description,
        severity,
        ward,
        locationText,
        lat: w.lat,
        lng: w.lng,
        source: 'form',
        language,
      });
      let sosCode: string | undefined;
      if (alsoAlertControlRoom) {
        const sos = await createSosAlert({
          citizenId: user.uid,
          citizenName: profile?.fullName || 'Citizen',
          type: 'accident',
          triggerSource: 'form',
          ward,
          locationText,
          lat: w.lat,
          lng: w.lng,
          notes: description,
        });
        sosCode = sos.requestCode;
      }
      setResult({ reportCode: rep.reportCode, sosCode });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="ed-meta">Traffic Police &amp; Emergency Response</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Accident assistance &amp; reporting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Report road collisions or injured motorists immediately to Traffic Police and Emergency Control Room.
          </p>
        </div>

        {result ? (
          <div className="ed-card p-6 space-y-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-xl font-bold">Accident Report Logged</h2>
            <p className="text-sm text-muted-foreground">
              Complaint ID: <strong className="font-mono-tabular text-foreground">{result.reportCode}</strong>
              {result.sosCode && (
                <>
                  {' '}· Emergency Dispatch ID:{' '}
                  <strong className="font-mono-tabular text-destructive">{result.sosCode}</strong>
                </>
              )}
            </p>
            <Link to="/citizen/reports" className="inline-flex min-h-[40px] items-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground">
              View in My Reports
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="ed-card p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="acc-ward">Ward</label>
                <select
                  id="acc-ward"
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {WARDS.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" htmlFor="acc-sev">Severity</label>
                <select
                  id="acc-sev"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                  className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="medium">Medium — Minor vehicle damage</option>
                  <option value="high">High — Road blocked / injuries</option>
                  <option value="critical">Critical — Severe injuries / urgent rescue</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="acc-loc">Accident Location / Highway Marker</label>
              <input
                id="acc-loc"
                required
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder="Junction, flyover, or nearby landmark"
                className="w-full min-h-[42px] rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="acc-desc">Incident Details</label>
              <textarea
                id="acc-desc"
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Number of vehicles involved, injured persons, traffic blockage..."
                className="w-full rounded-lg border border-input bg-background p-3 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={alsoAlertControlRoom}
                onChange={(e) => setAlsoAlertControlRoom(e.target.checked)}
                className="accent-destructive"
              />
              Also trigger live Emergency Control Room alert for immediate dispatch
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Accident Report
            </button>
          </form>
        )}
      </div>
    </PortalLayout>
  );
}

export function NearbyServicesPage() {
  const { publicTracks } = useAuth();
  const [coords, setCoords] = useState({ lat: WARDS[0].lat, lng: WARDS[0].lng });
  const [filterType, setFilterType] = useState<'all' | 'hospital' | 'police' | 'municipal' | 'animal_clinic'>('all');
  const [confirmedTokens, setConfirmedTokens] = useState<Record<string, boolean>>({});

  const rankedFacilities = useMemo(() => {
    return PUBLIC_FACILITIES.filter((f) => filterType === 'all' || f.type === filterType)
      .map((f) => ({ ...f, distanceKm: haversineKm(coords.lat, coords.lng, f.lat, f.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [coords, filterType]);

  const nearbyIssues = useMemo(() => {
    return publicTracks
      .map((t) => ({
        ...t,
        distanceKm: haversineKm(coords.lat, coords.lng, t.lat || WARDS[0].lat, t.lng || WARDS[0].lng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 12);
  }, [publicTracks, coords]);

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="ed-meta">Location Intelligence</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Nearby places &amp; civic issues</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hospitals, police control desks, animal rescue units, and open civic reports ranked by real distance.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((p) =>
                setCoords({ lat: p.coords.latitude, lng: p.coords.longitude })
              )
            }
            className="min-h-[40px] inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 text-xs font-semibold hover:bg-muted shrink-0"
          >
            <LocateFixed className="h-4 w-4 text-primary" />
            Use My Live GPS
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Public Facilities */}
          <div className="ed-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-foreground">Public Services</h2>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
              >
                <option value="all">All facilities</option>
                <option value="hospital">Hospitals</option>
                <option value="police">Police</option>
                <option value="animal_clinic">Animal Rescue</option>
                <option value="municipal">Municipal Hubs</option>
              </select>
            </div>
            <ul className="divide-y divide-border text-xs">
              {rankedFacilities.map((f) => (
                <li key={f.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{f.name}</p>
                    <p className="text-muted-foreground">{f.address} · {f.ward}</p>
                    <p className="mt-1 font-mono-tabular text-primary inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {f.phone} {f.open24x7 ? '· 24x7' : ''}
                    </p>
                  </div>
                  <span className="font-mono-tabular font-semibold text-foreground shrink-0">
                    {f.distanceKm.toFixed(1)} km
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Nearby Community Civic Issues */}
          <div className="ed-card p-5 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Nearby Reported Issues</h2>
            {nearbyIssues.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No civic issues have been reported in the community ledger yet.
              </p>
            ) : (
              <ul className="divide-y divide-border text-xs">
                {nearbyIssues.map((issue) => (
                  <li key={issue.trackToken} className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{issue.title}</p>
                      <p className="text-muted-foreground">
                        {CATEGORY_MAP[issue.category]?.short} · {issue.ward} · {issue.distanceKm.toFixed(1)} km ·{' '}
                        {COMPLAINT_STATUS_LABELS[issue.status]}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={confirmedTokens[issue.trackToken]}
                      onClick={async () => {
                        await confirmPublicIncident(issue.trackToken);
                        setConfirmedTokens((prev) => ({ ...prev, [issue.trackToken]: true }));
                      }}
                      className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-input bg-card px-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-50 shrink-0"
                    >
                      <ThumbsUp className="h-3.5 w-3.5 text-primary" />
                      {issue.confirmationsCount}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

export function SafetyHeatmapPage() {
  const { publicTracks } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyApproved, setOnlyApproved] = useState(false);

  const filtered = useMemo(() => {
    return publicTracks.filter((t) => {
      if (onlyApproved && !t.heatmapApproved) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      return true;
    });
  }, [publicTracks, categoryFilter, onlyApproved]);

  const wardStats = useMemo(() => {
    return WARDS.map((w) => {
      const items = filtered.filter((t) => t.ward === w.name);
      const critical = items.filter((t) => t.severity === 'critical' || t.severity === 'high').length;
      return {
        ward: w.name,
        total: items.length,
        critical,
        intensity: items.length === 0 ? 'Low' : critical >= 2 || items.length >= 4 ? 'High' : 'Moderate',
      };
    });
  }, [filtered]);

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="ed-meta">Public Safety Analytics</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">City crime &amp; safety heatmap</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Aggregated by city ward without exposing reporter identities or personal details.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-xs font-medium"
            >
              <option value="all">All incident types</option>
              {Object.values(CATEGORY_MAP).map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={onlyApproved}
                onChange={(e) => setOnlyApproved(e.target.checked)}
                className="accent-primary"
              />
              Admin-approved only
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {wardStats.map((ws) => (
            <div
              key={ws.ward}
              className={`ed-card p-5 space-y-2 ${
                ws.intensity === 'High'
                  ? 'border-destructive/50 bg-destructive/5'
                  : ws.intensity === 'Moderate'
                  ? 'border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{ws.ward}</span>
                <span
                  className={`font-semibold ${
                    ws.intensity === 'High'
                      ? 'text-destructive'
                      : ws.intensity === 'Moderate'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-primary'
                  }`}
                >
                  {ws.intensity} Risk
                </span>
              </div>
              <p className="ed-stat text-2xl text-foreground">{ws.total}</p>
              <p className="text-xs text-muted-foreground">
                {ws.critical} high/critical incidents
              </p>
            </div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}

export function RewardsAndLeaderboardPage({ initialTab = 'rewards' }: { initialTab?: 'rewards' | 'leaderboard' | 'awards' }) {
  const { profile } = useAuth();
  const [leaders, setLeaders] = useState<PublicProfileRecord[]>([]);
  const [awards, setAwards] = useState<AwardRecord[]>([]);

  useEffect(() => {
    const u1 = subscribePublicLeaderboard(setLeaders);
    const u2 = subscribeAwards(setAwards);
    return () => {
      u1();
      u2();
    };
  }, []);

  const pts = profile?.points || 0;
  const nextTier = TIER_THRESHOLDS.find((t) => t.minPoints > pts);

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="ed-meta">Civic Recognition</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {initialTab === 'leaderboard'
              ? 'Top civic contributors'
              : initialTab === 'awards'
              ? 'Annual award & Hall of Fame'
              : 'Rewards & badges'}
          </h1>
        </div>

        <div className="ed-card p-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Your Current Standing</p>
              <p className="text-xl font-bold capitalize text-foreground">
                {profile?.tier || 'bronze'} Citizen · <span className="font-mono-tabular text-primary">{pts} pts</span>
              </p>
            </div>
            {nextTier && (
              <p className="text-xs text-muted-foreground">
                {nextTier.minPoints - pts} points to {nextTier.label}
              </p>
            )}
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.round((pts / 600) * 100))}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(BADGE_DEFINITIONS).map(([key, def]) => {
            const unlocked = profile?.badges?.includes(key);
            return (
              <div
                key={key}
                className={`ed-card p-4 space-y-1 ${unlocked ? 'border-primary/40 bg-secondary/20' : 'opacity-70'}`}
              >
                <div className="flex items-center justify-between">
                  <Award className={`h-4 w-4 ${unlocked ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-[11px] font-semibold">
                    {unlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground">{def.label}</p>
                <p className="text-xs text-muted-foreground">{def.description}</p>
              </div>
            );
          })}
        </div>

        <div className="ed-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              City Leaderboard
            </h2>
            <span className="text-xs text-muted-foreground">{awards.length} Annual Awards</span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Rank</th>
                <th className="px-4 py-2.5">Citizen</th>
                <th className="px-4 py-2.5">Ward</th>
                <th className="px-4 py-2.5 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leaders.map((l, i) => (
                <tr key={l.uid}>
                  <td className="px-4 py-2.5 font-mono-tabular text-xs">#{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{l.displayName}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.ward}</td>
                  <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold text-primary">{l.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PortalLayout>
  );
}

export function NotificationsPage() {
  const { notifications } = useAuth();

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="ed-meta">Updates</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Notifications</h1>
        </div>

        {notifications.length === 0 ? (
          <div className="ed-card p-8 text-center space-y-2">
            <Bell className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold">You are all caught up</p>
            <p className="text-xs text-muted-foreground">
              Authority updates on your reports and SOS alerts appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`ed-card p-4 flex items-start justify-between gap-4 ${
                  !n.read ? 'border-primary/40 bg-secondary/20' : ''
                }`}
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => void markNotificationRead(n.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-muted shrink-0"
                  >
                    <Check className="h-3.5 w-3.5 text-primary" />
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export function ProfilePage() {
  const { user, profile, language, setLanguage } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [ward, setWard] = useState(profile?.ward || WARDS[0].name);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [dpdpReason, setDpdpReason] = useState('');
  const [dpdpDone, setDpdpDone] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setPhone(profile.phone);
      setWard(profile.ward || WARDS[0].name);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      await updateUserProfileSettings(user.uid, { fullName, phone, ward, language });
      setSavedMsg('Profile settings saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleDpdp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || dpdpReason.trim().length < 3) return;
    await submitDpdpRequest({
      userId: user.uid,
      userName: profile?.fullName || 'Citizen',
      reason: dpdpReason,
    });
    setDpdpDone(true);
    setDpdpReason('');
  };

  return (
    <PortalLayout portal="citizen">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="ed-meta">Account &amp; Privacy</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Profile &amp; settings</h1>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="ed-card p-6 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Citizen Profile
          </h2>
          {savedMsg && <p className="text-xs font-semibold text-primary">{savedMsg}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="prof-name">Full Name</label>
              <input
                id="prof-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="prof-phone">Mobile Phone</label>
              <input
                id="prof-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="prof-ward">Default Ward</label>
              <select
                id="prof-ward"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
              >
                {WARDS.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" htmlFor="prof-lang">SEVA SAATHI Voice Language</label>
              <select
                id="prof-lang"
                value={language}
                onChange={(e) => void setLanguage(e.target.value as SupportedLanguage)}
                className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
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
            className="min-h-[42px] rounded-lg bg-primary px-5 text-xs font-semibold text-primary-foreground"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>

        <form onSubmit={(e) => void handleDpdp(e)} className="ed-card p-6 space-y-3">
          <h2 className="text-base font-bold text-foreground">DPDP Privacy &amp; Account Deletion Request</h2>
          <p className="text-xs text-muted-foreground">
            Deletion requests are logged and reviewed by an administrator under the DPDP framework. Emergency records may be retained where required by law.
          </p>
          {dpdpDone ? (
            <p className="text-xs font-semibold text-primary">
              Your deletion request has been logged for administrator review.
            </p>
          ) : (
            <>
              <textarea
                rows={2}
                required
                value={dpdpReason}
                onChange={(e) => setDpdpReason(e.target.value)}
                placeholder="Reason for data/account deletion request..."
                className="w-full rounded-lg border border-input bg-background p-3 text-xs"
              />
              <button
                type="submit"
                className="min-h-[38px] rounded-lg border border-destructive/40 bg-destructive/5 px-4 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                Submit Deletion Request
              </button>
            </>
          )}
        </form>
      </div>
    </PortalLayout>
  );
}
