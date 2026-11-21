/**
 * Payload-First Security TDD Spec Verification for SEVA AI Firestore Rules.
 * Run against Firebase Rules Emulator if installed, or validate invariants structurally.
 */
export const dirtyDozenPayloads = [
  { name: 'Self-Role Escalation', path: '/users/u1', op: 'create', payload: { uid: 'u1', role: 'admin' }, expected: 'PERMISSION_DENIED' },
  { name: 'Shadow Field Injection', path: '/complaints/c1', op: 'create', payload: { citizenId: 'u1', isVerified: true }, expected: 'PERMISSION_DENIED' },
  { name: 'Identity Spoofing', path: '/complaints/c1', op: 'create', payload: { citizenId: 'other_user' }, expected: 'PERMISSION_DENIED' },
  { name: 'Timestamp Forgery', path: '/complaints/c1', op: 'create', payload: { createdAt: '2020-01-01T00:00:00Z' }, expected: 'PERMISSION_DENIED' },
  { name: 'Status Shortcutting', path: '/complaints/c1', op: 'create', payload: { status: 'resolved' }, expected: 'PERMISSION_DENIED' },
  { name: 'ID Poisoning', path: `/complaints/${'x'.repeat(300)}`, op: 'create', payload: {}, expected: 'PERMISSION_DENIED' },
  { name: 'PII Leak Read', path: '/users/u2', op: 'get', authUid: 'u1', expected: 'PERMISSION_DENIED' },
  { name: 'Blanket List Scraping', path: '/complaints', op: 'list', authUid: 'u1', expected: 'PERMISSION_DENIED' },
  { name: 'SOS Impersonation', path: '/sos_alerts/s1', op: 'create', payload: { citizenId: 'u2' }, expected: 'PERMISSION_DENIED' },
  { name: 'Unauthenticated Write', path: '/public_tracks/t1', op: 'create', authUid: null, expected: 'PERMISSION_DENIED' },
  { name: 'Value Poisoning', path: '/users/u1', op: 'update', payload: { points: 99999 }, expected: 'PERMISSION_DENIED' },
  { name: 'Email Spoofing', path: '/complaints', op: 'list', authEmail: 'bhaumikjain2506@gmail.com', emailVerified: false, expected: 'PERMISSION_DENIED' },
];
