import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  Building2,
  Car,
  ClipboardList,
  FilePlus2,
  HeartPulse,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Menu,
  Mic,
  Moon,
  Radio,
  Shield,
  ShieldAlert,
  Sun,
  Trophy,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LANGUAGE_OPTIONS, SupportedLanguage } from '../lib/civicData';
import SevaSaathiPanel from './SevaSaathiPanel';

const CITIZEN_NAV = [
  { to: '/citizen', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/citizen/report/new', label: 'Report an issue', icon: FilePlus2 },
  { to: '/citizen/reports', label: 'My reports', icon: ClipboardList },
  { to: '/citizen/shield', label: 'Seva Shield', icon: Shield },
  { to: '/citizen/medical', label: 'Medical assistance', icon: HeartPulse },
  { to: '/citizen/accident', label: 'Accident assistance', icon: Car },
  { to: '/citizen/nearby', label: 'Nearby services', icon: MapPin },
  { to: '/citizen/heatmap', label: 'Safety heatmap', icon: Activity },
  { to: '/citizen/rewards', label: 'Rewards', icon: Award },
  { to: '/citizen/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/citizen/notifications', label: 'Notifications', icon: Bell },
  { to: '/citizen/profile', label: 'Profile', icon: User },
];

const AUTHORITY_NAV = [
  { to: '/authority', label: 'Operations', icon: LayoutDashboard, end: true },
  { to: '/authority/reports', label: 'Report queue', icon: ClipboardList },
  { to: '/authority/emergency', label: 'Emergency centre', icon: Radio },
  { to: '/authority/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/authority/departments', label: 'Departments', icon: Building2 },
  { to: '/authority/authorities', label: 'Officer approvals', icon: UserCheck },
  { to: '/authority/awards', label: 'Annual award', icon: Trophy },
  { to: '/authority/privacy', label: 'Privacy & DPDP', icon: Lock },
];

export default function PortalLayout({
  portal,
  children,
}: {
  portal: 'citizen' | 'authority';
  children: React.ReactNode;
}) {
  const {
    profile,
    isAuthority,
    signOut,
    language,
    setLanguage,
    unreadCount,
    darkMode,
    toggleDarkMode,
    saathiOpen,
    setSaathiOpen,
  } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = portal === 'authority' ? AUTHORITY_NAV : CITIZEN_NAV;
  const initials = (profile?.fullName || 'Citizen')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sidebarContent = (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
        <Link to="/" className="font-serif text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
          SEVA AI
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-muted"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {isAuthority && (
        <div className="border-b border-border p-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                navigate('/citizen');
                setMobileNavOpen(false);
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                portal === 'citizen'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Citizen
            </button>
            <button
              type="button"
              onClick={() => {
                navigate('/authority');
                setMobileNavOpen(false);
              }}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                portal === 'authority'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Authority
            </button>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isNotif = item.to === '/citizen/notifications';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex min-h-[42px] items-center justify-between gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-secondary text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {isNotif && unreadCount > 0 && (
                <span className="font-mono-tabular text-xs font-semibold text-primary">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {profile?.fullName || 'Citizen'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {portal === 'authority' ? profile?.designation || 'Control Room' : profile?.ward || 'Citizen'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void signOut().then(() => navigate('/'));
          }}
          className="flex w-full min-h-[40px] items-center gap-2 rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-card"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-muted-foreground truncate">
              {portal === 'authority' ? 'Authority Portal' : 'Citizen Portal'} ·{' '}
              <span className="text-foreground font-semibold">
                {navItems.find((n) => n.to === location.pathname)?.label || 'Overview'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label="Platform language"
              value={language}
              onChange={(e) => void setLanguage(e.target.value as SupportedLanguage)}
              className="h-10 rounded-lg border border-input bg-card px-2.5 text-xs font-medium text-foreground"
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeLabel}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Toggle color theme"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-card text-foreground hover:bg-muted"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => setSaathiOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">SEVA SAATHI</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>

      {/* SEVA SAATHI Modal Overlay */}
      {saathiOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="SEVA SAATHI Voice Assistant"
        >
          <SevaSaathiPanel
            mode={portal === 'authority' ? 'authority_briefing' : 'citizen_assistant'}
            onClose={() => setSaathiOpen(false)}
          />
        </div>
      )}

      {/* Quick SOS Shortcut for Citizen Mobile/Desktop Accessibility */}
      {portal === 'citizen' && location.pathname !== '/citizen/shield' && (
        <Link
          to="/citizen/shield"
          className="fixed bottom-4 right-4 z-40 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground shadow-md hover:opacity-90 transition-opacity"
        >
          <ShieldAlert className="h-4 w-4" />
          SOS Shield
        </Link>
      )}
    </div>
  );
}
