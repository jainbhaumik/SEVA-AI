export type CivicCategoryKey =
  | 'roads'
  | 'waste'
  | 'drainage'
  | 'traffic'
  | 'accident'
  | 'animal_rescue'
  | 'women_safety'
  | 'medical';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type ComplaintStatus =
  | 'submitted'
  | 'under_verification'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'rejected';

export type SosType = 'women_safety' | 'medical' | 'accident';

export type SosStatus =
  | 'received'
  | 'authority_notified'
  | 'acknowledged'
  | 'unit_assigned'
  | 'on_the_way'
  | 'resolved'
  | 'cancelled';

export type SupportedLanguage = 'en' | 'hi' | 'bn' | 'as';

export type UserTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CivicCategoryInfo {
  value: CivicCategoryKey;
  label: string;
  short: string;
  description: string;
  department: string;
  departmentCode: 'PWD' | 'MWD' | 'DRB' | 'TPCR' | 'ECR' | 'PCR' | 'AWB';
  subcategories: string[];
  emergency: boolean;
  slaHours: number;
}

export const CIVIC_CATEGORIES: CivicCategoryInfo[] = [
  {
    value: 'roads',
    label: 'Potholes and Road Damage',
    short: 'Roads',
    description: 'Potholes, damaged roads, broken footpaths and dangerous surfaces.',
    department: 'Public Works Department',
    departmentCode: 'PWD',
    subcategories: ['Pothole', 'Damaged road', 'Broken footpath', 'Dangerous road surface'],
    emergency: false,
    slaHours: 48,
  },
  {
    value: 'waste',
    label: 'Waste Management',
    short: 'Waste',
    description: 'Garbage accumulation, overflowing dustbins and illegal dumping.',
    department: 'Municipal Waste & Sanitation Department',
    departmentCode: 'MWD',
    subcategories: ['Garbage accumulation', 'Overflowing dustbin', 'Illegal dumping', 'Uncollected garbage'],
    emergency: false,
    slaHours: 24,
  },
  {
    value: 'drainage',
    label: 'Blocked Drains & Waterlogging',
    short: 'Drainage',
    description: 'Blocked drains, sewage overflow and waterlogged streets.',
    department: 'Drainage & Sewerage Board',
    departmentCode: 'DRB',
    subcategories: ['Blocked drain', 'Sewage overflow', 'Waterlogging', 'Damaged drainage system'],
    emergency: false,
    slaHours: 24,
  },
  {
    value: 'traffic',
    label: 'Traffic and Road Obstructions',
    short: 'Traffic',
    description: 'Congestion, illegal parking, fallen trees and road blockages.',
    department: 'Traffic Police Control Room',
    departmentCode: 'TPCR',
    subcategories: ['Traffic congestion', 'Illegal parking', 'Road blockage', 'Broken traffic signal'],
    emergency: false,
    slaHours: 6,
  },
  {
    value: 'accident',
    label: 'Accident Reporting',
    short: 'Accident',
    description: 'Road crashes, vehicle collisions, highway hazards and urgent rescue.',
    department: 'Traffic Police Control Room',
    departmentCode: 'TPCR',
    subcategories: ['Vehicle collision', 'Pedestrian injury', 'Hit and run', 'Road hazard after crash'],
    emergency: true,
    slaHours: 1,
  },
  {
    value: 'animal_rescue',
    label: 'Animal Rescue',
    short: 'Animal Rescue',
    description: 'Injured stray animals, trapped wildlife, distressed cattle or emergency vet aid.',
    department: 'Municipal Animal Welfare Board',
    departmentCode: 'AWB',
    subcategories: ['Injured stray animal', 'Trapped animal', 'Aggressive/rabid animal risk', 'Abandoned distressed pet'],
    emergency: false,
    slaHours: 4,
  },
  {
    value: 'women_safety',
    label: 'Women and Child Safety',
    short: 'Safety',
    description: 'Harassment, unsafe public locations, poor street lighting and suspicious activity.',
    department: 'Police Control Room',
    departmentCode: 'PCR',
    subcategories: ['Harassment', 'Unsafe public location', 'Suspicious activity', 'Emergency assistance'],
    emergency: true,
    slaHours: 1,
  },
  {
    value: 'medical',
    label: 'Medical Assistance',
    short: 'Medical',
    description: 'Medical emergencies, injured persons and ambulance assistance.',
    department: 'Emergency Control Room',
    departmentCode: 'ECR',
    subcategories: ['Medical emergency', 'Injured person', 'Ambulance assistance', 'Urgent medical support'],
    emergency: true,
    slaHours: 1,
  },
];

