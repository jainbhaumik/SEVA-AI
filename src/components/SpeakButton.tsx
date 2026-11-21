import React, { useState } from 'react';
import { Loader2, Square, Volume2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { synthesizeSpeechUrl } from '../lib/voiceClient';

interface SpeakButtonProps {
  text: string;
  label?: string;
  voiceId?: string;
  className?: string;
}

export default function SpeakButton({
  text,
  label = 'Listen',
  voiceId,
  className = '',
}: SpeakButtonProps) {
  const { language } = useAuth();
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const handleToggle = async () => {
    setError(null);
    if (state === 'playing' && audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
      setState('idle');
      return;
    }

    setState('loading');
    try {
      const url = await synthesizeSpeechUrl({ text, language, voiceId });
      const audio = new Audio(url);
      setAudioEl(audio);
      audio.onended = () => {
        setState('idle');
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setState('idle');
        setError('Playback failed');
        URL.revokeObjectURL(url);
      };
      await audio.play();
      setState('playing');
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Voice unavailable');
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={state === 'loading' || !text.trim()}
        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 ${className}`}
      >
        {state === 'loading' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : state === 'playing' ? (
          <Square className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <Volume2 className="h-3.5 w-3.5 text-primary" />
        )}
        <span>{state === 'loading' ? 'Generating...' : state === 'playing' ? 'Stop' : label}</span>
      </button>
      {error && <span className="text-[11px] text-destructive max-w-xs">{error}</span>}
    </div>
  );
}
