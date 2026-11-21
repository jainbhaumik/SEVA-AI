import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// Default ElevenLabs voice IDs (premade public voices in ElevenLabs catalog)
// Sarah (EXAVITQu4vr4xnSDxMaL): warm, clear, professional, multilingual-capable
// George (JBFqnCBsd6RMkjVDRZzb): calm, authoritative, clear
const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const AUTHORITY_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const ALLOWED_VOICE_ID_RE = /^[a-zA-Z0-9]{10,40}$/;

type SupportedLang = 'en' | 'hi' | 'bn' | 'as';

const LANGUAGE_INFO: Record<
  SupportedLang,
  {
    name: string;
    nativeName: string;
    sttCode: string;
    ttsModel: string;
    ttsSupportedNote: string;
  }
> = {
  en: {
    name: 'English',
    nativeName: 'English',
    sttCode: 'en',
    ttsModel: 'eleven_flash_v2_5',
    ttsSupportedNote: 'Supported via ElevenLabs Flash v2.5 (low-latency)',
  },
  hi: {
    name: 'Hindi',
    nativeName: 'हिन्दी',
    sttCode: 'hi',
    ttsModel: 'eleven_flash_v2_5',
    ttsSupportedNote: 'Supported via ElevenLabs Flash v2.5 (low-latency)',
  },
  bn: {
    name: 'Bengali',
    nativeName: 'বাংলা',
    sttCode: 'bn',
    ttsModel: 'eleven_v3',
    ttsSupportedNote: 'Supported via ElevenLabs v3 multilingual model',
  },
  as: {
    name: 'Assamese',
    nativeName: 'অসমীয়া',
    sttCode: 'as',
    ttsModel: 'eleven_v3',
    ttsSupportedNote: 'Supported via ElevenLabs v3 multilingual model (STT via Scribe v2)',
  },
};

function getElevenLabsKey(): string | null {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key || key === 'MY_ELEVENLABS_API_KEY') return null;
  return key;
}

function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory sliding-window rate limiter for voice endpoints (40 requests per minute per IP)
const rateBucket = new Map<string, number[]>();
function voiceRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60_000;
  const maxReq = 40;
  const timestamps = (rateBucket.get(ip) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxReq) {
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many voice requests. Please wait a few seconds before trying again.',
    });
    return;
  }
  timestamps.push(now);
  rateBucket.set(ip, timestamps);
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max audio clip
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith('audio/') ||
      file.mimetype === 'video/webm' ||
      file.mimetype === 'application/octet-stream'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported audio format. Please record audio with your microphone.'));
    }
  },
});

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// Health & Voice capability status
app.get('/api/voice/status', (_req: Request, res: Response) => {
  const elevenlabsConfigured = Boolean(getElevenLabsKey());
  const geminiConfigured = Boolean(getGeminiClient());
  res.json({
    elevenlabsConfigured,
    geminiConfigured,
    defaultVoiceId: DEFAULT_VOICE_ID,
    authorityVoiceId: AUTHORITY_VOICE_ID,
    languages: Object.entries(LANGUAGE_INFO).map(([code, meta]) => ({
      code,
      ...meta,
    })),
  });
});

// List available voices from ElevenLabs (when configured)
app.get('/api/voice/voices', voiceRateLimit, async (_req: Request, res: Response) => {
  const apiKey = getElevenLabsKey();
  if (!apiKey) {
    res.status(503).json({
      error: 'ELEVENLABS_NOT_CONFIGURED',
      message:
        'ELEVENLABS_API_KEY is not configured on the server. Add it in Settings > Secrets to enable ElevenLabs voices.',
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const upstream = await fetch(`${ELEVENLABS_BASE}/voices`, {
      headers: { 'xi-api-key': apiKey },
      signal: controller.signal,
    });
    if (!upstream.ok) {
      const errText = await upstream.text();
      res.status(upstream.status).json({
        error: 'ELEVENLABS_VOICES_ERROR',
        message: `ElevenLabs returned ${upstream.status}: ${errText.slice(0, 200)}`,
      });
      return;
    }
    const data = (await upstream.json()) as {
      voices?: Array<{ voice_id: string; name: string; category?: string; labels?: Record<string, string> }>;
    };
    const voices = (data.voices || []).slice(0, 25).map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      category: v.category || 'premade',
      accent: v.labels?.accent || '',
      description: v.labels?.description || '',
    }));
    res.json({ voices });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch voices';
    res.status(502).json({ error: 'ELEVENLABS_NETWORK_ERROR', message });
  } finally {
    clearTimeout(timeout);
  }
});