export const CATEGORY_MAP: Record<CivicCategoryKey, CivicCategoryInfo> = CIVIC_CATEGORIES.reduce(
  (acc, item) => ({ ...acc, [item.value]: item }),
  {} as Record<CivicCategoryKey, CivicCategoryInfo>
);

export const SEVERITY_OPTIONS: Array<{ value: SeverityLevel; label: string; hint: string }> = [
  { value: 'low', label: 'Low', hint: 'No immediate danger, routine repair.' },
  { value: 'medium', label: 'Medium', hint: 'Affects daily movement or hygiene.' },
  { value: 'high', label: 'High', hint: 'Risk of injury or significant disruption.' },
  { value: 'critical', label: 'Critical', hint: 'Immediate danger to life or safety.' },
];

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  submitted: 'Submitted',
  under_verification: 'Under verification',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};

export const SOS_STATUS_LABELS: Record<SosStatus, string> = {
  received: 'Received',
  authority_notified: 'Authority notified',
  acknowledged: 'Acknowledged',
  unit_assigned: 'Unit assigned',
  on_the_way: 'On the way',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};

export const WARDS: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'Ward 1 — Central', lat: 26.1844, lng: 91.7458 },
  { name: 'Ward 2 — North', lat: 26.1965, lng: 91.7512 },
  { name: 'Ward 3 — South', lat: 26.1695, lng: 91.7421 },
  { name: 'Ward 4 — East', lat: 26.1831, lng: 91.7715 },
  { name: 'Ward 5 — West', lat: 26.1812, lng: 91.7204 },
  { name: 'Ward 6 — Industrial', lat: 26.1621, lng: 91.7689 },
  { name: 'Ward 7 — Old City', lat: 26.1889, lng: 91.7345 },
  { name: 'Ward 8 — Lakeside', lat: 26.1914, lng: 91.7623 },
];

export const DEPARTMENTS = [
  {
    code: 'PWD',
    name: 'Public Works Department',
    categories: ['roads'],
    slaHours: 48,
    helpline: '1800-345-3611',
  },
  {
    code: 'MWD',
    name: 'Municipal Waste & Sanitation Department',
    categories: ['waste'],
    slaHours: 24,
    helpline: '1800-345-3622',
  },
  {
    code: 'DRB',
    name: 'Drainage & Sewerage Board',
    categories: ['drainage'],
    slaHours: 24,
    helpline: '1800-345-3633',
  },
  {
    code: 'TPCR',
    name: 'Traffic Police Control Room',
    categories: ['traffic', 'accident'],
    slaHours: 6,
    helpline: '103',
  },
  {
    code: 'AWB',
    name: 'Municipal Animal Welfare Board',
    categories: ['animal_rescue'],
    slaHours: 4,
    helpline: '1962',
  },
  {
    code: 'PCR',
    name: 'Police Control Room',
    categories: ['women_safety'],
    slaHours: 1,
    helpline: '100 / 1091',
  },
  {
    code: 'ECR',
    name: 'Emergency Control Room',
    categories: ['medical'],
    slaHours: 1,
    helpline: '108 / 112',
  },
] as const;

export const LANGUAGE_OPTIONS: Array<{
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
  speechLocale: string;
  samplePrompts: string[];
}> = [
  {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    speechLocale: 'en-IN',
    samplePrompts: [
      'There is a large pothole near Central Market causing problems for vehicles.',
      'How can I report a blocked drain?',
      'What happens after I submit a complaint?',
    ],
  },
  {
    code: 'hi',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    speechLocale: 'hi-IN',
    samplePrompts: [
      'मेरी गली के पास एक बड़ा गड्ढा है जिससे वाहनों को परेशानी हो रही है।',
      'मैं बंद नाले की शिकायत कैसे दर्ज करूं?',
      'आपातकालीन सहायता सुविधा का उपयोग कैसे करें?',
    ],
  },
  {
    code: 'bn',
    label: 'Bengali',
    nativeLabel: 'বাংলা',
    speechLocale: 'bn-IN',
    samplePrompts: [
      'আমার রাস্তার পাশে আবর্জনা জমে আছে, পরিষ্কার করা দরকার।',
      'পশু উদ্ধারের জন্য আমি কীভাবে অনুরোধ করব?',
      'অভিযোগ জমা দেওয়ার পর কী হয়?',
    ],
  },
  {
    code: 'as',
    label: 'Assamese',
    nativeLabel: 'অসমীয়া',
    speechLocale: 'as-IN',
    samplePrompts: [
      'আমাৰ অঞ্চলত নলা বন্ধ হৈ পানী জমা হৈছে।',
      'পথৰ গাঁতৰ অভিযোগ কেনেকৈ দাখিল কৰিম?',
      'জৰুৰীকালীন সহায় কেনেকৈ পাম?',
    ],
  },
];

