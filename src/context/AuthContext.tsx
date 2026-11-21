import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { SupportedLanguage } from '../lib/civicData';
import {
  ComplaintRecord,
  ensureUserProfile,
  NotificationRecord,
  SosAlertRecord,
  subscribeAllComplaints,
  subscribeAllSosAlerts,
  subscribeCitizenComplaints,
  subscribeCitizenSosAlerts,
  subscribePublicTracks,
  subscribeUserNotifications,
  PublicTrackRecord,
  updateUserProfileSettings,
  UserProfileRecord,
} from '../lib/firestoreService';

interface AuthContextValue {
  user: User | null;
  profile: UserProfileRecord | null;
  loading: boolean;
  authError: string | null;
  isAdmin: boolean;
  isAuthority: boolean;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  signInWithGoogle: () => Promise<UserProfileRecord | null>;
  signOut: () => Promise<void>;
  complaints: ComplaintRecord[];
  allComplaints: ComplaintRecord[];
  sosAlerts: SosAlertRecord[];
  allSosAlerts: SosAlertRecord[];
  publicTracks: PublicTrackRecord[];
  notifications: NotificationRecord[];
  unreadCount: number;
  darkMode: boolean;
  toggleDarkMode: () => void;
  saathiOpen: boolean;
  setSaathiOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [darkMode, setDarkMode] = useState(false);
  const [saathiOpen, setSaathiOpen] = useState(false);

  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [allComplaints, setAllComplaints] = useState<ComplaintRecord[]>([]);
  const [sosAlerts, setSosAlerts] = useState<SosAlertRecord[]>([]);
  const [allSosAlerts, setAllSosAlerts] = useState<SosAlertRecord[]>([]);
  const [publicTracks, setPublicTracks] = useState<PublicTrackRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  useEffect(() => {
    const unsubTracks = subscribePublicTracks(setPublicTracks);
    return () => unsubTracks();
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthError(null);
      if (!nextUser) {
        setProfile(null);
        setComplaints([]);
        setAllComplaints([]);
        setSosAlerts([]);
        setAllSosAlerts([]);
        setNotifications([]);
        setLoading(false);
        return;
      }

      try {
        const ensured = await ensureUserProfile(nextUser);
        setProfile(ensured);
        if (ensured.language) {
          setLanguageState(ensured.language);
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Could not load user profile.');
      } finally {
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  // Subscribe to profile updates
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfileRecord;
          setProfile(data);
          if (data.language) setLanguageState(data.language);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
    );
    return () => unsub();
  }, [user]);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    if (user.emailVerified && user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
      return true;
    }
    return profile?.role === 'admin';
  }, [user, profile]);

  const isAuthority = useMemo(() => {
    return isAdmin || profile?.role === 'authority';
  }, [isAdmin, profile]);

  // Subscribe to user-scoped collections once authenticated
  useEffect(() => {
    if (!user) return;
    const u1 = subscribeCitizenComplaints(user.uid, setComplaints);
    const u2 = subscribeCitizenSosAlerts(user.uid, setSosAlerts);
    const u3 = subscribeUserNotifications(user.uid, setNotifications);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [user]);

  // Subscribe to authority-wide queues only if user holds authority/admin role
  useEffect(() => {
    if (!user || !isAuthority) {
      setAllComplaints([]);
      setAllSosAlerts([]);
      return;
    }
    const u1 = subscribeAllComplaints(setAllComplaints);
    const u2 = subscribeAllSosAlerts(setAllSosAlerts);
    return () => {
      u1();
      u2();
    };
  }, [user, isAuthority]);

  const setLanguage = async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    if (user) {
      await updateUserProfileSettings(user.uid, { language: lang });
    }
  };

  const signInWithGoogle = async (): Promise<UserProfileRecord | null> => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const ensured = await ensureUserProfile(result.user);
      setProfile(ensured);
      return ensured;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    authError,
    isAdmin,
    isAuthority,
    language,
    setLanguage,
    signInWithGoogle,
    signOut,
    complaints,
    allComplaints,
    sosAlerts,
    allSosAlerts,
    publicTracks,
    notifications,
    unreadCount,
    darkMode,
    toggleDarkMode,
    saathiOpen,
    setSaathiOpen,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
