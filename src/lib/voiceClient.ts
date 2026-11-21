import { CivicCategoryKey, SeverityLevel, SupportedLanguage } from './civicData';

export interface VoiceServiceStatus {
  elevenlabsConfigured: boolean;
  geminiConfigured: boolean;
  defaultVoiceId: string;
  authorityVoiceId: string;
  languages: Array<{
    code: SupportedLanguage;
    name: string;
    nativeName: string;
    sttCode: string;
    ttsModel: string;
    ttsSupportedNote: string;
  }>;
}

export interface ExtractedVoiceReport {
  hasReportIntent: boolean;
  category: CivicCategoryKey | '';
  subcategory: string;
  severity: SeverityLevel | '';
  title: string;
  description: string;
  ward: string;
  locationText: string;
  missingFields: string[];
  readyToReview: boolean;
}

export interface AssistantResponse {
  replyText: string;
  intent:
    | 'report_issue'
    | 'city_info'
    | 'safety_sos'
    | 'authority_summary'
    | 'track_status'
    | 'navigate'
    | 'general';
  suggestedRoute: string;
  sosAction: 'none' | 'prompt_confirm_sos' | 'guide_manual_sos';
  extractedReport: ExtractedVoiceReport | null;
}

export interface SttResult {
  text: string;
  detectedLanguage?: string;
  confidence?: number | null;
  emptyAudio?: boolean;
  message?: string;
}

export async function fetchVoiceStatus(): Promise<VoiceServiceStatus> {
  const res = await fetch('/api/voice/status');
  if (!res.ok) {
    throw new Error('Could not check SEVA SAATHI voice service status.');
  }
  return res.json();
}

export async function transcribeAudioWithElevenLabs(
  audioBlob: Blob,
  language: SupportedLanguage | 'auto'
): Promise<SttResult> {
  const formData = new FormData();
  const ext = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
  formData.append('audio', audioBlob, `seva_voice.${ext}`);
  formData.append('language', language);

  const res = await fetch('/api/voice/stt', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'ElevenLabs transcription failed.');
  }
  return data;
}

export async function askSevaSaathi(params: {
  message: string;
  language: SupportedLanguage;
  mode: 'citizen_assistant' | 'voice_report' | 'authority_briefing' | 'safety_guide';
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  context: Record<string, unknown>;
}): Promise<AssistantResponse> {
  const res = await fetch('/api/voice/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'SEVA SAATHI could not process your request.');
  }
  return data;
}

export async function synthesizeSpeechUrl(params: {
  text: string;
  language: SupportedLanguage;
  voiceId?: string;
}): Promise<string> {
  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    let errMsg = 'ElevenLabs speech generation failed.';
    try {
      const errJson = await res.json();
      errMsg = errJson.message || errMsg;
    } catch {
      // ignore non-json
    }
    throw new Error(errMsg);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export function getBestRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}
