import React, { useEffect, useState } from 'react';
import { answerQuestion, beds, prompts } from './khulani.js';

export default function Khulani({ dialogRef, onClose }) {
  const [bed, setBed] = useState('cabbage');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [audioMessage, setAudioMessage] = useState('');

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function ask(value) {
    const text = value.trim();
    if (!text) return;
    window.speechSynthesis?.cancel();
    setQuestion(text);
    setAnswer(answerQuestion(beds[bed], text));
    setAudioMessage('');
  }

  function speak() {
    const engine = window.speechSynthesis;
    const voice = engine?.getVoices().find(item => item.localService && item.lang.toLowerCase().startsWith('en'));
    if (!voice) {
      setAudioMessage('An offline English voice is unavailable on this device. The answer is shown above.');
      return;
    }
    engine.cancel();
    const utterance = new SpeechSynthesisUtterance(answer.text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.onerror = ({ error }) => {
      if (error !== 'canceled' && error !== 'interrupted') setAudioMessage('Audio could not start. Check your device audio and try again.');
    };
    setAudioMessage('');
    engine.speak(utterance);
  }

  return <dialog ref={dialogRef} className="khulani-dialog" aria-labelledby="khulani-title"
    onClose={() => { window.speechSynthesis?.cancel(); onClose(); }}>
    <header className="khulani-header">
      <div><h2 id="khulani-title">Khulani AI</h2><p>Sample farm · Works offline</p></div>
      <form method="dialog"><button aria-label="Close Khulani AI">Close</button></form>
    </header>
    <div className="khulani-body">
      <p>Ask about soil moisture, rain, or what to check before watering.</p>
      <label htmlFor="khulani-bed">Sample bed</label>
      <select id="khulani-bed" value={bed} onChange={event => {
        window.speechSynthesis?.cancel();
        setBed(event.target.value);
        setAnswer(null);
        setAudioMessage('');
      }}>
        {Object.entries(beds).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
      </select>
      <div className="khulani-prompts">
        {prompts.map(prompt => <button type="button" onClick={() => ask(prompt)} key={prompt}>{prompt}</button>)}
      </div>
      <form className="khulani-form" onSubmit={event => { event.preventDefault(); ask(question); }}>
        <label htmlFor="khulani-question">Your question</label>
        <input id="khulani-question" value={question} maxLength={240} onChange={event => setQuestion(event.target.value)} />
        <button className="primary" disabled={!question.trim()}>Ask Khulani</button>
      </form>
      <section aria-live="polite">
        {answer && <div className="khulani-answer">
          <h3>Khulani’s answer</h3>
          <p>{answer.text}</p>
          {answer.sources.length > 0 && <details>
            <summary>Sources and permissions</summary>
            <ul>{answer.sources.map(source => <li key={source}>{source}</li>)}</ul>
          </details>}
        </div>}
      </section>
      {answer && <button type="button" onClick={speak}>Read answer aloud</button>}
      <div role="status">{audioMessage}</div>
      <p className="monitor-note">Sample data only. The Local Guide uses shareable demo entries. Community contributions require permission.</p>
    </div>
  </dialog>;
}
