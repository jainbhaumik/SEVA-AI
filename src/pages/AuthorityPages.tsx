import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Lock,
  Mic,
  Radio,
  ShieldAlert,
  Trophy,
  UserCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CATEGORY_MAP,
  CIVIC_CATEGORIES,
  COMPLAINT_STATUS_LABELS,
  ComplaintStatus,
  DEPARTMENTS,
  SOS_STATUS_LABELS,
  SosStatus,
  WARDS,
} from '../lib/civicData';
import {
  AuthorityRequestRecord,
  ComplaintRecord,
  DpdpRequestRecord,
  grantAnnualAward,
  PublicProfileRecord,
  reviewAuthorityRequest,
  reviewDpdpRequest,
  subscribeAuthorityRequests,
  subscribeDpdpRequests,
  subscribePublicLeaderboard,
  updateComplaintByAuthority,
  updateSosByAuthority,
} from '../lib/firestoreService';
import PortalLayout from '../components/PortalLayout';
import SpeakButton from '../components/SpeakButton';
import SevaSaathiPanel from '../components/SevaSaathiPanel';

export function AuthorityOverviewPage() {
  const { profile, allComplaints, allSosAlerts } = useAuth();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showVoiceBriefing, setShowVoiceBriefing] = useState(false);

  const incoming = allComplaints.filter((c) => c.status === 'submitted').length;
  const pendingVerif = allComplaints.filter((c) => c.status === 'under_verification').length;
  const assigned = allComplaints.filter((c) => c.status === 'assigned' || c.status === 'in_progress').length;
  const resolved = allComplaints.filter((c) => c.status === 'resolved').length;

  const activeSos = allSosAlerts.filter((s) => s.status !== 'resolved' && s.status !== 'cancelled');
  const medicalOpen = activeSos.filter((s) => s.type === 'medical').length;
  const accidentOpen = activeSos.filter((s) => s.type === 'accident').length;
  const criticalComplaints = allComplaints.filter(
    (c) => c.severity === 'critical' && c.status !== 'resolved' && c.status !== 'rejected'
  ).length;

  const statsSummaryText = useMemo(() => {
    return `Control room summary: ${allComplaints.length} total complaints, with ${incoming} incoming, ${pendingVerif} pending verification, ${assigned} assigned or in progress, and ${resolved} resolved. There are currently ${activeSos.length} active emergency alerts, including ${medicalOpen} medical and ${accidentOpen} accident alerts.`;
  }, [allComplaints.length, incoming, pendingVerif, assigned, resolved, activeSos.length, medicalOpen, accidentOpen]);

  const newestQueueSpeech = useMemo(() => {
    const newest = allComplaints.filter((c) => c.status === 'submitted' || c.status === 'under_verification').slice(0, 3);
    if (newest.length === 0) {
      return 'There are currently no newly submitted or unverified complaints in the queue.';
    }
    return newest
      .map(
        (c, idx) =>
          `Complaint ${idx + 1}: ${c.reportCode}, ${CATEGORY_MAP[c.category]?.label}, severity ${c.severity}, in ${c.ward}. ${c.title}.`
      )
      .join(' ');
  }, [allComplaints]);

  const kpis = [
    { label: 'Incoming reports', value: incoming, to: '/authority/reports', urgent: false },
    { label: 'Pending verification', value: pendingVerif, to: '/authority/reports', urgent: false },
    { label: 'Assigned / Active', value: assigned, to: '/authority/reports', urgent: false },
    { label: 'Resolved', value: resolved, to: '/authority/reports', urgent: false },
    { label: 'Active SOS', value: activeSos.length, to: '/authority/emergency', urgent: activeSos.length > 0 },
    { label: 'Medical open', value: medicalOpen, to: '/authority/emergency', urgent: medicalOpen > 0 },
    { label: 'Accident open', value: accidentOpen, to: '/authority/emergency', urgent: accidentOpen > 0 },
    { label: 'Critical civic open', value: criticalComplaints, to: '/authority/reports', urgent: criticalComplaints > 0 },
  ];

  return (
    <PortalLayout portal="authority">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="ed-meta">Authority Operations</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Control room overview</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as {profile?.fullName || 'Officer'}
              {profile?.designation ? ` · ${profile.designation}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((s) => !s)}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-xs font-semibold hover:bg-muted"
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              {soundEnabled ? 'Alert sound on' : 'Alert sound off'}
            </button>
            <button
              type="button"
              onClick={() => setShowVoiceBriefing((v) => !v)}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
            >
              <Mic className="h-4 w-4" />
              {showVoiceBriefing ? 'Hide Voice Briefing' : 'Voice Operations Assistant'}
            </button>
          </div>
        </div>

        {/* Authority Voice Briefing Controls */}
        <div className="ed-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-primary">SEVA SAATHI Authority Audio Briefing</p>
            <p className="text-xs text-muted-foreground">
              Listen to live queue summaries and statistics generated directly from active control room records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <SpeakButton label="Hear Queue Summary" text={newestQueueSpeech} />
            <SpeakButton label="Hear Statistics" text={statsSummaryText} />
          </div>
        </div>

        {showVoiceBriefing && (
          <SevaSaathiPanel mode="authority_briefing" embedded />
        )}

        {activeSos.length > 0 && (
          <div className="rounded-xl border-2 border-destructive bg-destructive/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-destructive">
                  {activeSos.length} active emergency {activeSos.length === 1 ? 'alert' : 'alerts'} awaiting action
                </p>
                <p className="text-xs text-muted-foreground">
                  Acknowledge and assign field units immediately in the Emergency Control Centre.
                </p>
              </div>
            </div>
            <Link
              to="/authority/emergency"
              className="min-h-[40px] inline-flex items-center gap-2 rounded-lg bg-destructive px-4 text-xs font-semibold text-destructive-foreground shrink-0"
            >
              Open Control Centre
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <Link
              key={k.label}
              to={k.to}
              className={`ed-card p-4 hover:border-primary/40 transition-colors ${
                k.urgent ? 'border-destructive/40 bg-destructive/5' : ''
              }`}
            >
              <p className={`ed-stat text-2xl ${k.urgent ? 'text-destructive' : 'text-foreground'}`}>
                {k.value}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{k.label}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="ed-card p-5 md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Latest reports</h2>
              <Link to="/authority/reports" className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1">
                View queue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {allComplaints.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No reports have been submitted yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {allComplaints.slice(0, 6).map((c) => (
                  <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono-tabular">{c.reportCode}</span> · {CATEGORY_MAP[c.category]?.short} · {c.ward}
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

          <div className="ed-card p-5 space-y-3">
            <h2 className="text-base font-bold text-foreground">Administration</h2>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link to="/authority/authorities" className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-muted">
                  <span>Officer approvals</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </li>
              <li>
                <Link to="/authority/departments" className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-muted">
                  <span>Departments &amp; routing</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </li>
              <li>
                <Link to="/authority/awards" className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-muted">
                  <span>Annual civic award</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </li>
              <li>
                <Link to="/authority/privacy" className="flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-muted">
                  <span>Privacy &amp; DPDP hub</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

export function AuthorityReportsPage() {
  const { profile, allComplaints } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<ComplaintRecord | null>(null);
  const [nextStatus, setNextStatus] = useState<ComplaintStatus>('under_verification');
  const [note, setNote] = useState('');
  const [heatmapApproved, setHeatmapApproved] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return allComplaints.filter((c) => {
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [allComplaints, categoryFilter, statusFilter]);

  const openEditor = (c: ComplaintRecord) => {
    setEditing(c);
    setNextStatus(c.status);
    setNote(c.resolutionNote || '');
    setHeatmapApproved(Boolean(c.heatmapApproved));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    try {
      await updateComplaintByAuthority({
        complaint: editing,
        status: nextStatus,
        resolutionNote: note,
        officerName: profile?.fullName || 'Authority Officer',
        heatmapApproved,
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalLayout portal="authority">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="ed-meta">Queue Management</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Report queue</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-xs"
            >
              <option value="all">All categories</option>
              {CIVIC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.short}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-xs"
            >
              <option value="all">All statuses</option>
              {Object.entries(COMPLAINT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="ed-card p-8 text-center text-xs text-muted-foreground">
            No complaints match the selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((c) => (
              <div key={c.id} className="ed-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono-tabular font-semibold text-primary">{c.reportCode}</span>
                    <span>·</span>
                    <span>{CATEGORY_MAP[c.category]?.label}</span>
                    <span>·</span>
                    <span className="capitalize font-semibold text-foreground">{c.severity}</span>
                    <span>·</span>
                    <span>{c.ward}</span>
                  </div>
                  <h2 className="text-base font-bold text-foreground">{c.title}</h2>
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Citizen: {c.citizenName} · Location: {c.locationText} · Dept: {c.departmentCode}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <SpeakButton
                    label="Listen"
                    text={`${c.reportCode}, ${CATEGORY_MAP[c.category]?.label} in ${c.ward}. ${c.title}. ${c.description}`}
                  />
                  <button
                    type="button"
                    onClick={() => openEditor(c)}
                    className="min-h-[36px] rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
                  >
                    Manage ({COMPLAINT_STATUS_LABELS[c.status]})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <form onSubmit={(e) => void handleSave(e)} className="ed-card max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono-tabular text-xs font-semibold text-primary">{editing.reportCode}</p>
                  <h2 className="text-lg font-bold text-foreground">{editing.title}</h2>
                </div>
                <button type="button" onClick={() => setEditing(null)} className="text-xs text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{editing.description}</p>
              {editing.photoDataUrl && (
                <img src={editing.photoDataUrl} alt="Citizen evidence" className="rounded-lg max-h-48 object-cover border border-border" />
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Status</label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as ComplaintStatus)}
                  className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(COMPLAINT_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Authority Action / Resolution Note</label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Inspection findings, assigned team, or resolution details..."
                  className="w-full rounded-lg border border-input bg-background p-3 text-xs"
                />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={heatmapApproved}
                  onChange={(e) => setHeatmapApproved(e.target.checked)}
                  className="accent-primary"
                />
                Approve for public Safety Heatmap
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="min-h-[40px] rounded-lg border border-input px-4 text-xs font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="min-h-[40px] rounded-lg bg-primary px-5 text-xs font-semibold text-primary-foreground">
                  {saving ? 'Updating...' : 'Save & Notify Citizen'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export function AuthorityEmergencyPage() {
  const { profile, allSosAlerts } = useAuth();
  const [unitInputs, setUnitInputs] = useState<Record<string, string>>({});

  return (
    <PortalLayout portal="authority">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="ed-meta">Live Dispatch</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Emergency control centre</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time Women &amp; Child Safety SOS, Medical Assistance, and Accident dispatch alerts.
          </p>
        </div>

        {allSosAlerts.length === 0 ? (
          <div className="ed-card p-8 text-center text-xs text-muted-foreground">
            No emergency SOS alerts recorded.
          </div>
        ) : (
          <div className="space-y-4">
            {allSosAlerts.map((alert) => {
              const isOpen = alert.status !== 'resolved' && alert.status !== 'cancelled';
              return (
                <div
                  key={alert.id}
                  className={`ed-card p-5 space-y-3 ${
                    isOpen ? 'border-2 border-destructive/60 bg-destructive/5' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono-tabular text-xs font-bold text-destructive">
                        {alert.requestCode} · {alert.type.replace('_', ' ').toUpperCase()}
                      </p>
                      <h2 className="text-lg font-bold text-foreground">
                        {alert.citizenName} — {alert.ward}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Location: {alert.locationText} ({alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}) · Trigger: {alert.triggerSource}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SpeakButton
                        label="Listen"
                        text={`Emergency ${alert.requestCode}, ${alert.type.replace('_', ' ')}, from ${alert.citizenName} in ${alert.ward} at ${alert.locationText}. ${alert.notes}`}
                      />
                      <span className="text-xs font-bold text-foreground">
                        {SOS_STATUS_LABELS[alert.status]}
                      </span>
                    </div>
                  </div>

                  {alert.notes && <p className="text-xs text-foreground">{alert.notes}</p>}

                  {isOpen && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                      <input
                        placeholder="Unit ID (e.g. PCR-Van-03)"
                        value={unitInputs[alert.id] ?? alert.unitAssigned ?? ''}
                        onChange={(e) => setUnitInputs((p) => ({ ...p, [alert.id]: e.target.value }))}
                        className="min-h-[38px] rounded-lg border border-input bg-card px-3 text-xs"
                      />
                      {(['acknowledged', 'unit_assigned', 'on_the_way', 'resolved'] as SosStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() =>
                            void updateSosByAuthority({
                              alert,
                              status: st,
                              officerName: profile?.fullName || 'Control Officer',
                              unitAssigned: unitInputs[alert.id] ?? alert.unitAssigned ?? 'Dispatch Unit',
                            })
                          }
                          className={`min-h-[38px] rounded-lg px-3 text-xs font-semibold ${
                            st === 'resolved'
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-input bg-card hover:bg-muted'
                          }`}
                        >
                          {SOS_STATUS_LABELS[st]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export function AuthorityAnalyticsPage() {
  const { allComplaints } = useAuth();

  const total = allComplaints.length;
  const resolved = allComplaints.filter((c) => c.status === 'resolved').length;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  const byCategory = CIVIC_CATEGORIES.map((cat) => ({
    label: cat.short,
    count: allComplaints.filter((c) => c.category === cat.value).length,
  }));

  const byWard = WARDS.map((w) => ({
    ward: w.name,
    count: allComplaints.filter((c) => c.ward === w.name).length,
  }));

  return (
    <PortalLayout portal="authority">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="ed-meta">Operational Metrics</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Analytics</h1>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="ed-card p-5">
            <p className="ed-stat text-3xl text-foreground">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Complaints</p>
          </div>
          <div className="ed-card p-5">
            <p className="ed-stat text-3xl text-primary">{resolved}</p>
            <p className="text-xs text-muted-foreground mt-1">Resolved</p>
          </div>
          <div className="ed-card p-5">
            <p className="ed-stat text-3xl text-foreground">{resolutionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Resolution Rate</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="ed-card p-5 space-y-3">
            <h2 className="text-base font-bold text-foreground">By Category</h2>
            <div className="space-y-2.5">
              {byCategory.map((item) => (
                <div key={item.label} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{item.label}</span>
                    <span className="font-mono-tabular font-semibold">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${total ? Math.round((item.count / total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ed-card p-5 space-y-3">
            <h2 className="text-base font-bold text-foreground">By City Ward</h2>
            <div className="space-y-2.5">
              {byWard.map((w) => (
                <div key={w.ward} className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{w.ward}</span>
                    <span className="font-mono-tabular font-semibold">{w.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${total ? Math.round((w.count / total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

export function AuthorityDepartmentsPage() {
  return (
    <PortalLayout portal="authority">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="ed-meta">Routing Directory</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Departments &amp; routing</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {DEPARTMENTS.map((d) => (
            <div key={d.code} className="ed-card p-5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono-tabular font-bold text-primary">{d.code}</span>
                <span className="text-muted-foreground">SLA: {d.slaHours}h</span>
              </div>
              <h2 className="text-base font-bold text-foreground">{d.name}</h2>
              <p className="text-xs text-muted-foreground">
                Handles: {d.categories.join(', ')} · Helpline: <span className="font-mono-tabular">{d.helpline}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}

export function AuthorityApprovalsPage() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<AuthorityRequestRecord[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    return subscribeAuthorityRequests(setRequests);
  }, [isAdmin]);

  return (
    <PortalLayout portal="authority">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="ed-meta">Access Control</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Officer approvals</h1>
        </div>
        {!isAdmin ? (
          <div className="ed-card p-6 text-xs text-muted-foreground">
            Only administrators can approve new officer registrations.
          </div>
        ) : requests.length === 0 ? (
          <div className="ed-card p-8 text-center text-xs text-muted-foreground">
            No officer registration requests yet.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="ed-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-foreground">{r.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.designation} · {r.departmentName} ({r.departmentCode}) · Badge {r.badgeNumber} · {r.assignedWard}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Status: <strong className="capitalize">{r.status}</strong></p>
                </div>
                {r.status === 'pending' && user && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void reviewAuthorityRequest({ request: r, decision: 'approved', reviewerUid: user.uid })}
                      className="min-h-[38px] rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void reviewAuthorityRequest({ request: r, decision: 'rejected', reviewerUid: user.uid })}
                      className="min-h-[38px] rounded-lg border border-destructive/40 px-3.5 text-xs font-semibold text-destructive"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export function AuthorityAwardsPage() {
  const [leaders, setLeaders] = useState<PublicProfileRecord[]>([]);
  const [title, setTitle] = useState('Most Socially Alert Citizen');
  const [recipientName, setRecipientName] = useState('');
  const [ward, setWard] = useState(WARDS[0].name);
  const [points, setPoints] = useState(100);
  const [verifiedReports, setVerifiedReports] = useState(5);
  const [citation, setCitation] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    return subscribePublicLeaderboard(setLeaders);
  }, []);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    await grantAnnualAward({
      year: 2026,
      title,
      recipientName,
      ward,
      points: Number(points),
      verifiedReports: Number(verifiedReports),
      citation,
    });
    setDone(true);
    setRecipientName('');
    setCitation('');
  };

  return (
    <PortalLayout portal="authority">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="ed-meta">Hall of Fame Management</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Annual civic award</h1>
        </div>

        <form onSubmit={(e) => void handleGrant(e)} className="ed-card p-6 space-y-4">
          <h2 className="text-base font-bold">Grant Hall of Fame Honor</h2>
          {done && <p className="text-xs font-semibold text-primary">Award published to /hall-of-fame.</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              required
              placeholder="Award Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
            />
            <input
              required
              placeholder="Recipient Full Name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <select
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              className="min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
            >
              {WARDS.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
            </select>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              placeholder="Points"
              className="min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
            />
            <input
              type="number"
              value={verifiedReports}
              onChange={(e) => setVerifiedReports(Number(e.target.value))}
              placeholder="Verified reports"
              className="min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm"
            />
          </div>
          <textarea
            rows={2}
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            placeholder="Award citation..."
            className="w-full rounded-lg border border-input bg-background p-3 text-xs"
          />
          <button type="submit" className="min-h-[40px] rounded-lg bg-primary px-5 text-xs font-semibold text-primary-foreground">
            Publish Award
          </button>
        </form>

        {leaders.length > 0 && (
          <div className="ed-card p-5 space-y-2">
            <h2 className="text-base font-bold">Top Ranked Citizens</h2>
            {leaders.slice(0, 5).map((l) => (
              <div key={l.uid} className="flex items-center justify-between text-xs border-t border-border pt-2">
                <span>{l.displayName} ({l.ward})</span>
                <button
                  type="button"
                  onClick={() => {
                    setRecipientName(l.displayName);
                    setWard(l.ward);
                    setPoints(l.points);
                    setVerifiedReports(l.verifiedReports);
                  }}
                  className="text-primary font-semibold hover:underline"
                >
                  Select candidate
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export function AuthorityPrivacyPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DpdpRequestRecord[]>([]);

  useEffect(() => {
    return subscribeDpdpRequests(setRequests);
  }, []);

  return (
    <PortalLayout portal="authority">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="ed-meta">Data Governance</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Privacy &amp; DPDP hub</h1>
        </div>
        {requests.length === 0 ? (
          <div className="ed-card p-8 text-center text-xs text-muted-foreground">
            No DPDP deletion requests pending.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="ed-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-foreground">{r.userName}</p>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">Status: <strong>{r.status}</strong></p>
                </div>
                {r.status === 'pending' && user && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void reviewDpdpRequest({ requestId: r.id, status: 'processed', reviewerUid: user.uid })}
                      className="min-h-[38px] rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground"
                    >
                      Mark Processed
                    </button>
                    <button
                      type="button"
                      onClick={() => void reviewDpdpRequest({ requestId: r.id, status: 'rejected', reviewerUid: user.uid })}
                      className="min-h-[38px] rounded-lg border border-input px-3.5 text-xs font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
