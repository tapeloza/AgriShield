import React, { useEffect, useState } from 'react';
import { useLanguage } from './Language.jsx';

const preference = 'agrishield.accessibility';

export default function QuickTools({ speech, demo }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(preference) === 'on'; } catch { return false; }
  });
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('reading-mode', mode);
    try { localStorage.setItem(preference, mode ? 'on' : 'off'); } catch {}
    return () => document.documentElement.classList.remove('reading-mode');
  }, [mode]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  function speak() {
    const engine = window.speechSynthesis;
    if (!engine || !window.SpeechSynthesisUtterance) {
      setMessage('This browser does not support reading aloud.');
      return;
    }
    if (speaking) {
      engine.cancel();
      setSpeaking(false);
      setMessage('');
      return;
    }
    if (!speech) {
      setMessage('Select a sensor with a reading on the dashboard first.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speech);
    const localEnglish = engine.getVoices().filter(voice => voice.localService && voice.lang.startsWith('en'));
    utterance.voice = localEnglish.find(voice => voice.lang === 'en-ZA') ?? localEnglish[0] ?? null;
    utterance.lang = utterance.voice?.lang || 'en-ZA';
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = event => {
      setSpeaking(false);
      if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setMessage('Unable to play. Check the speech voices installed on this device.');
      }
    };
    setMessage('');
    setSpeaking(true);
    engine.speak(utterance);
  }

  return <>
    <button type="button" className="quick-trigger" popoverTarget="quick-tools">
      <span aria-hidden="true">✦</span> {t('Quick tools')}
    </button>
    <section id="quick-tools" className="quick-panel" popover="auto" aria-labelledby="quick-heading">
      <h2 id="quick-heading">{t('Quick tools')}</h2>
      <button type="button" onClick={speak}>{t(speaking ? 'Stop reading' : 'Read sensor data aloud')}</button>
      <a className="button" href={demo ? '/support?from=demo' : '/support'}>{t('Get support')}</a>
      <button type="button" aria-pressed={mode} onClick={() => setMode(value => !value)}>
        {t('Accessibility mode')} <small>{t(mode ? 'On' : 'Off')}</small>
      </button>
      <p className="monitor-note">Read-aloud uses an English voice provided by your device.</p>
      <div role="status">{message}</div>
    </section>
  </>;
}