export const EMERGENCY_PHRASES: Record<SupportedLanguage, string[]> = {
  en: ['help me', 'help me seva', 'seva sos', 'emergency help'],
  hi: ['seva madad karo', 'madad karo', 'सेवा मदद करो', 'मदद करो', 'बचाओ'],
  bn: ['amake sahajjo koro', 'আমাকে সাহায্য করো', 'সাহায্য করো', 'সেবা সাহায্য'],
  as: ['mok xohay kora', 'মোক সহায় কৰা', 'সহায় কৰা', 'সেৱা সহায়'],
};

export const TIER_THRESHOLDS: Array<{ tier: UserTier; label: string; minPoints: number }> = [
  { tier: 'bronze', label: 'Bronze Citizen', minPoints: 0 },
  { tier: 'silver', label: 'Silver Citizen', minPoints: 100 },
  { tier: 'gold', label: 'Gold Citizen', minPoints: 300 },
  { tier: 'platinum', label: 'Platinum Guardian', minPoints: 600 },
];

export const BADGE_DEFINITIONS: Record<string, { label: string; description: string }> = {
  first_report: { label: 'First Report', description: 'Submitted your first civic report.' },
  voice_pioneer: { label: 'Voice Pioneer', description: 'Filed a civic report using SEVA SAATHI voice.' },
  first_medical: { label: 'First Medical Assistance', description: 'Assisted a citizen via medical emergency reporting.' },
  consistent_reporter: { label: 'Consistent Reporter', description: 'Submitted 5 or more verified civic reports.' },
  safety_hero: { label: 'Safety Hero', description: 'Contributed to public or women & child safety.' },
};

export interface PublicFacility {
  id: string;
  name: string;
  type: 'hospital' | 'police' | 'municipal' | 'animal_clinic';
  ward: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  open24x7: boolean;
}

export const PUBLIC_FACILITIES: PublicFacility[] = [
  {
    id: 'fac-hosp-1',
    name: 'City Civil Hospital & Trauma Centre',
    type: 'hospital',
    ward: 'Ward 1 — Central',
    address: 'Panbazar Station Road, Central Ward',
    phone: '108 / 0361-2540123',
    lat: 26.1862,
    lng: 91.7441,
    open24x7: true,
  },
  {
    id: 'fac-pol-1',
    name: 'Central Police Control Room & Women Desk',
    type: 'police',
    ward: 'Ward 1 — Central',
    address: 'Kachari Road, Central District',
    phone: '100 / 1091',
    lat: 26.1848,
    lng: 91.7485,
    open24x7: true,
  },
  {
    id: 'fac-hosp-2',
    name: 'North Medical Emergency Clinic',
    type: 'hospital',
    ward: 'Ward 2 — North',
    address: 'Riverside Avenue, North Sector',
    phone: '108 / 0361-2601190',
    lat: 26.1972,
    lng: 91.7534,
    open24x7: true,
  },
  {
    id: 'fac-pol-2',
    name: 'East Traffic & Patrol Outpost',
    type: 'police',
    ward: 'Ward 4 — East',
    address: 'GS Arterial Junction, East Ward',
    phone: '103 / 112',
    lat: 26.1822,
    lng: 91.7701,
    open24x7: true,
  },
  {
    id: 'fac-mun-1',
    name: 'Municipal Civic Operations Hub',
    type: 'municipal',
    ward: 'Ward 3 — South',
    address: 'Civic Plaza, South Ward',
    phone: '1800-345-3611',
    lat: 26.1704,
    lng: 91.7438,
    open24x7: false,
  },
  {
    id: 'fac-ani-1',
    name: 'Municipal Animal Rescue & Vet Care Unit',
    type: 'animal_clinic',
    ward: 'Ward 8 — Lakeside',
    address: 'Lakeside Green Belt Road',
    phone: '1962',
    lat: 26.1908,
    lng: 91.7611,
    open24x7: true,
  },
];

export function computeTier(points: number): UserTier {
  if (points >= 600) return 'platinum';
  if (points >= 300) return 'gold';
  if (points >= 100) return 'silver';
  return 'bronze';
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
