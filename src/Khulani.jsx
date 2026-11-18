import React, { useEffect, useRef, useState } from 'react';
import { answerQuestion, prompts } from './khulani.js';
import { loadState } from './db.js';
import { watchPublications } from './cloud.js';

function readHistory(key) {
  try {
    const entries = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export default function Khulani({ workspaceKey, sensors, readings, ready, auth }) {
  const storageKey = 'agrishield.khulani:' + workspaceKey;
  const [history, setHistory] = useState(() => readHistory(storageKey));
  const [question, setQuestion] = useState('');
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const recognition = useRef(null);
  const transcript = useRef(null);
  const heading = useRef(null);
  const [publications, setPublications] = useState([]);
  const pending = useRef(false);
  const cancelled = useRef(false);
  const [working, setWorking] = useState(false);
  const input = useRef(null);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function scrollChat() {
    const log = transcript.current;
    if (log) log.scrollTop = log.scrollHeight;
  }

  useEffect(scrollChat, [history]);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    if (!auth) return;
    return watchPublications(auth, null, setPublications, () => setPublications([]));
  }, [auth]);
  useEffect(() => () => {
    cancelled.current = true;
    const active = recognition.current;
    recognition.current = null;
    active?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  function stopListening() {
    const active = recognition.current;
    recognition.current = null;
    active?.abort();
    setListening(false);
  }

  async function ask(value) {
    const text = value.trim();
    if (!text || !ready || pending.current) return;
    stopListening();
    window.speechSynthesis?.cancel();
    pending.current = true;
    setWorking(true);
    const saved = await loadState('weather:' + workspaceKey).catch(() => null);
    if (cancelled.current) return;
    const location = saved?.location;
    const point = Number.isFinite(location?.lat) && Number.isFinite(location?.lng)
      ? location.lat.toFixed(4) + ',' + location.lng.toFixed(4) : null;
    const weather = point && saved?.forecast?.point === point ? saved : null;
    const entry = { id: crypto.randomUUID(), question: text,
      answer: answerQuestion(text, { sensors, readings, weather, publications }) };
    pending.current = false;
    setWorking(false);
    const next = [...history, entry];
    setHistory(next);
    setQuestion('');
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setMessage('');
    } catch {
      setMessage('Device storage is unavailable. This question is saved for this session.');
    }
    input.current?.focus();
  }

  function dictate() {
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    if (!Recognition) {
      setMessage('Voice input is unavailable in this browser. You can type your question below.');
      input.current?.focus();
      return;
    }
    window.speechSynthesis?.cancel();
    const active = new Recognition();
    active.lang = 'en-ZA';
    recognition.current = active;
    setListening(true);
    setMessage('Listening…');
    let finished = false;
    active.onresult = event => {
      if (recognition.current !== active) return;
      finished = true;
      setQuestion(event.results[0][0].transcript.trim().slice(0, 240));
      setMessage('Voice prompt added. Review it and tap Send.');
      input.current?.focus();
    };
    active.onerror = event => {
      if (recognition.current !== active) return;
      finished = true;
      setMessage(['not-allowed', 'service-not-allowed'].includes(event.error)
        ? 'Microphone access is blocked. Check your browser permissions or type your question.'
        : 'Voice input could not hear a prompt. Try again or type your question.');
    };
    active.onend = () => {
      if (recognition.current !== active) return;
      recognition.current = null;
      setListening(false);
      if (!finished) setMessage('No voice prompt was captured.');
    };
    try { active.start(); } catch {
      stopListening();
      setMessage('Voice input could not start. You can type your question below.');
    }
  }

  function speak(text) {
    const engine = window.speechSynthesis;
    const voice = engine?.getVoices().find(item => item.localService && item.lang.toLowerCase().startsWith('en'));
    if (!voice) {
      setMessage('An offline English voice is unavailable on this device.');
      return;
    }
    stopListening();
    engine.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.onerror = ({ error }) => {
      if (error !== 'canceled' && error !== 'interrupted') setMessage('Audio could not start. Check your device audio and try again.');
    };
    setMessage('');
    engine.speak(utterance);
  }

  function clearChat() {
    if (!window.confirm('Clear this chat history from this browser?')) return;
    stopListening();
    window.speechSynthesis?.cancel();
    try {
      localStorage.removeItem(storageKey);
      setHistory([]);
      setQuestion('');
      setMessage('Chat cleared.');
    } catch {
      setMessage('Chat history could not be cleared from this browser.');
    }
  }

  return <div className="khulani-page">
    <section className="khulani-body" aria-labelledby="khulani-title">
      <header className="khulani-header">
        <h1 id="khulani-title" ref={heading} tabIndex={-1}>Khulani AI</h1>
        <p>Chat history stays on this device.</p>
        {history.length > 0 && <button type="button" className="khulani-clear" disabled={working} onClick={clearChat}>Clear chat</button>}
      </header>
      <section hidden={history.length === 0} className="khulani-transcript" ref={transcript} role="log" aria-label="Chat history" tabIndex={0}>
        {history.map(entry => <article className="khulani-turn" key={entry.id} id={'khulani-turn-' + entry.id} tabIndex={-1}>
          <p className="khulani-question"><strong>You</strong><br />{entry.question}</p>
          <div className="khulani-answer">
            <h3>Khulani{entry.bed ? ' · Earlier sample answer' : ''}</h3>
            <p>{entry.answer.text}</p>
            {entry.answer.sources.length > 0 && <details>
              <summary>Sources and permissions</summary>
              <ul>{entry.answer.sources.map(source => <li key={source}>{source}</li>)}</ul>
            </details>}
            <button type="button" onClick={() => speak(entry.answer.text)}>Read answer aloud</button>
          </div>
        </article>)}
      </section>
      {history.length === 0 && <>
        <div className="khulani-welcome">
          <span className="khulani-orb" aria-hidden="true" />
          <h3>Ask Khulani about your field</h3>
          <p>Ask by sensor ID or bed name, or ask about all your sensors.</p>
        </div>
        <div className="khulani-prompts">
        {prompts.map(prompt => <button type="button" onClick={() => ask(prompt)} key={prompt} disabled={!ready || working}>
            {prompt}<span aria-hidden="true">↗</span>
          </button>)}
        </div>
      </>}
      <form className="khulani-form" onSubmit={event => { event.preventDefault(); ask(question); }}>
        <label htmlFor="khulani-question">Your question</label>
        <div className="khulani-composer">
          <input ref={input} id="khulani-question" value={question} maxLength={240} placeholder="Ask about your field…"
            onChange={event => setQuestion(event.target.value)} />
          <button type="button" aria-pressed={listening} aria-label={listening ? "Stop listening" : "Use voice"} onClick={dictate}>{listening ? 'Stop' : 'Voice'}</button>
          <button type="submit" className="primary khulani-send" aria-label="Send" disabled={!question.trim() || !ready || working}><span aria-hidden="true">↑</span></button>
        </div>
      </form>
      {(!ready || working || message) && <p role="status">{!ready ? "Loading your farm data…" : working ? "Checking your farm data…" : message}</p>}
      <p className="monitor-note">Use voice for English dictation. Your browser may process speech online. Typed prompts work offline after the app loads.</p>
    </section>
  </div>;
}
