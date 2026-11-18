import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged } from 'firebase/auth';
import { crops, demoReadings, fetchReading, irrigationDemand, irrigationStatus } from './model.js';
import { loadState, saveState } from './db.js';
import library from './library.json';
import Account, { auth, authPage } from './Account.jsx';
import FarmProfile from './FarmProfile.jsx';
import SensorTabs from './SensorTabs.jsx';
import SensorRegister from './SensorRegister.jsx';
import { firstId, initialSensors, requestedSensor, sensorPath } from './sensors.js';
import FieldMonitor, { MoistureTrend } from './FieldMonitor.jsx';
import './style.css';

const initial = { crop: 'tomatoes', scenario: 'steady', history: [], tank: 70, demand: false, paused: false, sensors: initialSensors, sensorId: firstId };
const cropName = key => crops[key]?.name ?? 'All crops';
const formatTime = value => new Date(value).toLocaleString('en-ZA', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const sourceLabels = { simulation: 'Simulation', mock: 'Mock sensor', esp32: 'ESP32 endpoint' };

const demo = /^\/demo\/?$/.test(location.pathname);

function Root() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!auth);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, next => {
      setUser(next);
      setReady(true);
    });
  }, []);

  return <App key={authPage ?? user?.uid ?? 'guest'} user={user} ready={ready} />;
}

