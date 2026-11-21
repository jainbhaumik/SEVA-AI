import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  CATEGORY_MAP,
  CivicCategoryKey,
  ComplaintStatus,
  computeTier,
  DEPARTMENTS,
  SeverityLevel,
  SosStatus,
  SosType,
  SupportedLanguage,
  UserTier,
  WARDS,
} from './civicData';

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface UserProfileRecord {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'citizen' | 'authority' | 'admin';
  ward: string;
  language: SupportedLanguage;
  departmentCode?: string;
  designation?: string;
  points: number;
  tier: UserTier;
  badges: string[];
  emergencyContacts: EmergencyContact[];
  voiceConsent: boolean;
  voiceEmergencyPhraseEnabled: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PublicProfileRecord {
  uid: string;
  displayName: string;
  ward: string;
  points: number;
  verifiedReports: number;
  tier: UserTier;
  badges: string[];
  updatedAt: Timestamp | null;
}

export interface ComplaintRecord {
  id: string;
  reportCode: string;
  trackToken: string;
  citizenId: string;
  citizenName: string;
  category: CivicCategoryKey;
  subcategory: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  status: ComplaintStatus;
  ward: string;
  locationText: string;
  lat: number;
  lng: number;
  departmentCode: string;
  departmentName: string;
  source: 'form' | 'voice_seva_saathi';
  language: SupportedLanguage;
  photoDataUrl: string;
  confirmationsCount: number;
  resolutionNote: string;
  assignedOfficerName: string;
  heatmapApproved: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PublicTrackRecord {
  trackToken: string;
  reportCode: string;
  category: CivicCategoryKey;
  title: string;
  severity: SeverityLevel;
  status: ComplaintStatus;
  ward: string;
  departmentName: string;
  resolutionNote: string;
  lat: number;
  lng: number;
  confirmationsCount: number;
  heatmapApproved: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SosAlertRecord {
  id: string;
  requestCode: string;
  citizenId: string;
  citizenName: string;
  type: SosType;
  triggerSource: 'manual_button' | 'voice_phrase' | 'voice_assistant' | 'form';
  status: SosStatus;
  ward: string;
  locationText: string;
  lat: number;
  lng: number;
  notes: string;
  unitAssigned: string;
  acknowledgedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'report_update' | 'sos_update' | 'reward' | 'system';
  relatedId: string;
  read: boolean;
  createdAt: Timestamp | null;
}

export interface AuthorityRequestRecord {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  departmentCode: string;
  departmentName: string;
  designation: string;
  badgeNumber: string;
  assignedWard: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface DpdpRequestRecord {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  status: 'pending' | 'processed' | 'rejected';
  reviewedBy?: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AwardRecord {
  id: string;
  year: number;
  title: string;
  recipientUid?: string;
  recipientName: string;
  ward: string;
  points: number;
  verifiedReports: number;
  citation: string;
  createdAt: Timestamp | null;
}

function makeCode(prefix: string): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  const tail = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-2026-${num}${tail}`;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function ensureUserProfile(user: User): Promise<UserProfileRecord> {
  const userPath = `users/${user.uid}`;
  const publicPath = `public_profiles/${user.uid}`;
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfileRecord;
    }

    const isBootAdmin =
      Boolean(user.emailVerified) &&
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    const displayName = (user.displayName || user.email?.split('@')[0] || 'Citizen').slice(0, 120);
    const newProfile = {
      uid: user.uid,
      fullName: displayName,
      email: (user.email || '').slice(0, 160),
      phone: '',
      role: isBootAdmin ? 'admin' : 'citizen',
      ward: WARDS[0].name,
      language: 'en' as SupportedLanguage,
      points: 0,
      tier: 'bronze' as UserTier,
      badges: [],
      emergencyContacts: [],
      voiceConsent: false,
      voiceEmergencyPhraseEnabled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const batch = writeBatch(db);
    batch.set(ref, newProfile);
    batch.set(doc(db, 'public_profiles', user.uid), {
      uid: user.uid,
      displayName,
      ward: WARDS[0].name,
      points: 0,
      verifiedReports: 0,
      tier: 'bronze',
      badges: [],
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    const createdSnap = await getDoc(ref);
    return createdSnap.data() as UserProfileRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} / ${publicPath}`);
  }
}

export async function updateUserProfileSettings(
  uid: string,
  updates: Partial<
    Pick<
      UserProfileRecord,
      'fullName' | 'phone' | 'ward' | 'language' | 'emergencyContacts' | 'voiceConsent' | 'voiceEmergencyPhraseEnabled'
    >
  >
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const sanitized: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.fullName !== undefined) sanitized.fullName = updates.fullName.trim().slice(0, 120);
    if (updates.phone !== undefined) sanitized.phone = updates.phone.trim().slice(0, 24);
    if (updates.ward !== undefined) sanitized.ward = updates.ward.slice(0, 80);
    if (updates.language !== undefined) sanitized.language = updates.language;
    if (updates.emergencyContacts !== undefined)
      sanitized.emergencyContacts = updates.emergencyContacts.slice(0, 5);
    if (updates.voiceConsent !== undefined) sanitized.voiceConsent = Boolean(updates.voiceConsent);
    if (updates.voiceEmergencyPhraseEnabled !== undefined)
      sanitized.voiceEmergencyPhraseEnabled = Boolean(updates.voiceEmergencyPhraseEnabled);

    batch.update(doc(db, 'users', uid), sanitized);

    if (updates.fullName !== undefined || updates.ward !== undefined) {
      const pubUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (updates.fullName !== undefined) pubUpdates.displayName = updates.fullName.trim().slice(0, 120);
      if (updates.ward !== undefined) pubUpdates.ward = updates.ward.slice(0, 80);
      batch.update(doc(db, 'public_profiles', uid), pubUpdates);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function submitComplaint(params: {
  citizenId: string;
  citizenName: string;
  category: CivicCategoryKey;
  subcategory: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  ward: string;
  locationText: string;
  lat: number;
  lng: number;
  source: 'form' | 'voice_seva_saathi';
  language: SupportedLanguage;
  photoDataUrl?: string;
}): Promise<{ id: string; reportCode: string; trackToken: string }> {
  const complaintId = makeId('cmp');
  const trackToken = makeId('trk');
  const reportCode = makeCode('SEVA');
  const catInfo = CATEGORY_MAP[params.category];

  try {
    const batch = writeBatch(db);
    const complaintData = {
      reportCode,
      trackToken,
      citizenId: params.citizenId,
      citizenName: params.citizenName.trim().slice(0, 120) || 'Citizen',
      category: params.category,
      subcategory: (params.subcategory || catInfo.subcategories[0]).slice(0, 80),
      title: params.title.trim().slice(0, 160),
      description: params.description.trim().slice(0, 2000),
      severity: params.severity,
      status: 'submitted' as ComplaintStatus,
      ward: params.ward.slice(0, 80),
      locationText: params.locationText.trim().slice(0, 240),
      lat: Number(params.lat.toFixed(6)),
      lng: Number(params.lng.toFixed(6)),
      departmentCode: catInfo.departmentCode,
      departmentName: catInfo.department,
      source: params.source,
      language: params.language,
      photoDataUrl: (params.photoDataUrl || '').slice(0, 350000),
      confirmationsCount: 0,
      resolutionNote: '',
      assignedOfficerName: '',
      heatmapApproved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const publicTrackData = {
      trackToken,
      reportCode,
      category: params.category,
      title: complaintData.title,
      severity: params.severity,
      status: 'submitted' as ComplaintStatus,
      ward: complaintData.ward,
      departmentName: catInfo.department,
      resolutionNote: '',
      lat: complaintData.lat,
      lng: complaintData.lng,
      confirmationsCount: 0,
      heatmapApproved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    batch.set(doc(db, 'complaints', complaintId), complaintData);
    batch.set(doc(db, 'public_tracks', trackToken), publicTrackData);
    await batch.commit();

    return { id: complaintId, reportCode, trackToken };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `complaints/${complaintId}`);
  }
}

export async function confirmPublicIncident(trackToken: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'public_tracks', trackToken), {
      confirmationsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `public_tracks/${trackToken}`);
  }
}

export async function updateComplaintByAuthority(params: {
  complaint: ComplaintRecord;
  status: ComplaintStatus;
  resolutionNote: string;
  officerName: string;
  heatmapApproved: boolean;
}): Promise<void> {
  const { complaint, status, resolutionNote, officerName, heatmapApproved } = params;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'complaints', complaint.id), {
      status,
      resolutionNote: resolutionNote.trim().slice(0, 1000),
      assignedOfficerName: officerName.trim().slice(0, 120),
      heatmapApproved: Boolean(heatmapApproved),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'public_tracks', complaint.trackToken), {
      status,
      resolutionNote: resolutionNote.trim().slice(0, 1000),
      heatmapApproved: Boolean(heatmapApproved),
      updatedAt: serverTimestamp(),
    });

    // Notify citizen
    const notifId = makeId('ntf');
    batch.set(doc(db, 'notifications', notifId), {
      userId: complaint.citizenId,
      title: `Report ${complaint.reportCode} updated`,
      body: `Status changed to "${status.replace('_', ' ')}". ${resolutionNote ? resolutionNote.slice(0, 180) : ''}`.trim(),
      type: 'report_update',
      relatedId: complaint.id,
      read: false,
      createdAt: serverTimestamp(),
    });

    // Award civic points if transitioning into resolved or under_verification from submitted
    const shouldAward =
      (status === 'resolved' && complaint.status !== 'resolved') ||
      (status === 'under_verification' && complaint.status === 'submitted');

    if (shouldAward) {
      const ptsDelta = status === 'resolved' ? 40 : 15;
      const userSnap = await getDoc(doc(db, 'users', complaint.citizenId));
      if (userSnap.exists()) {
        const uData = userSnap.data() as UserProfileRecord;
        const nextPoints = (uData.points || 0) + ptsDelta;
        const nextTier = computeTier(nextPoints);
        const badgeSet = new Set(uData.badges || []);
        badgeSet.add('first_report');
        if (complaint.source === 'voice_seva_saathi') badgeSet.add('voice_pioneer');
        if (complaint.category === 'medical') badgeSet.add('first_medical');
        if (complaint.category === 'women_safety') badgeSet.add('safety_hero');

        batch.update(doc(db, 'users', complaint.citizenId), {
          points: nextPoints,
          tier: nextTier,
          badges: Array.from(badgeSet).slice(0, 20),
          updatedAt: serverTimestamp(),
        });

        const pubSnap = await getDoc(doc(db, 'public_profiles', complaint.citizenId));
        if (pubSnap.exists()) {
          const pData = pubSnap.data() as PublicProfileRecord;
          const nextVerified = (pData.verifiedReports || 0) + (status === 'under_verification' || (status === 'resolved' && complaint.status === 'submitted') ? 1 : 0);
          if (nextVerified >= 5) badgeSet.add('consistent_reporter');
          batch.update(doc(db, 'public_profiles', complaint.citizenId), {
            points: nextPoints,
            verifiedReports: nextVerified,
            tier: nextTier,
            badges: Array.from(badgeSet).slice(0, 20),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `complaints/${complaint.id}`);
  }
}

export async function createSosAlert(params: {
  citizenId: string;
  citizenName: string;
  type: SosType;
  triggerSource: 'manual_button' | 'voice_phrase' | 'voice_assistant' | 'form';
  ward: string;
  locationText: string;
  lat: number;
  lng: number;
  notes?: string;
}): Promise<{ id: string; requestCode: string }> {
  const alertId = makeId('sos');
  const requestCode = makeCode('SOS');
  try {
    await setDoc(doc(db, 'sos_alerts', alertId), {
      requestCode,
      citizenId: params.citizenId,
      citizenName: params.citizenName.trim().slice(0, 120) || 'Citizen',
      type: params.type,
      triggerSource: params.triggerSource,
      status: 'authority_notified' as SosStatus,
      ward: params.ward.slice(0, 80),
      locationText: params.locationText.trim().slice(0, 240),
      lat: Number(params.lat.toFixed(6)),
      lng: Number(params.lng.toFixed(6)),
      notes: (params.notes || '').trim().slice(0, 1000),
      unitAssigned: '',
      acknowledgedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: alertId, requestCode };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `sos_alerts/${alertId}`);
  }
}

export async function cancelSosAlert(alertId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'sos_alerts', alertId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sos_alerts/${alertId}`);
  }
}

export async function updateSosByAuthority(params: {
  alert: SosAlertRecord;
  status: SosStatus;
  officerName: string;
  unitAssigned: string;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'sos_alerts', params.alert.id), {
      status: params.status,
      acknowledgedBy: params.officerName.trim().slice(0, 120),
      unitAssigned: params.unitAssigned.trim().slice(0, 120),
      updatedAt: serverTimestamp(),
    });
    const notifId = makeId('ntf');
    batch.set(doc(db, 'notifications', notifId), {
      userId: params.alert.citizenId,
      title: `Emergency ${params.alert.requestCode} status: ${params.status.replace('_', ' ')}`,
      body: params.unitAssigned
        ? `Officer ${params.officerName} assigned ${params.unitAssigned}.`
        : `Updated by ${params.officerName}.`,
      type: 'sos_update',
      relatedId: params.alert.id,
      read: false,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `sos_alerts/${params.alert.id}`);
  }
}

export async function submitAuthorityRequest(params: {
  uid: string;
  fullName: string;
  email: string;
  departmentCode: string;
  designation: string;
  badgeNumber: string;
  assignedWard: string;
}): Promise<string> {
  const reqId = makeId('authreq');
  const dept = DEPARTMENTS.find((d) => d.code === params.departmentCode) || DEPARTMENTS[0];
  try {
    await setDoc(doc(db, 'authority_requests', reqId), {
      uid: params.uid,
      fullName: params.fullName.trim().slice(0, 120),
      email: params.email.trim().slice(0, 160),
      departmentCode: dept.code,
      departmentName: dept.name,
      designation: params.designation.trim().slice(0, 100),
      badgeNumber: params.badgeNumber.trim().slice(0, 40),
      assignedWard: params.assignedWard.slice(0, 80),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reqId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `authority_requests/${reqId}`);
  }
}

export async function reviewAuthorityRequest(params: {
  request: AuthorityRequestRecord;
  decision: 'approved' | 'rejected';
  reviewerUid: string;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'authority_requests', params.request.id), {
      status: params.decision,
      reviewedBy: params.reviewerUid,
      updatedAt: serverTimestamp(),
    });
    if (params.decision === 'approved') {
      batch.update(doc(db, 'users', params.request.uid), {
        role: 'authority',
        departmentCode: params.request.departmentCode,
        designation: params.request.designation,
        updatedAt: serverTimestamp(),
      });
    }
    const notifId = makeId('ntf');
    batch.set(doc(db, 'notifications', notifId), {
      userId: params.request.uid,
      title: `Authority registration ${params.decision}`,
      body:
        params.decision === 'approved'
          ? `Your officer access for ${params.request.departmentName} has been approved.`
          : `Your authority registration request was declined by an administrator.`,
      type: 'system',
      relatedId: params.request.id,
      read: false,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `authority_requests/${params.request.id}`);
  }
}

export async function submitDpdpRequest(params: {
  userId: string;
  userName: string;
  reason: string;
}): Promise<string> {
  const reqId = makeId('dpdp');
  try {
    await setDoc(doc(db, 'dpdp_requests', reqId), {
      userId: params.userId,
      userName: params.userName.trim().slice(0, 120),
      reason: params.reason.trim().slice(0, 1000),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return reqId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `dpdp_requests/${reqId}`);
  }
}

export async function reviewDpdpRequest(params: {
  requestId: string;
  status: 'processed' | 'rejected';
  reviewerUid: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'dpdp_requests', params.requestId), {
      status: params.status,
      reviewedBy: params.reviewerUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dpdp_requests/${params.requestId}`);
  }
}

export async function grantAnnualAward(params: {
  year: number;
  title: string;
  recipientUid?: string;
  recipientName: string;
  ward: string;
  points: number;
  verifiedReports: number;
  citation: string;
}): Promise<string> {
  const awardId = makeId('awd');
  try {
    await setDoc(doc(db, 'awards', awardId), {
      year: params.year,
      title: params.title.trim().slice(0, 120),
      ...(params.recipientUid ? { recipientUid: params.recipientUid } : {}),
      recipientName: params.recipientName.trim().slice(0, 120),
      ward: params.ward.slice(0, 80),
      points: params.points,
      verifiedReports: params.verifiedReports,
      citation: params.citation.trim().slice(0, 500),
      createdAt: serverTimestamp(),
    });
    return awardId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `awards/${awardId}`);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
  }
}

