import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_MAP, LANGUAGE_OPTIONS, SupportedLanguage } from '../lib/civicData';
import {
  askSevaSaathi,
  ExtractedVoiceReport,
  fetchVoiceStatus,
  getBestRecorderMimeType,
  synthesizeSpeechUrl,
  transcribeAudioWithElevenLabs,
  VoiceServiceStatus,
} from '../lib/voiceClient';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  language: SupportedLanguage;
  suggestedRoute?: string;
  extractedReport?: ExtractedVoiceReport | null;
  sosAction?: 'none' | 'prompt_confirm_sos' | 'guide_manual_sos';
  audioUrl?: string;
}

interface SevaSaathiPanelProps {
  mode?: 'citizen_assistant' | 'voice_report' | 'authority_briefing' | 'safety_guide';
  embedded?: boolean;
  onClose?: () => void;
  onApplyReportDraft?: (draft: ExtractedVoiceReport, transcript: string) => void;
  initialPrompt?: string;
}

export default function SevaSaathiPanel({
  mode = 'citizen_assistant',
  embedded = false,
  onClose,
  onApplyReportDraft,
  initialPrompt,
}: SevaSaathiPanelProps) {
  const {
    profile,
    isAuthority,
    language,
    setLanguage,
    complaints,
    allComplaints,
    sosAlerts,
    allSosAlerts,
  } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<VoiceServiceStatus | null>(null);
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'>('idle');
  const [playbackState, setPlaybackState] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const [muted, setMuted] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [inputText, setInputText] = useState('');
  const [editableTranscript, setEditableTranscript] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [waveformBars, setWaveformBars] = useState<number[]>(() => Array(20).fill(12));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const activeObjectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    fetchVoiceStatus()
      .then(setStatus)
      .catch(() => setStatus(null));

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((res) => {
          if (res.state === 'granted') setMicPermission('granted');
          else if (res.state === 'denied') setMicPermission('denied');
          res.onchange = () => {
            setMicPermission(
              res.state === 'granted' ? 'granted' : res.state === 'denied' ? 'denied' : 'unknown'
            );
          };
        })
        .catch(() => {});
    }
  }, []);

  const releaseAudioResources = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setWaveformBars(Array(20).fill(12));
  }, []);

  useEffect(() => {
    return () => {
      releaseAudioResources();
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
      activeObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [releaseAudioResources]);

  const platformContext = useMemo(() => {
    if (mode === 'authority_briefing' && isAuthority) {
      const pending = allComplaints.filter((c) => c.status === 'submitted' || c.status === 'under_verification');
      const resolved = allComplaints.filter((c) => c.status === 'resolved');
      const activeSos = allSosAlerts.filter((s) => s.status !== 'resolved' && s.status !== 'cancelled');
      const byCategory: Record<string, number> = {};
      allComplaints.forEach((c) => {
        byCategory[c.category] = (byCategory[c.category] || 0) + 1;
      });
      return {
        role: 'authority',
        officerName: profile?.fullName || 'Officer',
        totalComplaints: allComplaints.length,
        pendingCount: pending.length,
        resolvedCount: resolved.length,
        activeSosCount: activeSos.length,
        categoryBreakdown: byCategory,
        latestPendingComplaints: pending.slice(0, 5).map((c) => ({
          reportCode: c.reportCode,
          category: c.category,
          title: c.title,
          severity: c.severity,
          ward: c.ward,
          status: c.status,
          description: c.description.slice(0, 140),
        })),
        activeSos: activeSos.slice(0, 5).map((s) => ({
          requestCode: s.requestCode,
          type: s.type,
          ward: s.ward,
          status: s.status,
          locationText: s.locationText,
        })),
      };
    }

    return {
      role: 'citizen',
      citizenName: profile?.fullName || 'Guest Citizen',
      ward: profile?.ward || 'Not set',
      myComplaintsCount: complaints.length,
      recentComplaints: complaints.slice(0, 5).map((c) => ({
        reportCode: c.reportCode,
        category: c.category,
        title: c.title,
        status: c.status,
        ward: c.ward,
      })),
      activeSosCount: sosAlerts.filter((s) => s.status !== 'resolved' && s.status !== 'cancelled').length,
    };
  }, [mode, isAuthority, profile, complaints, allComplaints, sosAlerts, allSosAlerts]);

  const stopPlayback = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    setPlaybackState('stopped');
    setVoiceState((prev) => (prev === 'speaking' ? 'idle' : prev));
  }, []);

  const playAudioUrl = useCallback(
    async (url: string) => {
      if (muted) return;
      stopPlayback();
      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.onplay = () => {
        setPlaybackState('playing');
        setVoiceState('speaking');
      };
      audio.onpause = () => {
        if (!audio.ended && audio.currentTime > 0) {
          setPlaybackState('paused');
          setVoiceState('idle');
        }
      };
      audio.onended = () => {
        setPlaybackState('stopped');
        setVoiceState('idle');
      };
      audio.onerror = () => {
        setPlaybackState('stopped');
        setVoiceState('idle');
        setTtsWarning('Audio playback failed on this device. You can read the text response above.');
      };
      try {
        await audio.play();
      } catch {
        setPlaybackState('stopped');
        setVoiceState('idle');
      }
    },
    [muted, stopPlayback]
  );

  const togglePauseResume = () => {
    const audio = audioElRef.current;
    if (!audio) return;
    if (playbackState === 'playing') {
      audio.pause();
      setPlaybackState('paused');
    } else if (playbackState === 'paused') {
      audio.play().catch(() => {});
      setPlaybackState('playing');
    }
  };

  const handleSendQuery = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;
      setErrorBanner(null);
      setTtsWarning(null);
      setEditableTranscript('');
      setInputText('');

      const userTurn: ChatTurn = {
        id: `u_${Date.now()}`,
        role: 'user',
        text,
        language,
      };
      setTurns((prev) => [...prev, userTurn]);
      setVoiceState('thinking');

      try {
        const aiResult = await askSevaSaathi({
          message: text,
          language,
          mode,
          history: turns.slice(-6).map((t) => ({ role: t.role, text: t.text })),
          context: platformContext,
        });

        let audioUrl: string | undefined;
        if (!muted) {
          try {
            const voiceId =
              mode === 'authority_briefing' ? status?.authorityVoiceId : status?.defaultVoiceId;
            audioUrl = await synthesizeSpeechUrl({
              text: aiResult.replyText,
              language,
              voiceId,
            });
            activeObjectUrlsRef.current.push(audioUrl);
          } catch (ttsErr) {
            setTtsWarning(
              ttsErr instanceof Error
                ? ttsErr.message
                : 'ElevenLabs voice playback is unavailable; showing written response.'
            );
          }
        }

        const assistantTurn: ChatTurn = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: aiResult.replyText,
          language,
          suggestedRoute: aiResult.suggestedRoute,
          extractedReport: aiResult.extractedReport,
          sosAction: aiResult.sosAction,
          audioUrl,
        };
        setTurns((prev) => [...prev, assistantTurn]);

        if (audioUrl && !muted) {
          await playAudioUrl(audioUrl);
        } else {
          setVoiceState('idle');
        }
      } catch (err) {
        setVoiceState('idle');
        setErrorBanner(
          err instanceof Error ? err.message : 'SEVA SAATHI could not process this request.'
        );
      }
    },
    [language, mode, turns, platformContext, muted, status, playAudioUrl]
  );

  useEffect(() => {
    if (initialPrompt && turns.length === 0) {
      void handleSendQuery(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    setErrorBanner(null);
    setTtsWarning(null);
    stopPlayback();

    if (!consentAccepted) {
      setErrorBanner('Please confirm voice recording consent before using the microphone.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorBanner('Microphone recording is not supported in this browser. Please type your request below.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setMicPermission('granted');
      mediaStreamRef.current = stream;

      // Setup live waveform analyser
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const renderWave = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars: number[] = [];
        for (let i = 0; i < 20; i++) {
          const val = dataArray[i % dataArray.length] || 0;
          bars.push(Math.max(12, Math.min(100, Math.round((val / 255) * 100))));
        }
        setWaveformBars(bars);
        rafRef.current = requestAnimationFrame(renderWave);
      };
      renderWave();

      const mimeType = getBestRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        releaseAudioResources();
        if (blob.size < 400) {
          setVoiceState('idle');
          setErrorBanner('Recording was too short. Hold and speak clearly, or type your message.');
          return;
        }
        setVoiceState('transcribing');
        try {
          const stt = await transcribeAudioWithElevenLabs(blob, language);
          if (stt.emptyAudio || !stt.text) {
            setVoiceState('idle');
            setErrorBanner(
              stt.message || 'Could not detect clear speech. Please try again or type below.'
            );
            return;
          }
          setEditableTranscript(stt.text);
          setVoiceState('idle');
        } catch (err) {
          setVoiceState('idle');
          setErrorBanner(
            err instanceof Error
              ? err.message
              : 'Speech transcription failed. You can type your request below.'
          );
        }
      };

      recorder.start();
      setVoiceState('listening');
    } catch (err) {
      releaseAudioResources();
      setVoiceState('idle');
      const isDenied =
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      if (isDenied) {
        setMicPermission('denied');
        setErrorBanner(
          'Microphone access was denied. Enable microphone permission in your browser or use the text input below.'
        );
      } else {
        setErrorBanner('Could not access microphone. Please type your request below.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      releaseAudioResources();
      setVoiceState('idle');
    }
  };

  const currentLangOption =
    LANGUAGE_OPTIONS.find((l) => l.code === language) || LANGUAGE_OPTIONS[0];

  const lastAssistantTurn = [...turns].reverse().find((t) => t.role === 'assistant');

  return (
    <div
      className={`flex flex-col bg-card text-card-foreground border border-border rounded-xl shadow-md overflow-hidden ${
        embedded ? 'w-full' : 'w-full max-w-2xl max-h-[88vh]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 bg-muted/40">
        <div className="min-w-0">
          <p className="ed-meta">SEVA Voice Intelligence</p>
          <h2 className="text-lg font-bold leading-tight text-foreground">
            SEVA SAATHI
          </h2>
          <p className="text-xs text-muted-foreground">
            Your Voice, Your City, Your Seva
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="saathi-lang" className="sr-only">
            Voice Language
          </label>
          <select
            id="saathi-lang"
            value={language}
            onChange={(e) => void setLanguage(e.target.value as SupportedLanguage)}
            className="h-10 rounded-lg border border-input bg-card px-2.5 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.nativeLabel} ({opt.label})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              if (next) stopPlayback();
            }}
            aria-label={muted ? 'Unmute voice output' : 'Mute voice output'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-card text-foreground hover:bg-muted transition-colors"
            title={muted ? 'Unmute voice' : 'Mute voice'}
          >
            {muted ? <VolumeX className="h-4 w-4 text-muted-foreground" /> : <Volume2 className="h-4 w-4 text-primary" />}
          </button>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => {
                stopPlayback();
                setTurns([]);
                setEditableTranscript('');
                setErrorBanner(null);
              }}
              aria-label="Clear conversation"
              className="flex h-10 items-center gap-1.5 rounded-lg border border-input bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close SEVA SAATHI"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-input bg-card text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Status & Configuration Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-2 text-xs text-muted-foreground">
        <span>
          Mic permission:{' '}
          <strong className="text-foreground">
            {micPermission === 'granted' ? 'Granted' : micPermission === 'denied' ? 'Blocked' : 'Will request on speak'}
          </strong>
        </span>
        <span>
          ElevenLabs:{' '}
          <strong className={status?.elevenlabsConfigured ? 'text-primary' : 'text-amber-700 dark:text-amber-400'}>
            {status === null
              ? 'Checking...'
              : status.elevenlabsConfigured
              ? 'Connected'
              : 'API key missing (text mode active)'}
          </strong>
        </span>
      </div>

      {/* Missing Key / Error / TTS Limitation Notice */}
      {status && !status.elevenlabsConfigured && (
        <div className="border-b border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <strong>Configuration needed for ElevenLabs Voice:</strong> Add <code className="font-mono">ELEVENLABS_API_KEY</code> in{' '}
          <strong>Settings &gt; Secrets</strong> to activate live speech transcription and natural spoken responses. You can still type questions and voice-report drafts below.
        </div>
      )}

      {errorBanner && (
        <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="flex-1">{errorBanner}</p>
        </div>
      )}

      {ttsWarning && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p className="flex-1">{ttsWarning}</p>
        </div>
      )}

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-[220px] max-h-[360px]">
        {turns.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Speak or type in <strong>{currentLangOption.label}</strong> to report a civic issue, ask about city services, get safety guidance, or hear live updates.
            </p>
            <div className="grid gap-2">
              {currentLangOption.samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleSendQuery(prompt)}
                  className="text-left rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-secondary/40 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={`flex flex-col gap-2 ${
                turn.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  turn.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-muted/40 text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{turn.text}</p>
              </div>

              {/* Assistant Replay Audio Button */}
              {turn.role === 'assistant' && turn.audioUrl && (
                <button
                  type="button"
                  onClick={() => void playAudioUrl(turn.audioUrl!)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Listen again
                </button>
              )}

              {/* Extracted Civic Report Preview Card */}
              {turn.role === 'assistant' &&
                turn.extractedReport &&
                turn.extractedReport.hasReportIntent &&
                turn.extractedReport.category && (
                  <div className="w-full max-w-[92%] rounded-xl border border-primary/30 bg-secondary/30 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-primary">
                        Draft Report Detected ·{' '}
                        {CATEGORY_MAP[turn.extractedReport.category as keyof typeof CATEGORY_MAP]?.label ||
                          turn.extractedReport.category}
                      </span>
                      {turn.extractedReport.severity && (
                        <span className="text-xs font-medium text-muted-foreground capitalize">
                          Severity: {turn.extractedReport.severity}
                        </span>
                      )}
                    </div>
                    {turn.extractedReport.title && (
                      <p className="text-sm font-semibold text-foreground">
                        {turn.extractedReport.title}
                      </p>
                    )}
                    {turn.extractedReport.locationText && (
                      <p className="text-xs text-muted-foreground">
                        Location: {turn.extractedReport.locationText}{' '}
                        {turn.extractedReport.ward ? `· ${turn.extractedReport.ward}` : ''}
                      </p>
                    )}
                    {turn.extractedReport.missingFields?.length > 0 && (
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Still needed: {turn.extractedReport.missingFields.join(', ')}
                      </p>
                    )}
                    <div className="pt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onApplyReportDraft) {
                            onApplyReportDraft(turn.extractedReport!, turn.text);
                          } else {
                            navigate('/citizen/report/new', {
                              state: { voiceDraft: turn.extractedReport },
                            });
                            onClose?.();
                          }
                        }}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Review &amp; Populate Report Form
                      </button>
                    </div>
                  </div>
                )}

              {/* SOS Guidance Action */}
              {turn.role === 'assistant' &&
                (turn.sosAction === 'prompt_confirm_sos' || turn.sosAction === 'guide_manual_sos') && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/citizen/shield');
                      onClose?.();
                    }}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-destructive px-3.5 py-2 text-xs font-semibold text-destructive-foreground hover:opacity-90"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Open SEVA Shield SOS Control
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}

              {/* Optional Navigation Suggestion */}
              {turn.role === 'assistant' &&
                turn.suggestedRoute &&
                turn.sosAction === 'none' &&
                !turn.extractedReport?.hasReportIntent && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(turn.suggestedRoute!);
                      onClose?.();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    Open {turn.suggestedRoute}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
            </div>
          ))
        )}
      </div>

      {/* Editable Transcript Confirmation Box (before submitting to assistant) */}
      {editableTranscript && (
        <div className="border-t border-border bg-secondary/20 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              Recognized Speech — Review or Edit Before Sending
            </span>
            <button
              type="button"
              onClick={() => setEditableTranscript('')}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Discard
            </button>
          </div>
          <textarea
            rows={2}
            value={editableTranscript}
            onChange={(e) => setEditableTranscript(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSendQuery(editableTranscript)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Send className="h-3.5 w-3.5" />
              Confirm &amp; Send to SEVA SAATHI
            </button>
          </div>
        </div>
      )}

      {/* Waveform + Voice Controls + Text Fallback */}
      <div className="border-t border-border bg-card px-4 py-3.5 space-y-3">
        {/* Live Audio Waveform & State */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {voiceState === 'listening' && (
              <span className="flex h-3 w-3 rounded-full bg-destructive animate-pulse shrink-0" />
            )}
            {(voiceState === 'transcribing' || voiceState === 'thinking') && (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            )}
            {voiceState === 'speaking' && (
              <Volume2 className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="text-xs font-medium text-foreground truncate">
              {voiceState === 'listening'
                ? 'Listening... speak clearly'
                : voiceState === 'transcribing'
                ? 'Transcribing with ElevenLabs...'
                : voiceState === 'thinking'
                ? 'SEVA SAATHI is processing...'
                : voiceState === 'speaking'
                ? 'Speaking response...'
                : 'Ready for voice or text'}
            </span>
          </div>

          {/* Real-time audio bars */}
          <div className="flex items-center gap-0.5 h-6 shrink-0" aria-hidden="true">
            {waveformBars.map((heightPct, idx) => (
              <span
                key={idx}
                style={{ height: `${voiceState === 'listening' ? heightPct : voiceState === 'speaking' ? 35 + ((idx * 17) % 50) : 18}%` }}
                className={`w-1 rounded-full transition-all duration-75 ${
                  voiceState === 'listening'
                    ? 'bg-destructive'
                    : voiceState === 'speaking'
                    ? 'bg-primary'
                    : 'bg-border'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Main Touch-Friendly Voice + Audio Playback Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {voiceState === 'listening' ? (
            <button
              type="button"
              onClick={stopRecording}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 transition-opacity"
            >
              <MicOff className="h-4 w-4" />
              Stop Speaking
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startRecording()}
              disabled={voiceState === 'transcribing' || voiceState === 'thinking'}
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Mic className="h-4 w-4" />
              Start Speaking
            </button>
          )}

          {/* Audio Playback Controls */}
          {lastAssistantTurn?.audioUrl && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (playbackState === 'stopped') {
                    void playAudioUrl(lastAssistantTurn.audioUrl!);
                  } else {
                    togglePauseResume();
                  }
                }}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted"
              >
                {playbackState === 'playing' ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause
                  </>
                ) : playbackState === 'paused' ? (
                  <>
                    <Play className="h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Play
                  </>
                )}
              </button>

              {playbackState !== 'stopped' && (
                <button
                  type="button"
                  onClick={stopPlayback}
                  aria-label="Stop audio playback"
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </button>
              )}
            </div>
          )}
        </div>

        {/* Text Input Alternative */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendQuery(inputText);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Type a question or civic issue in ${currentLangOption.label}...`}
            disabled={voiceState === 'thinking' || voiceState === 'transcribing'}
            className="flex-1 min-h-[44px] rounded-lg border border-input bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || voiceState === 'thinking' || voiceState === 'transcribing'}
            aria-label="Send text message"
            className="min-h-[44px] inline-flex items-center justify-center rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        {/* Privacy Consent Toggle */}
        <label className="flex items-start gap-2 text-[11px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            className="mt-0.5 rounded border-input accent-primary"
          />
          <span>
            Voice consent: Audio is sent securely to ElevenLabs for transcription only and is never stored on SEVA AI servers.
          </span>
        </label>
      </div>
    </div>
  );
}
