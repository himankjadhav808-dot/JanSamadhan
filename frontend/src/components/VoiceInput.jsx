/**
 * VoiceInput
 *
 * A Web Speech API microphone button that transcribes speech in real time
 * and appends the result to a text field via the `onTranscript` callback.
 *
 * Supported language codes: hi-IN (Hindi), mr-IN (Marathi), en-IN (English)
 *
 * Usage:
 *   <VoiceInput onTranscript={(text) => setDescription(prev => prev + text)} />
 */
import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader } from 'lucide-react';

const LANGUAGES = [
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'en-IN', label: 'English' },
];

// Detect browser support
const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function VoiceInput({ onTranscript, disabled = false }) {
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [interimText, setInterimText]   = useState('');
  const [error, setError]               = useState('');
  const recognitionRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  if (!SpeechRecognition) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <MicOff className="h-4 w-4 shrink-0" />
        Voice input is not supported in this browser. Try Chrome or Edge.
      </div>
    );
  }

  const startListening = () => {
    setError('');
    setInterimText('');

    const recognition = new SpeechRecognition();
    recognition.lang              = selectedLang;
    recognition.continuous        = true;
    recognition.interimResults    = true;
    recognition.maxAlternatives   = 1;
    recognitionRef.current        = recognition;

    recognition.onresult = (event) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
      if (finalChunk) {
        onTranscript?.(finalChunk + ' ');
        setInterimText('');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone in browser settings.');
      } else {
        setError(`Voice error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      // If still "listening" state, restart for continuous mode
      if (recognitionRef.current && isListening) {
        try { recognition.start(); } catch { setIsListening(false); }
      } else {
        setIsListening(false);
        setInterimText('');
      }
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      setError('Could not start voice recognition.');
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText('');
  };

  const toggle = () => {
    if (isListening) stopListening();
    else startListening();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Language selector */}
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setSelectedLang(lang.code);
                if (isListening) { stopListening(); }
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                selectedLang === lang.code
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        {/* Mic toggle button */}
        <button
          type="button"
          onClick={toggle}
          disabled={disabled}
          aria-label={isListening ? 'Stop recording' : 'Start voice input'}
          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isListening
              ? 'bg-red-500 text-white shadow-lg ring-4 ring-red-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {/* Pulsing ring when listening */}
          {isListening && (
            <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" />
          )}
          {isListening
            ? <MicOff className="relative h-4 w-4" />
            : <Mic className="h-4 w-4" />}
        </button>

        {/* Status label */}
        <span className={`text-xs font-medium ${isListening ? 'text-red-600' : 'text-slate-400'}`}>
          {isListening ? (
            <span className="flex items-center gap-1">
              <Loader className="h-3 w-3 animate-spin" />
              Listening…
            </span>
          ) : 'Click mic to speak'}
        </span>
      </div>

      {/* Live interim transcript preview */}
      {interimText && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs italic text-blue-700">
          {interimText}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
