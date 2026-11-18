import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { crops, demoReadings, fetchReading, irrigationStatus } from './model.js';
import { loadState, saveState } from './db.js';
import library from './library.json';
import Account, { opensAccount } from './Account.jsx';
import './style.css';

const initial = { crop: 'tomatoes', scenario: 'steady', history: [] };
const cropName = key => crops[key]?.name ?? 'All crops';
const formatTime = value => new Date(value).toLocaleString('en-ZA', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const sourceLabels = { simulation: 'Simulation', mock: 'Mock sensor', esp32: 'ESP32 endpoint' };

function App() {
  const [state, setState] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState('');
  const [offline, setOffline] = useState(import.meta.env.PROD ? 'Preparing offline access…' : 'Offline cache available in production preview');
  const [view, setView] = useState(opensAccount ? 'account' : 'dashboard');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [reading, setReading] = useState(null);
  const [sensor, setSensor] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadState().then(saved => {
      if (saved) setState(saved);
    }).catch(() => setStorage('Device storage unavailable. Changes last for this session.'))
      .finally(() => setLoaded(true));
    if (!import.meta.env.PROD) return;
    if (!('serviceWorker' in navigator)) {
      setOffline('Offline access requires localhost or HTTPS');
      return;
    }
    navigator.serviceWorker.register('/sw.js')
      .then(async registration => {
        const worker = registration.installing || registration.waiting;
        if (worker) {
          await new Promise((resolve, reject) => {
            const check = () => {
              if (worker.state === 'activated') resolve();
              if (worker.state === 'redundant') reject(new Error('Offline installation failed'));
            };
            worker.addEventListener('statechange', check);
            check();
          });
        }
        await navigator.serviceWorker.ready;
        setOffline('Ready offline');
      })
      .catch(() => setOffline('Offline setup failed. Reopen while connected.'));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let current = true;
    saveState(state).then(() => {
      if (current) setStorage('');
    }).catch(() => {
      if (current) setStorage('Device storage unavailable. Changes last for this session.');
    });
    return () => { current = false; };
  }, [loaded, state]);

  const crop = crops[state.crop];
  const current = reading ?? { moisture: demoReadings[state.scenario].moisture, source: 'simulation' };
  const status = irrigationStatus(current.moisture, crop.range);
  const record = (sample, cropKey = state.crop) => setState(old => ({
    ...old,
    history: [{ ...sample, crop: cropKey, time: Date.now() }, ...old.history].slice(0, 30),
  }));

  async function readSensor() {
    setBusy(true);
    setSensor('Waiting for the endpoint…');
    try {
      const sample = await fetchReading();
      setReading(sample);
      record(sample);
      setSensor('Reading received from ' + sourceLabels[sample.source] + '.');
    } catch {
      setReading(null);
      setSensor('Endpoint unavailable. Showing simulation. Check the local proxy and sensor connection.');
    } finally {
      setBusy(false);
    }
  }

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = library.filter(entry => {
    const searchable = [cropName(entry.crop), ...Object.values(entry)].join(' ').toLowerCase();
    return (filter === 'all' || entry.crop === filter || entry.crop === 'all') &&
      terms.every(term => searchable.includes(term));
  });

  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header className="top"><div className="wrap header">
      <div className="brand"><span className="mark" aria-hidden="true">◒</span><div><strong>AgriShield</strong><small>AgriSquad</small></div></div>
      <span className="offline" role="status"><span aria-hidden="true">●</span> {offline}</span>
    </div></header>
    <nav className="wrap nav" aria-label="Main navigation">
      <button aria-current={view === 'dashboard' ? 'page' : undefined} onClick={() => setView('dashboard')}>Dashboard</button>
      <button aria-current={view === 'library' ? 'page' : undefined} onClick={() => setView('library')}>Knowledge library</button>
      <button aria-current={view === 'account' ? 'page' : undefined} onClick={() => setView('account')}>Account</button>
    </nav>
    <main id="main" className="wrap" tabIndex={-1}>
      {storage && <p className="notice" role="status">{storage}</p>}
      {view === 'account' ? <Account /> : view === 'dashboard' ? <>
        <h1>Soil moisture</h1>
        <p className="intro">Agri-IKS hackathon demo for vegetable growers in Limpopo and Mpumalanga</p>
        <div className="dashboard">
          <section className="hero" aria-labelledby="moisture-title">
            <div className="hero-header"><h2 id="moisture-title">Current reading</h2><span className="source">{sourceLabels[current.source]}</span></div>
            <div aria-live="polite" aria-atomic="true">
              <p className="number">{Number(current.moisture.toFixed(1))}<span>%</span></p>
              <meter min="0" max="100" value={current.moisture} aria-label="Current moisture percentage" />
              <div className="scale" aria-hidden="true"><span>0%</span><span>100%</span></div>
              <p className={'status ' + status.tone}>{status.label}</p>
            </div>
            <p className="range">Demo-only range for {crop.name.toLowerCase()} · {crop.range.join('–')}%</p>
            <p className="range">Illustrative thresholds. Do not use for watering decisions.</p>
          </section>
          <section className="card" aria-labelledby="setup-title">
            <h2 id="setup-title">Demo controls</h2>
            <fieldset disabled={!loaded || busy}>
              <label htmlFor="crop">Crop</label>
              <select id="crop" value={state.crop} onChange={event => setState(old => ({ ...old, crop: event.target.value }))}>
                {Object.entries(crops).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
              </select>
              <label htmlFor="scenario">Simulated conditions</label>
              <select id="scenario" value={state.scenario} onChange={event => {
                const scenario = event.target.value;
                setReading(null);
                setSensor('');
                setState(old => ({ ...old, scenario }));
              }}>
                {Object.entries(demoReadings).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
              <button className="primary wide" onClick={() => {
                const sample = { moisture: demoReadings[state.scenario].moisture, source: 'simulation' };
                setReading(null);
                record(sample);
                setSensor('Simulated reading saved to recent readings.');
              }}>Record simulated reading</button>
            </fieldset>
            <details>
              <summary>Local Wi-Fi sensor</summary>
              <p>Reads the configured endpoint once. Set up the mock or ESP32 connection using the project guide.</p>
              <button disabled={!loaded || busy} onClick={readSensor}>Read endpoint</button>
            </details>
            <p role="status" className="feedback">{sensor}</p>
          </section>
        </div>
        <section className="card history" aria-labelledby="history-title">
          <h2 id="history-title">Recent readings</h2>
          {state.history.length ? <ul>
            {state.history.map((item, index) => <li key={item.time + '-' + index}>
              <div><strong>{cropName(item.crop)}</strong><small>{sourceLabels[item.source]} · {formatTime(item.time)}</small></div>
              <strong>{Number(item.moisture.toFixed(1))}%</strong>
            </li>)}
          </ul> : <p>Record a simulated reading to start your log.</p>}
        </section>
      </> : <>
        <h1>Knowledge library</h1>
        <p className="intro">Offline field notes and a sample permission record for Indigenous Knowledge Systems.</p>
        <div className="card filters">
          <div><label htmlFor="query">Search the library</label><input id="query" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try morogo or water" /></div>
          <div><label htmlFor="filter">Filter by crop</label><select id="filter" value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="all">All crops</option>
            {Object.entries(crops).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
          </select></div>
        </div>
        <p className="results" role="status">{results.length ? results.length + (results.length === 1 ? ' entry' : ' entries') : 'No entries match. Try another crop or search term.'}</p>
        <div className="library">
          {results.map(entry => <article className="card" key={entry.id}>
            <p className="topic">{cropName(entry.crop)} · {entry.topic}</p>
            <h2>{entry.title}</h2><p>{entry.body}</p>
            <dl><dt>Provenance</dt><dd>{entry.source}</dd><dt>Permission</dt><dd>{entry.permission}</dd></dl>
          </article>)}
        </div>
      </>}
    </main>
    <footer className="wrap footer">AgriSquad · Agri-IKS hackathon</footer>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