// ElevenLabs Speech-to-Text (STT)
app.post(
  '/api/voice/stt',
  voiceRateLimit,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('audio')(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({
          error: 'INVALID_AUDIO',
          message: err instanceof Error ? err.message : 'Invalid audio upload.',
        });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const apiKey = getElevenLabsKey();
    if (!apiKey) {
      res.status(503).json({
        error: 'ELEVENLABS_NOT_CONFIGURED',
        message:
          'ELEVENLABS_API_KEY is not configured on the server. Add it in Settings > Secrets, or type your message using the text input.',
      });
      return;
    }

    const file = req.file;
    if (!file || !file.buffer || file.buffer.length < 400) {
      res.status(400).json({
        error: 'EMPTY_AUDIO',
        message: 'Recording was empty or too short. Please hold or speak clearly and try again.',
      });
      return;
    }

    const requestedLang = typeof req.body?.language === 'string' ? req.body.language.trim() : 'auto';
    const form = new FormData();
    const audioBlob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'audio/webm',
    });
    form.append('file', audioBlob, file.originalname || 'recording.webm');
    form.append('model_id', 'scribe_v2');
    if (requestedLang !== 'auto' && requestedLang in LANGUAGE_INFO) {
      form.append('language_code', LANGUAGE_INFO[requestedLang as SupportedLang].sttCode);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const upstream = await fetch(`${ELEVENLABS_BASE}/speech-to-text`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
        body: form,
        signal: controller.signal,
      });

      if (!upstream.ok) {
        const errBody = await upstream.text();
        res.status(upstream.status === 401 || upstream.status === 403 ? 401 : 502).json({
          error: 'ELEVENLABS_STT_ERROR',
          message:
            upstream.status === 401 || upstream.status === 403
              ? 'ElevenLabs rejected the API key. Please check ELEVENLABS_API_KEY in Settings > Secrets.'
              : `ElevenLabs transcription failed (${upstream.status}): ${errBody.slice(0, 220)}`,
        });
        return;
      }

      const payload = (await upstream.json()) as {
        text?: string;
        language_code?: string;
        language_probability?: number;
      };
      const transcript = (payload.text || '').trim();

      if (!transcript) {
        res.json({
          text: '',
          detectedLanguage: payload.language_code || requestedLang,
          emptyAudio: true,
          message:
            'No intelligible speech detected in the recording. Please reduce background noise or type your message.',
        });
        return;
      }

      res.json({
        text: transcript,
        detectedLanguage: payload.language_code || requestedLang,
        confidence: payload.language_probability ?? null,
        emptyAudio: false,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      res.status(isTimeout ? 504 : 502).json({
        error: isTimeout ? 'ELEVENLABS_TIMEOUT' : 'ELEVENLABS_NETWORK_ERROR',
        message: isTimeout
          ? 'Transcription request timed out. Please try a shorter recording or type your request.'
          : 'Could not reach ElevenLabs Speech-to-Text service.',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
);

// ElevenLabs Text-to-Speech (TTS) Streaming
app.post('/api/voice/tts', voiceRateLimit, async (req: Request, res: Response) => {
  const apiKey = getElevenLabsKey();
  if (!apiKey) {
    res.status(503).json({
      error: 'ELEVENLABS_NOT_CONFIGURED',
      message:
        'ELEVENLABS_API_KEY is not configured on the server. Add it in Settings > Secrets to hear spoken ElevenLabs responses.',
    });
    return;
  }

  const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const lang = (typeof req.body?.language === 'string' ? req.body.language.trim() : 'en') as SupportedLang;
  const requestedVoice = typeof req.body?.voiceId === 'string' ? req.body.voiceId.trim() : '';

  if (!rawText) {
    res.status(400).json({ error: 'EMPTY_TEXT', message: 'Text is required for speech synthesis.' });
    return;
  }
  if (rawText.length > 2500) {
    res.status(400).json({
      error: 'TEXT_TOO_LONG',
      message: 'Speech text exceeds the 2500 character limit per request.',
    });
    return;
  }
  if (!(lang in LANGUAGE_INFO)) {
    res.status(400).json({
      error: 'UNSUPPORTED_LANGUAGE',
      message: `Language "${lang}" is not supported. Available options: English (en), Hindi (hi), Bengali (bn), Assamese (as).`,
    });
    return;
  }

  const voiceId = ALLOWED_VOICE_ID_RE.test(requestedVoice) ? requestedVoice : DEFAULT_VOICE_ID;
  const langMeta = LANGUAGE_INFO[lang];

  const callElevenLabsTts = async (modelId: string, includeLangCode: boolean) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const bodyPayload: Record<string, unknown> = {
        text: rawText,
        model_id: modelId,
        voice_settings: {
          stability: 0.58,
          similarity_boost: 0.78,
          style: 0.15,
          use_speaker_boost: true,
        },
      };
      if (includeLangCode && modelId !== 'eleven_multilingual_v2') {
        bodyPayload.language_code = langMeta.sttCode;
      }

      return await fetch(
        `${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    let upstream = await callElevenLabsTts(langMeta.ttsModel, true);

    // If eleven_flash_v2_5 rejects language_code or model availability, retry with eleven_multilingual_v2 for en/hi only (never silently switch language!)
    if (!upstream.ok && (lang === 'en' || lang === 'hi') && langMeta.ttsModel === 'eleven_flash_v2_5') {
      upstream = await callElevenLabsTts('eleven_multilingual_v2', false);
    }

    if (!upstream.ok) {
      const errText = await upstream.text();
      const status = upstream.status;
      if (status === 401 || status === 403) {
        res.status(401).json({
          error: 'ELEVENLABS_AUTH_ERROR',
          message: 'ElevenLabs API key was rejected or lacks permission. Check ELEVENLABS_API_KEY in Settings > Secrets.',
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error: 'ELEVENLABS_QUOTA',
          message: 'ElevenLabs quota or rate limit reached. Please retry shortly or use text display.',
        });
        return;
      }
      res.status(422).json({
        error: 'TTS_MODEL_UNAVAILABLE',
        message: `ElevenLabs could not generate ${langMeta.name} speech (${status}): ${errText.slice(0, 220)}. You can read the response text or switch voice language to Hindi or English.`,
      });
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    const arrayBuffer = await upstream.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'ELEVENLABS_TIMEOUT' : 'ELEVENLABS_NETWORK_ERROR',
      message: isTimeout
        ? 'ElevenLabs speech generation timed out.'
        : 'Could not reach ElevenLabs Text-to-Speech service.',
    });
  }
});

// SEVA SAATHI AI Processing (Intent, Report Extraction, City Info Q&A, Authority Summaries)
app.post('/api/voice/assistant', voiceRateLimit, async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_NOT_CONFIGURED',
      message: 'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.',
    });
    return;
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const lang = (typeof req.body?.language === 'string' ? req.body.language.trim() : 'en') as SupportedLang;
  const mode = typeof req.body?.mode === 'string' ? req.body.mode.trim() : 'citizen_assistant';
  const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];

  if (!message || message.length > 2000) {
    res.status(400).json({ error: 'INVALID_MESSAGE', message: 'Please provide a message under 2000 characters.' });
    return;
  }

  const langMeta = LANGUAGE_INFO[lang] || LANGUAGE_INFO.en;

  const systemInstruction = `You are SEVA SAATHI ("Your Voice, Your City, Your Seva"), the official multilingual AI civic voice assistant inside the SEVA AI Smart City Civic Assistance & Public Safety Platform.

CRITICAL GROUNDING RULES:
1. Respond strictly in ${langMeta.name} (${langMeta.nativeName}) using its natural native script (English for en, Devanagari for hi, Bengali script for bn, Assamese script for as). Never silently switch to an unrelated language.
2. Keep spoken replies warm, clear, respectful, concise (2-4 sentences unless summarizing multiple authority queue items), and easy to listen to.
3. NEVER fabricate complaint IDs, tracking tokens, government policies, authority responses, or completed emergency calls.
4. Only state complaint counts, report codes, statuses, or SOS alerts that actually appear in the provided REALTIME_PLATFORM_CONTEXT JSON below. If no matching data is present, honestly state that no records were found.
5. For Women & Child Safety or Medical/Accident emergencies:
   - Never pretend an emergency call or ambulance dispatch has been completed.
   - Guide the citizen to confirm or press the manual SOS control in SEVA Shield (/citizen/shield) or Emergency Assistance (/citizen/medical, /citizen/accident).
   - Set sosAction="prompt_confirm_sos" ONLY if the citizen explicitly expresses urgent danger or asks to trigger SOS.
6. For Civic Reporting across all supported categories:
   - Supported categories:
     * roads (Roads and Potholes -> Public Works Department / PWD)
     * waste (Waste Management -> Municipal Waste & Sanitation Department / MWD)
     * drainage (Drainage and Waterlogging -> Drainage & Sewerage Board / DRB)
     * traffic (Traffic and Road Obstructions -> Traffic Police Control Room / TPCR)
     * accident (Accident Reporting -> Traffic Police & Emergency Control Room / TPCR)
     * animal_rescue (Animal Rescue -> Municipal Animal Welfare Board / AWB)
     * women_safety (Women and Child Safety -> Police Control Room / PCR)
     * medical (Medical Assistance -> Emergency Control Room / ECR)
   - Extract category, subcategory, severity (low/medium/high/critical), concise title, detailed description, ward (Ward 1 — Central through Ward 8 — Lakeside if mentioned), and locationText if mentioned.
   - List any missing essential fields (e.g., ["locationText"] or ["ward"]) in missingFields, and set readyToReview=true only when category, title, description, and locationText are all present. Always ask the citizen to review and confirm before submitting — never imply the report is already submitted!
7. Verified SEVA AI platform facts for City Information Q&A:
   - How to report issues: Open "Report an issue" (/citizen/report/new) or click "Report Using Voice", speak or fill category, location, GPS pin, optional photo (<=10MB), review details, and submit to receive a real SEVA-2026 report code & tracking link.
   - After submission: Reports start as "Submitted", move to "Under verification", "Assigned" to the routed department, "In progress", and "Resolved". Citizens earn civic reward points & badges when verified/resolved and can track via /track.
   - Animal rescue: Report under "Animal Rescue" (routed to Municipal Animal Welfare Board / AWB).
   - Emergency assistance / SEVA Shield: /citizen/shield offers hold-to-activate SOS, trusted contacts (up to 5), and optional opt-in voice emergency phrase detection; /citizen/medical and /citizen/accident route directly to the Emergency Control Room.

REALTIME_PLATFORM_CONTEXT:
${JSON.stringify(context).slice(0, 8000)}

ACTIVE_MODE: ${mode}`;

  try {
    const conversationText = [
      ...history.map((h: { role?: string; text?: string }) => `${h.role === 'assistant' ? 'SEVA SAATHI' : 'User'}: ${String(h.text || '').slice(0, 400)}`),
      `User: ${message}`,
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: conversationText,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: { type: Type.STRING, description: 'Natural spoken reply in the user requested language.' },
            intent: {
              type: Type.STRING,
              enum: ['report_issue', 'city_info', 'safety_sos', 'authority_summary', 'track_status', 'navigate', 'general'],
            },
            suggestedRoute: {
              type: Type.STRING,
              description: 'Optional route path in SEVA AI app, e.g. /citizen/report/new or /citizen/shield or empty string.',
            },
            sosAction: {
              type: Type.STRING,
              enum: ['none', 'prompt_confirm_sos', 'guide_manual_sos'],
            },
            extractedReport: {
              type: Type.OBJECT,
              properties: {
                hasReportIntent: { type: Type.BOOLEAN },
                category: {
                  type: Type.STRING,
                  enum: ['roads', 'waste', 'drainage', 'traffic', 'accident', 'animal_rescue', 'women_safety', 'medical', 'none'],
                },
                subcategory: { type: Type.STRING },
                severity: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical', 'none'] },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                ward: { type: Type.STRING },
                locationText: { type: Type.STRING },
                missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
                readyToReview: { type: Type.BOOLEAN },
              },
            },
          },
          required: ['replyText', 'intent', 'sosAction'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.extractedReport) {
      if (parsed.extractedReport.category === 'none') parsed.extractedReport.category = '';
      if (parsed.extractedReport.severity === 'none') parsed.extractedReport.severity = '';
    }
    res.json({
      replyText: parsed.replyText || 'I heard your request. Please check the screen options.',
      intent: parsed.intent || 'general',
      suggestedRoute: parsed.suggestedRoute || '',
      sosAction: parsed.sosAction || 'none',
      extractedReport: parsed.extractedReport || null,
    });
  } catch (err) {
    console.error('Gemini assistant error:', err);
    res.status(502).json({
      error: 'AI_PROCESSING_FAILED',
      message: err instanceof Error ? err.message : 'Could not process voice assistant request.',
    });
  }
});

// Serve frontend (Vite middleware in dev, static dist in production)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SEVA AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SEVA AI server:', err);
  process.exit(1);
});
