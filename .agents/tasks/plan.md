# Implementation Plan — JanSamadhan Authority Button Hide + Voice Input + SLA Worker

> **Pre-read summary:** Three independent changes, sequenced by dependency (FEAT-001 and FEAT-002 are frontend-only and independent of each other; FEAT-003 is backend-only and independent of both).

---

## FEAT-001 — Hide Report Issue button/CTA for authority roles

### What

Two UI surfaces show the `+ Report Issue` button to every logged-in user without checking role:

1. **Navbar.jsx** — renders `<Link to="/report">` inside `{user && (...)}` only.
2. **Sidebar.jsx** — the "Did You Know?" CTA card at the bottom navigates to `/report` for all users.

`MyReports.jsx` already guards with `isCitizen` — **no change needed there.**

---

- [ ] 1. Guard the Report Issue Link in Navbar.jsx.
      **Files:** `frontend/src/components/layout/Navbar.jsx`

      After `const { user } = useAuth();` (line 14), add:
      ```js
      const isAuthority = user?.role === 'sub-admin' || user?.role === 'super-admin';
      ```
      Then change line 113 from:
      ```jsx
      {user && (
        <Link to="/report" ...>
      ```
      to:
      ```jsx
      {user && !isAuthority && (
        <Link to="/report" ...>
      ```
      No other changes to this file.

      **Verify:** `cd frontend && npm run build` — 0 errors.

- [ ] 2. Guard the "Did You Know?" CTA card in Sidebar.jsx.
      **Files:** `frontend/src/components/layout/Sidebar.jsx`

      `isAuthority` is already declared at line 43. Find the bottom pinned card `<div>` block
      (the one with `onClick={() => { onClose(); navigate('/report'); }}`).
      Wrap the *entire outer `<div>`* with:
      ```jsx
      {!isAuthority && (
        <div onClick={...} ...>
          ...
        </div>
      )}
      ```
      Do **not** re-declare `isAuthority`.

      **Verify:** `cd frontend && npm run build` — 0 errors.

---

## FEAT-002 — Voice-to-text hook + ReportIssue integration

### What

Create `frontend/src/hooks/useVoiceToText.js` (does not exist yet) and add a mic button + language selector to the description textarea in `ReportIssue.jsx`. No new npm packages — uses browser-native `SpeechRecognition`.

---

- [ ] 3. Create the `useVoiceToText` hook.
      **Files:** `frontend/src/hooks/useVoiceToText.js` *(create new)*

      ```js
      import { useRef, useState, useEffect } from 'react';

      export default function useVoiceToText(lang = 'hi-IN') {
        const recognitionRef = useRef(null);
        const [isListening, setIsListening]   = useState(false);
        const [transcript,  setTranscript]    = useState('');
        const supported = typeof window !== 'undefined' &&
          !!(window.SpeechRecognition || window.webkitSpeechRecognition);

        useEffect(() => {
          return () => {
            recognitionRef.current?.stop();
          };
        }, []);

        const start = () => {
          if (!supported) return;
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          const rec = new SR();
          rec.lang           = lang;
          rec.interimResults = true;
          rec.continuous     = true;

          setTranscript('');   // clear previous transcript before each session

          rec.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              interim += event.results[i][0].transcript;
            }
            setTranscript(interim);
          };

          rec.onend  = () => setIsListening(false);
          rec.onerror = () => setIsListening(false);

          recognitionRef.current = rec;
          rec.start();
          setIsListening(true);
        };

        const stop = () => {
          recognitionRef.current?.stop();
          setIsListening(false);
        };

        return { isListening, transcript, start, stop, supported };
      }
      ```

      **Verify:** `node --check frontend/src/hooks/useVoiceToText.js` — syntax OK. Then `cd frontend && npm run build` — 0 errors.

