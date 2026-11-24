import { useEffect, useRef, useState } from 'react';

/**
 * useVoiceToText — Browser-native SpeechRecognition hook.
 * @param {string} lang - BCP-47 language tag, e.g. 'hi-IN', 'mr-IN', 'en-US'. Defaults to 'hi-IN'.
 * @returns {{ isListening: boolean, transcript: string, start: Function, stop: Function, supported: boolean }}
 */
export default function useVoiceToText(lang = 'hi-IN') {
  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const supported = Boolean(SpeechRecognition);

  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Rebuild recognition whenever lang changes
  useEffect(() => {
    if (!supported) return;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      // Only iterate results starting from event.resultIndex to avoid re-processing
      // previously seen results. Only emit a state update for final results so that
      // each setTranscript call carries exactly one new confirmed phrase.
      let newFinalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newFinalText += event.results[i][0].transcript;
        }
      }
      if (newFinalText) {
        setTranscript(newFinalText);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      // Cleanup: stop any active recognition session when lang changes or component unmounts
      try {
        recognition.stop();
      } catch (_) {
        // ignore if not started
      }
    };
  }, [lang, supported]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    if (!supported || !recognitionRef.current) return;
    setTranscript('');
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (_) {
      // already started — ignore
    }
  };

  const stop = () => {
    if (!supported || !recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  };

  return { isListening, transcript, start, stop, supported };
}
