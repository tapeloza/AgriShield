import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from './Language.jsx';
import voiceIndex from './sensor-voice.json';

const preference = 'agrishield.accessibility';

export default function QuickTools({ speech, speechClips, demo }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(preference) === 'on'; } catch { return false; }
  });
  const [speaking, setSpeaking] = useState(false);
  const [message, setMessage] = useState('');
  const audio = useRef(null);
  const playback = useRef([]);
  const request = useRef(0);

  useEffect(() => {
    document.documentElement.classList.toggle('reading-mode', mode);
    try { localStorage.setItem(preference, mode ? 'on' : 'off'); } catch {}
    return () => document.documentElement.classList.remove('reading-mode');
  }, [mode]);

  useEffect(() => () => {
    request.current += 1;
    audio.current?.context.close();
  }, []);

  async function speak() {
    const token = ++request.current;
    if (speaking) {
      playback.current.forEach(source => source.stop());
      playback.current = [];
      setSpeaking(false);
      setMessage('');
      return;
    }
    if (!speech) {
      setMessage('Select a sensor with a reading on the dashboard first.');
      return;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) {
      setMessage('Audio is unavailable in this browser. The reading is shown below.');
      return;
    }

    setSpeaking(true);
    setMessage('Starting audio…');
    try {
      if (!audio.current) {
        const context = new Audio();
        audio.current = { context };
      }
      const { context } = audio.current;
      await context.resume();
      if (!audio.current.buffer) {
        const response = await fetch('/sensor-voice.wav');
        if (!response.ok) throw new Error('Audio file unavailable');
        audio.current.buffer = await context.decodeAudioData(await response.arrayBuffer());
      }
      if (request.current !== token) return;
      let startTime = context.currentTime + 0.04;
      playback.current = speechClips.map(clip => {
        const [offset, duration] = voiceIndex[clip];
        const source = context.createBufferSource();
        source.buffer = audio.current.buffer;
        source.connect(context.destination);
        source.start(startTime, offset, duration);
        startTime += duration + 0.045;
        return source;
      });
      playback.current.at(-1).onended = () => {
        if (request.current !== token) return;
        playback.current = [];
        setSpeaking(false);
        setMessage('');
      };
      setMessage('Reading the selected sensor aloud.');
    } catch {
      if (request.current !== token) return;
      setSpeaking(false);
      setMessage('Audio could not start. Check your audio output and tap to retry.');
    }
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
      <p className="monitor-note">Read-aloud uses the bundled English voice.</p>
      <div role="status">{message}</div>
      {speech && <details><summary>Reading transcript</summary><p lang="en-ZA">{speech}</p></details>}
    </section>
  </>;
}