export async function fetchTrackByTokenOrCode(queryStr: string): Promise<PublicTrackRecord | null> {
  const cleaned = queryStr.trim();
  if (!cleaned) return null;
  try {
    if (/^[a-zA-Z0-9_\-]+$/.test(cleaned)) {
      const direct = await getDoc(doc(db, 'public_tracks', cleaned));
      if (direct.exists()) {
        return direct.data() as PublicTrackRecord;
      }
    }
    const q = query(
      collection(db, 'public_tracks'),
      where('reportCode', '==', cleaned.toUpperCase()),
      limit(1)
    );
    const snaps = await getDocs(q);
    if (!snaps.empty) {
      return snaps.docs[0].data() as PublicTrackRecord;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `public_tracks/${cleaned}`);
  }
}

// --- Real-time Subscriptions ---
export function subscribePublicTracks(cb: (items: PublicTrackRecord[]) => void): Unsubscribe {
  const q = query(collection(db, 'public_tracks'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => d.data() as PublicTrackRecord));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'public_tracks')
  );
}

export function subscribePublicLeaderboard(cb: (items: PublicProfileRecord[]) => void): Unsubscribe {
  const q = query(collection(db, 'public_profiles'), orderBy('points', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => d.data() as PublicProfileRecord));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'public_profiles')
  );
}