- [ ] 4. Integrate the mic button and language selector into ReportIssue.jsx.
      **Files:** `frontend/src/pages/Citizen/ReportIssue.jsx`

      a) Add `Mic`, `MicOff` to the existing lucide-react import (add to the destructured list).
      b) Add the hook import: `import useVoiceToText from '../../hooks/useVoiceToText';`
      c) Inside the component, add state: `const [voiceLang, setVoiceLang] = useState('hi-IN');`
      d) Call the hook: `const { isListening, transcript, start: startVoice, stop: stopVoice, supported: voiceSupported } = useVoiceToText(voiceLang);`
      e) Add a `useEffect` that **appends** (not replaces) transcript to description:
         ```jsx
         useEffect(() => {
           if (!transcript) return;
           setFormData(prev => ({
             ...prev,
             description: prev.description
               ? prev.description + ' ' + transcript
               : transcript,
           }));
         }, [transcript]);
         ```
      f) Directly after the `</textarea>` closing tag in the description block, insert:
         ```jsx
         {voiceSupported && (
           <div className="mt-2 flex items-center gap-2">
             <select
               value={voiceLang}
               onChange={(e) => setVoiceLang(e.target.value)}
               className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:outline-none"
               aria-label="Voice input language"
             >
               <option value="hi-IN">हिन्दी (hi-IN)</option>
               <option value="mr-IN">मराठी (mr-IN)</option>
               <option value="en-US">English (en-US)</option>
             </select>
             <button
               type="button"
               onClick={isListening ? stopVoice : startVoice}
               className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                 isListening
                   ? 'bg-red-50 text-red-600 border border-red-200'
                   : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
               }`}
               aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
             >
               {isListening && (
                 <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
               )}
               {isListening
                 ? <><MicOff className="h-3.5 w-3.5" /> Stop</>
                 : <><Mic className="h-3.5 w-3.5" /> Voice Input</>
               }
             </button>
           </div>
         )}
         ```

      **Verify:** `cd frontend && npm run build` — 0 errors.

---

## FEAT-003 — SLA escalation worker: refactor to in-process setInterval

### What

`slaEscalation.js` currently calls `mongoose.connect` / `mongoose.disconnect` — designed as a standalone cron script. It needs to become an in-process worker that `server.js` starts after the DB is already connected.

---

- [ ] 5. Refactor `backend/workers/slaEscalation.js`.
      **Files:** `backend/workers/slaEscalation.js`

      Changes:
      - Remove `require('dotenv').config();` from the top.
      - Inside `checkSLABreaches()`: remove `await mongoose.connect(process.env.MONGODB_URI)` and the connected log.
      - Replace the `finally { await mongoose.disconnect(); ... }` block with a plain `finally {}` (or remove it entirely — there is nothing else to clean up inside the function).
      - Add a new exported function after `checkSLABreaches`:
        ```js
        function startSlaWorker() {
          console.log('[SLA Worker] Starting in-process SLA escalation worker (15 min interval)');
          checkSLABreaches(); // run once immediately on startup
          return setInterval(checkSLABreaches, 15 * 60 * 1000);
        }
        ```
      - Update `module.exports` to: `module.exports = { checkSLABreaches, startSlaWorker };`
      - Keep the `if (require.main === module)` block but inside it, restore the mongoose.connect/disconnect so the file is still runnable standalone:
        ```js
        if (require.main === module) {
          require('dotenv').config();
          mongoose.connect(process.env.MONGODB_URI)
            .then(() => checkSLABreaches())
            .then(() => mongoose.disconnect())
            .then(() => process.exit(0))
            .catch((err) => { console.error(err); process.exit(1); });
        }
        ```

      **Verify:** `node --check backend/workers/slaEscalation.js` — 0 errors.

- [ ] 6. Wire `startSlaWorker` into `backend/server.js`.
      **Files:** `backend/server.js`

      a) Add the import near the top with the other requires:
         ```js
         const { startSlaWorker } = require('./workers/slaEscalation');
         ```
      b) Inside the `start()` async function, after the `app.listen(...)` call, add:
         ```js
         startSlaWorker();
         ```
         (Still inside the `try` block, after the listen call.)

      **Verify:** `node --check backend/server.js` — 0 errors. Then `cd backend && node server.js` — logs must include `[SLA Worker] Starting in-process SLA escalation worker (15 min interval)` after `API listening on port ...`.

---

## Dependency order

FEAT-001 and FEAT-002 are fully independent (separate files, both frontend). FEAT-003 is backend-only and independent of both. Sequence: 001 → 002 → 003.

## Files NOT to touch

- `frontend/src/pages/MyReports.jsx` — already guards with `isCitizen`. ✅
- `frontend/src/pages/Home.jsx` — placeholder page, no Report Issue button. ✅
- All backend controllers, models, and audit utilities — already fully implemented. ✅