function App({ user, ready }) {
  const farmKey = user && !demo ? 'farm:' + user.uid : 'demo';
  const workspace = !authPage && (Boolean(user) || demo);
  const [state, setState] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState('');
  const [offline, setOffline] = useState(import.meta.env.PROD ? 'Preparing offline access…' : 'Offline cache available in production preview');
  const [view, setView] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [reading, setReading] = useState(null);
  const [sensor, setSensor] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadState(farmKey).then(saved => {
      const restored = { ...initial, ...saved };
      if (saved && !saved.sensors) {
        restored.sensors = initialSensors.map(item => item.id === firstId
          ? { ...item, scenario: restored.scenario } : item);
      }
      const selected = restored.sensors.find(item => item.id === requestedSensor);
      if (selected && selected.id !== restored.sensorId) {
        restored.sensorId = selected.id;
        restored.scenario = selected.scenario;
        restored.demand = false;
      }
      setState(restored);
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
    saveState(farmKey, state).then(() => {
      if (current) setStorage('');
    }).catch(() => {
      if (current) setStorage('Device storage unavailable. Changes last for this session.');
    });
    return () => { current = false; };
  }, [farmKey, loaded, state]);

  const sensorLocation = state.sensors.find(item => item.id === state.sensorId) ?? state.sensors[0];
  const sensorHistory = state.history.filter(item => (item.sensorId ?? firstId) === sensorLocation.id);
  const missingSensor = loaded && requestedSensor && !state.sensors.some(item => item.id === requestedSensor)
    ? requestedSensor : '';
  const crop = crops[state.crop];
  const current = reading ?? { moisture: demoReadings[state.scenario].moisture, source: 'simulation' };
  const status = irrigationStatus(current.moisture, crop.range);
  const demand = irrigationDemand(demoReadings[state.scenario].moisture, crop.range, state.demand);
  function changeSimulation(changes) {
    setState(old => {
      const next = { ...old, ...changes };
      const newDemand = irrigationDemand(demoReadings[next.scenario].moisture,
        crops[next.crop].range, old.crop === next.crop && old.demand);
      return { ...next, demand: newDemand,
        sensors: changes.scenario ? next.sensors.map(item => item.id === next.sensorId
          ? { ...item, scenario: changes.scenario } : item) : next.sensors };
    });
  }
  function selectSensor(id) {
    setReading(null);
    setSensor('');
    setState(old => {
      const item = old.sensors.find(candidate => candidate.id === id);
      if (!item) return old;
      return { ...old, sensorId: id, scenario: item.scenario, demand: false };
    });
  }

  function saveSensor(item) {
    setReading(null);
    setSensor('');
    setState(old => {
      const existing = old.sensors.find(candidate => candidate.id === item.id);
      const saved = { scenario: 'steady', ...existing, ...item };
      const sensors = existing ? old.sensors.map(candidate => candidate.id === saved.id ? saved : candidate)
        : [...old.sensors, saved];
      return { ...old, sensors, sensorId: saved.id, scenario: saved.scenario,
        demand: saved.id === old.sensorId && old.demand };
    });
  }

  function record(sample) {
    setState(old => {
      const sensorId = sensorLocation.id;
      const isSelected = item => (item.sensorId ?? firstId) === sensorId;
      const previous = old.history.filter(isSelected).slice(0, 29);
      const other = old.history.filter(item => !isSelected(item));
      return { ...old, history: [
        { ...sample, sensorId, crop: state.crop, time: Date.now() }, ...previous, ...other,
      ] };
    });
  }

  async function readSensor() {
    setBusy(true);
    setSensor('Waiting for the endpoint…');
    try {
      const sample = await fetchReading(sensorLocation.id);
      setReading(sample);
      record(sample);
      setSensor('Reading received from ' + sourceLabels[sample.source] + '.');
    } catch (error) {
      setReading(null);
      setSensor(error.message === 'Sensor ID mismatch' ? 'The endpoint returned a different or missing sensor ID. Showing simulation.'
        : 'Endpoint unavailable. Showing simulation. Check the local proxy and sensor connection.');
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
    {workspace && <nav className="wrap nav" aria-label="Main navigation">
      <button aria-current={view === 'dashboard' ? 'page' : undefined} onClick={() => setView('dashboard')}>Dashboard</button>
      <button aria-current={view === 'library' ? 'page' : undefined} onClick={() => setView('library')}>Knowledge library</button>
      {!demo && <button aria-current={view === 'account' ? 'page' : undefined} onClick={() => setView('account')}>Account</button>}
      {demo && <a className="nav-link" href="/">Exit demo</a>}
    </nav>}
    <main id="main" className="wrap" tabIndex={-1}>
      {storage && <p className="notice" role="status">{storage}</p>}
      {authPage ? <Account page={authPage} user={user} ready={ready} />
        : !workspace ? <section className="card welcome">
          <h1>Manage your farm with AgriShield</h1>
          <p className="intro">Monitor field conditions, review readings and find crop guidance.</p>
          {!ready ? <p role="status">Checking your session…</p> : <div className="account-links">
            <a className="button primary" href={sensorPath('/signup')}>Create an account</a>
            <a className="button" href={sensorPath('/signin')}>Sign in</a>
          </div>}
          <p><a href={sensorPath('/demo')}>Explore the offline demo</a></p>
        </section>
        : view === 'account' ? <FarmProfile user={user} auth={auth} /> : view === 'dashboard' ? <>
        <h1>Field dashboard</h1>
        <p className="intro">Agri-IKS hackathon demo for vegetable growers in Limpopo and Mpumalanga</p>
        <SensorRegister key={sensorLocation.id} sensors={state.sensors} sensor={sensorLocation}
          missing={missingSensor} disabled={!loaded || busy}
          lastSeen={sensorHistory[0] ? formatTime(sensorHistory[0].time) : ''}
          onSelect={selectSensor} onSave={saveSensor} />
        <div className="dashboard">
          <SensorTabs current={current} status={status} crop={crop}
            scenario={demoReadings[state.scenario]} source={sourceLabels[current.source]} />
          <section className="card" aria-labelledby="setup-title">
            <h2 id="setup-title">Demo controls</h2>
            <fieldset disabled={!loaded || busy}>
              <label htmlFor="crop">Crop</label>
              <select id="crop" value={state.crop} onChange={event => changeSimulation({ crop: event.target.value })}>
                {Object.entries(crops).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}
              </select>
              <label htmlFor="scenario">Simulated conditions</label>
              <select id="scenario" value={state.scenario} onChange={event => {
                const scenario = event.target.value;
                setReading(null);
                setSensor('');
                changeSimulation({ scenario });
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
        <FieldMonitor scenario={state.scenario} tank={state.tank} demand={demand} paused={state.paused}
          disabled={!loaded}
          onTank={tank => setState(old => ({ ...old, tank }))}
          onPause={() => setState(old => ({ ...old, paused: !old.paused }))} />
        <MoistureTrend history={sensorHistory} crop={state.crop} threshold={crop.range[0]} />
        <section className="card history" aria-labelledby="history-title">
          <h2 id="history-title">Recent readings</h2>
          {sensorHistory.length ? <ul>
            {sensorHistory.map((item, index) => <li key={item.time + '-' + index}>
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

createRoot(document.getElementById('root')).render(<Root />);