export function subscribeAwards(cb: (items: AwardRecord[]) => void): Unsubscribe {
  const q = query(collection(db, 'awards'), orderBy('year', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AwardRecord, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'awards')
  );
}

export function subscribeCitizenComplaints(
  uid: string,
  cb: (items: ComplaintRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'complaints'), where('citizenId', '==', uid), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ComplaintRecord, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'complaints')
  );
}

export function subscribeAllComplaints(cb: (items: ComplaintRecord[]) => void): Unsubscribe {
  const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ComplaintRecord, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'complaints')
  );
}

export function subscribeCitizenSosAlerts(
  uid: string,
  cb: (items: SosAlertRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'sos_alerts'), where('citizenId', '==', uid), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<SosAlertRecord, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'sos_alerts')
  );
}

export function subscribeAllSosAlerts(cb: (items: SosAlertRecord[]) => void): Unsubscribe {
  const q = query(collection(db, 'sos_alerts'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SosAlertRecord, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'sos_alerts')
  );
}

export function subscribeUserNotifications(
  uid: string,
  cb: (items: NotificationRecord[]) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('userId', '==', uid), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationRecord, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      cb(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
  );
}

export function subscribeAuthorityRequests(cb: (items: AuthorityRequestRecord[]) => void): Unsubscribe {
  const q = query(collection(db, 'authority_requests'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuthorityRequestRecord, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'authority_requests')
  );
}

export function subscribeDpdpRequests(cb: (items: DpdpRequestRecord[]) => void): Unsubscribe {
  const q = query(collection(db, 'dpdp_requests'), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DpdpRequestRecord, 'id'>) })));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'dpdp_requests')
  );
}
