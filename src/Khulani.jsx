import React, { useEffect, useRef, useState } from 'react';
import { answerQuestion, beds, prompts } from './khulani.js';

function readHistory(key) {
  try {
    const entries = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

export default function Khulani({ dialogRef, onClose, workspaceKey }) {
  const storageKey = 'agrishield.khulani:' + workspaceKey;
  const [history, setHistory] = useState(() => readHistory(storageKey));
  const [bed, setBed] = useState(() => history.at(-1)?.bed ?? 'cabbage');
  const [question, setQuestion] = useState('');
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const recognition = useRef(null);
  const transcript = useRef(null);
  const input = useRef(null);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function scrollChat() {
    const log = transcript.current;
    if (log) log.scrollTop = log.scrollHeight;
  }

  useEffect(scrollChat, [history]);
  useEffect(() => () => {
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

  function ask(value) {
    const text = value.trim();
    if (!text) return;
    stopListening();
    window.speechSynthesis?.cancel();
    const entry = { id: crypto.randomUUID(), bed, question: text, answer: answerQuestion(beds[bed], text) };
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

  return <dialog ref={dialogRef} className="khulani-dialog" aria-labelledby="khulani-title"
    onToggle={event => { if (event.newState === 'open') scrollChat(); }}
    onClose={() => { stopListening(); window.speechSynthesis?.cancel(); setMessage(''); onClose(); }}>
    <header className="khulani-header">
      <div><h2 id="khulani-title">Khulani AI</h2><p>Sample farm · Chat history stays on this device</p></div>
      <form method="dialog"><button aria-label="Close Khulani AI">Close</button></form>
    </header>
    <div className="khulani-body">
      <div className="khulani-controls">
        <div><label htmlFor="khulani-bed">Sample bed</label>
          <select id="khulani-bed" value={bed} onChange={event => setBed(event.target.value)}>
            {Object.entries(beds).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
          </select>
        </div>
        {history.length > 0 && <button type="button" onClick={clearChat}>Clear chat</button>}
      </div>
      <section className="khulani-transcript" ref={transcript} role="log" aria-label="Chat history" tabIndex={0}>
        {history.length === 0 && <p>Ask about soil moisture, local weather or what to check before watering.</p>}
        {history.map(entry => <article className="khulani-turn" key={entry.id}>
          <p className="khulani-question"><strong>You · {beds[entry.bed]?.name}</strong><br />{entry.question}</p>
          <div className="khulani-answer">
            <h3>Khulani</h3>
            <p>{entry.answer.text}</p>
            {entry.answer.sources.length > 0 && <details>
              <summary>Sources and permissions</summary>
              <ul>{entry.answer.sources.map(source => <li key={source}>{source}</li>)}</ul>
            </details>}
            <button type="button" onClick={() => speak(entry.answer.text)}>Read answer aloud</button>
          </div>
        </article>)}
      </section>
      {history.length === 0 && <div className="khulani-prompts">
        {prompts.map(prompt => <button type="button" onClick={() => ask(prompt)} key={prompt}>{prompt}</button>)}
      </div>}
      <form className="khulani-form" onSubmit={event => { event.preventDefault(); ask(question); }}>
        <label htmlFor="khulani-question">Your question</label>
        <div className="khulani-composer">
          <input ref={input} id="khulani-question" value={question} maxLength={240}
            onChange={event => setQuestion(event.target.value)} />
          <button type="button" aria-pressed={listening} onClick={dictate}>{listening ? 'Stop listening' : 'Use voice'}</button>
          <button className="primary" disabled={!question.trim()}>Send</button>
        </div>
      </form>
      {message && <p role="status">{message}</p>}
      <p className="monitor-note">Use voice for English dictation. Your browser may process speech online. Typed prompts work offline after the app loads.</p>
    </div>
  </dialog>;
}
