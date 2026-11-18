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
  const heading = useRef(null);
  const [publications, setPublications] = useState([]);
  const pending = useRef(false);
  const cancelled = useRef(false);
  const [working, setWorking] = useState(false);
  const input = useRef(null);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

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
    const mode = /\bsample (?:farm|sensors?|beds?|data|forecast|demo)\b/i.test(text) ? 'gemini' : 'farm';
    if (!text || !ready || pending.current) return;
    stopListening();
    window.speechSynthesis?.cancel();
    pending.current = true;
    setWorking(true);
    setMessage('');
    let answer;
    try {
      if (mode === 'gemini') {
        const token = await auth?.currentUser?.getIdToken();
        if (!token) throw new Error('Sign in again to use Gemini sample chat.');
        const turns = history.filter(entry => entry.mode === 'gemini').slice(-3)
          .map(entry => ({ question: entry.question, text: entry.answer.text.slice(0, 900) }));
        const response = await fetch('/api/khulani', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, turns }), signal: AbortSignal.timeout(24000),
        });
        if (!response.ok) {
          if (response.status === 429) throw new Error('Gemini’s free quota is busy. Try again later or ask about your own farm.');
          if (response.status === 401) throw new Error('Sign in again to use Gemini sample chat.');
          throw new Error('Gemini sample chat is unavailable. Try again or ask about your own farm.');
        }
        answer = await response.json();
        if (typeof answer.text !== 'string' || !Array.isArray(answer.sources)) throw new Error('Gemini returned an unexpected reply.');
      }
    } catch (error) {
      if (!cancelled.current) {
        pending.current = false;
        setWorking(false);
        setQuestion(text);
        setMessage(error instanceof TypeError || error.name === 'TimeoutError'
          ? 'Gemini needs an internet connection. Try again or ask about your own farm.'
          : error.message);
      }
      return;
    }
    const saved = mode === 'farm' ? await loadState('weather:' + workspaceKey).catch(() => null) : null;
    if (cancelled.current) return;
    const location = saved?.location;
    const point = Number.isFinite(location?.lat) && Number.isFinite(location?.lng)
      ? location.lat.toFixed(4) + ',' + location.lng.toFixed(4) : null;
    const weather = point && saved?.forecast?.point === point ? saved : null;
    const entry = { id: crypto.randomUUID(), question: text, mode,
      answer: answer ?? answerQuestion(text, { sensors, readings, weather, publications }) };
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
      <section hidden={history.length === 0} role="log" aria-label="Chat history">
        {history.map(entry => <article className="khulani-turn" key={entry.id} id={'khulani-turn-' + entry.id} tabIndex={-1}>
          <p className="khulani-question"><strong>You</strong><br />{entry.question}</p>
          <div className="khulani-answer">
            <h3>Khulani{entry.mode === 'gemini' ? ' · Gemini sample' : entry.bed ? ' · Earlier sample answer' : ''}</h3>
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
          <p>Ask by sensor ID or bed name, or ask about the sample farm.</p>
        </div>
        <div className="khulani-prompts">
        {[...prompts, "Which bed on the sample farm dried out most?"].map(prompt => <button type="button" onClick={() => ask(prompt)} key={prompt} disabled={!ready || working}>
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
      {(!ready || working || message) && <p role="status">{!ready ? "Loading your farm data…" : working ? "Preparing your answer…" : message}</p>}
      <p className="monitor-note">Use voice for English dictation. Your browser may process speech online. Farm lookups work offline after the app loads. Sample farm prompts go to Gemini. Keep them free of personal or farm-identifying details.</p>
    </section>
  </div>;
}
