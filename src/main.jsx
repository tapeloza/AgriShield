import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { LanguageProvider, LanguageSelect, useLanguage } from './Language.jsx';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged } from 'firebase/auth';
import { crops, demoReadings, fetchReading, irrigationDemand, irrigationStatus } from './model.js';
import { loadState, saveState } from './db.js';
import library from './library.json';
import Account, { auth, authPage } from './Account.jsx';
import FarmProfile from './FarmProfile.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import Team from './Team.jsx';
import { mergeSampleHistory, sampleReadings } from './sampleReadings.js';
import { ReadingList, SensorList } from './ActivityLists.jsx';
import Publications from './Publications.jsx';
import NewsFeed from './NewsFeed.jsx';
import { saveCloudReading, saveCloudSensor, saveSampleReadings, saveSpecialistRole, watchReadings, watchRole, watchSensors } from './cloud.js';
import QuickTools from './QuickTools.jsx';
import Alerts from './Alerts.jsx';
import Support from './Support.jsx';
import FarmOnboarding from './FarmOnboarding.jsx';
import SensorTabs from './SensorTabs.jsx';
import SensorRegister from './SensorRegister.jsx';
import SensorMap from './SensorMap.jsx';
import { firstId, initialSensors, requestedSensor, sensorPath } from './sensors.js';
import FieldMonitor, { MoistureTrend } from './FieldMonitor.jsx';
import './style.css';

const Insights = lazy(() => import('./Insights.jsx'));
const WeatherMap = lazy(() => import('./WeatherMap.jsx'));
const initial = { crop: 'tomatoes', scenario: 'steady', history: [], tank: 70, demand: false, paused: false, sensors: initialSensors, sensorId: firstId };
const newFarm = { ...initial, tank: 0, sensors: [], sensorId: '' };
const cropName = key => crops[key]?.name ?? 'All crops';
const formatTime = value => new Date(value).toLocaleString('en-ZA', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const sourceLabels = { simulation: 'Simulation', mock: 'Mock sensor', esp32: 'ESP32 endpoint' };

const demo = /^\/demo\/?$/.test(location.pathname);

const localEndpoint = import.meta.env.DEV || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const supportPage = /^\/support\/?$/.test(location.pathname);

const publicAlerts = /^\/alerts\/?$/.test(location.pathname);
const publicGuide = /^\/guide\/?$/.test(location.pathname);

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

function useWorkspaceRole(user) {
  const [role, setRole] = useState(null);
  useEffect(() => {
    if (!user || demo || authPage || supportPage) return;
    let active = true;
    let unsubscribe;
    const key = 'role:' + user.uid;
    loadState(key).catch(() => null).then(local => {
      if (!active) return;
      setRole(local === 'specialist' ? 'specialist' : 'grower');
      unsubscribe = watchRole(auth, user.uid, snapshot => {
        if (snapshot.data()?.role === 'specialist') {
          setRole('specialist');
          saveState(key, 'specialist').catch(() => {});
        } else if (local === 'specialist' && !snapshot.metadata.fromCache) {
          saveSpecialistRole(auth, user.uid).catch(() => {});
        }
      }, () => {});
    });
    return () => { active = false; unsubscribe?.(); };
  }, [user]);
  return role;
}

function WorkspaceNav({ className = '', view, onView, specialist }) {
  const { t } = useLanguage();
  const links = specialist ? [['dashboard', 'Publications'], ['library', 'Local Guide'], ['alerts', 'Alerts']]
    : [['dashboard', 'Dashboard'], ['insights', 'Insights'], ['sensors', 'Sensors'], ['library', 'Local Guide'], ['alerts', 'Alerts']];
  return <nav className={'nav ' + className} aria-label={t('Main navigation')}>
    {links.map(([id, title]) =>
      <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => onView(id)}>{t(title)}</button>)}
  </nav>;
}

function ActivityStats({ sensors, history, onView }) {
  const { t } = useLanguage();
  const entries = [
    { label: 'Registered sensors', view: 'sensors', value: sensors.length },
    { label: 'Saved readings', view: 'readings', value: history.length },
    { label: 'Sensors with readings', view: 'sensors-with-readings',
      value: sensors.filter(sensor => history.some(item => item.sensorId === sensor.id)).length },
  ];
  return <div className="insight-grid">{entries.map(({ label, value, view }) =>
    <button type="button" className="card insight-link" key={label} onClick={() => onView(view)}>
      <span className="insight-label">{t(label)}</span><strong className="insight-number">{value}</strong>
      <span className="insight-arrow" aria-hidden="true">↗</span>
    </button>
  )}</div>;
}

function App({ user, ready }) {
  const { t } = useLanguage();
  const role = useWorkspaceRole(user);
  const specialist = role === 'specialist';
  const farmKey = user && !demo ? 'farm:' + user.uid : 'demo';
  const workspace = !authPage && !supportPage && (Boolean(user) || demo);
  const [cloudReadings, setCloudReadings] = useState([]);
  const [cloudStatus, setCloudStatus] = useState('');
  const [readingFeed, setReadingFeed] = useState('Connecting to Firebase…');
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sensorSync, setSensorSync] = useState('');
  const syncAttempts = useRef(new Set());
  const [state, setState] = useState(demo ? initial : newFarm);
  const [loaded, setLoaded] = useState(false);
  const [storage, setStorage] = useState('');
  const [offline, setOffline] = useState(import.meta.env.PROD ? 'Preparing offline access…' : 'Offline cache available in production preview');
  const [view, setView] = useState(publicAlerts ? 'alerts' : publicGuide ? 'library' : 'dashboard');
  const [weatherReturn, setWeatherReturn] = useState('library');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [reading, setReading] = useState(null);
  const [sensor, setSensor] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsDetails, setNeedsDetails] = useState(false);

  useEffect(() => {
    loadState(farmKey).then(saved => {
      const restored = { ...(demo ? initial : newFarm), ...saved };
      if (demo && saved && !saved.sensors) {
        restored.sensors = initialSensors.map(item => item.id === firstId
          ? { ...item, scenario: restored.scenario } : item);
      }
      if (demo && !restored.sampleVersion) {
        restored.history = mergeSampleHistory(restored.history, [
          ...sampleReadings(firstId, 'tomatoes', 'simulation'),
          ...sampleReadings('AS-002', 'morogo', 'simulation', -20),
        ]);
        restored.sampleVersion = 1;
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
    if (!loaded || !workspace) return;
    let current = true;
    saveState(farmKey, state).then(() => {
      if (current) setStorage('');
    }).catch(() => {
      if (current) setStorage('Device storage unavailable. Changes last for this session.');
    });
    return () => { current = false; };
  }, [farmKey, loaded, state, workspace]);

  useEffect(() => {
    if (!workspace || !user || demo) return;
    let active = true;
    loadState('profile:' + user.uid).then(profile => {
      if (active) setNeedsDetails(!profile?.business);
    }).catch(() => {});
    return () => { active = false; };
  }, [user, workspace]);

  function closeOnboarding() {
    setNeedsDetails(false);
    setState(old => ({ ...old, onboardingDismissed: true }));
  }

  useEffect(() => {
    if (!user || demo || !workspace || role !== 'grower') return;
    return watchReadings(auth, user.uid, (readings, cacheOnly) => {
      setCloudReadings(readings);
      setReadingFeed(cacheOnly ? 'Showing saved readings while connecting to Firebase.' : 'Live readings connected to Firebase.');
    }, () => {
      setReadingFeed('Cloud readings unavailable. Showing saved readings on this device.');
      setCloudStatus('Cloud readings are unavailable. Saved readings remain on this device.');
    });
  }, [user, workspace, role]);

  useEffect(() => {
    if (!loaded || !user || demo || !workspace || role !== 'grower') return;
    const local = state.sensors;
    let migrated = false;
    return watchSensors(auth, user.uid, snapshot => {
      const remote = snapshot.docs.map(entry => ({ mapEmbed: '', ...entry.data(), id: entry.id }));
      const byId = new Map(remote.map(item => [item.id, item]));

      setState(old => {
        const known = new Set(old.sensors.map(item => item.id));
        const sensors = old.sensors.map(item => item.syncToken || !byId.has(item.id) ? item
          : { ...item, ...byId.get(item.id) });
        for (const item of remote) {
          if (!known.has(item.id)) sensors.push({ ...item, scenario: 'steady' });
        }
        const requested = sensors.find(item => item.id === requestedSensor);
        const selected = requested && !old.sensors.some(item => item.id === requested.id)
          ? requested : sensors.find(item => item.id === old.sensorId) ?? sensors[0];
        return { ...old, sensors, sensorId: selected?.id ?? '',
          scenario: selected && selected.id !== old.sensorId ? selected.scenario : old.scenario };
      });

      if (migrated || snapshot.metadata.fromCache) return;
      migrated = true;
      const missing = local.filter(item => !item.syncToken && !byId.has(item.id));
      if (!missing.length) {
        setSensorSync('Sensor register connected to Firebase.');
        return;
      }
      setSensorSync('Syncing sensors saved on this device…');
      Promise.all(missing.map(item => saveCloudSensor(auth, user.uid, item, true)))
        .then(() => setSensorSync('Sensor register synced to Firebase.'))
        .catch(() => setSensorSync('Could not upload existing sensors. Your local register is still available.'));
    }, () => setSensorSync('Cloud sensor sync unavailable. Check the Firestore sensor rules.'));
  // Migrate the local list once when the workspace opens. Later edits are synced separately.
  }, [loaded, user, workspace, role]);

  useEffect(() => {
    if (!loaded || !user || demo || !workspace || role !== 'grower') return;
    for (const item of state.sensors) {
      const token = item.syncToken;
      if (!token || syncAttempts.current.has(token)) continue;
      syncAttempts.current.add(token);
      setSensorSync('Sensor saved on this device. Cloud sync pending.');
      saveCloudSensor(auth, user.uid, item).then(() => {
        setState(old => ({ ...old, sensors: old.sensors.map(sensor =>
          sensor.syncToken === token ? { ...sensor, syncToken: null } : sensor) }));
        setSensorSync('Sensor register synced to Firebase.');
      }).catch(() => setSensorSync('Cloud sensor sync unavailable. The sensor is saved on this device.'));
    }
  }, [loaded, user, workspace, role, state.sensors]);

  const cloudIds = new Set(cloudReadings.map(item => item.id));
  const history = [...cloudReadings, ...state.history.filter(item => !item.id || !cloudIds.has(item.id))]
    .map(item => item.sensorId ? item : { ...item, sensorId: firstId })
    .sort((first, second) => second.time - first.time);

  const sensorLocation = state.sensors.find(item => item.id === state.sensorId) ?? state.sensors[0];
  const sensorHistory = history.filter(item => (item.sensorId ?? firstId) === sensorLocation?.id);
  const missingSensor = loaded && requestedSensor && !state.sensors.some(item => item.id === requestedSensor)
    ? requestedSensor : '';
  const crop = crops[state.crop];
  const current = demo ? (reading ?? { moisture: demoReadings[state.scenario].moisture, source: 'simulation' })
    : sensorHistory.find(item => item.source !== 'simulation');
  const status = demo ? irrigationStatus(current.moisture, crop.range) : null;
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

  function openSensor(id) {
    selectSensor(id);
    setView('dashboard');
  }

  function saveSensor(item) {
    const syncToken = demo ? null : crypto.randomUUID();
    setReading(null);
    setSensor('');
    setState(old => {
      const existing = old.sensors.find(candidate => candidate.id === item.id);
      const saved = { scenario: 'steady', ...existing, ...item, syncToken };
      const sensors = existing ? old.sensors.map(candidate => candidate.id === saved.id ? saved : candidate)
        : [...old.sensors, saved];
      return { ...old, sensors, sensorId: saved.id, scenario: saved.scenario,
        demand: saved.id === old.sensorId && old.demand };
    });
  }

  function record(sample) {
    const sensorId = sensorLocation.id;
    const saved = { ...sample, id: crypto.randomUUID(), sensorId, crop: state.crop, time: Date.now() };
    setState(old => {
      const isSelected = item => (item.sensorId ?? firstId) === sensorId;
      const previous = old.history.filter(isSelected).slice(0, 29);
      const other = old.history.filter(item => !isSelected(item));
      return { ...old, history: [
        saved, ...previous, ...other,
      ] };
    });
    if (user && !demo && sample.source !== 'simulation') {
      setCloudStatus('Cloud sync pending.');
      saveCloudReading(auth, user.uid, saved)
        .then(() => setCloudStatus('Reading synced to Firebase.'))
        .catch(() => setCloudStatus('Cloud sync unavailable. Reading saved on this device.'));
    }
  }

  async function loadSampleBatch() {
    if (!user || !sensorLocation || sampleBusy) return;
    const items = sampleReadings(sensorLocation.id, state.crop, 'mock');
    setSampleBusy(true);
    setState(old => ({ ...old, history: mergeSampleHistory(old.history, items) }));
    setCloudStatus('Sample readings saved on this device. Cloud sync pending.');
    try {
      await saveSampleReadings(auth, user.uid, items);
      setCloudStatus('12 sample readings synced to Firebase.');
    } catch {
      setCloudStatus('Cloud sync unavailable. Sample readings are saved on this device.');
    } finally {
      setSampleBusy(false);
    }
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
      setSensor(error.message === 'Sensor ID mismatch' ? 'The endpoint returned a different or missing sensor ID.'
        : 'Endpoint unavailable. Check the local proxy and sensor connection.');
    } finally {
      setBusy(false);
    }
  }

  const sample = demoReadings[state.scenario];
  const speech = workspace && !specialist && loaded && sensorLocation && current ? [
    'Sensor ' + sensorLocation.id + '. ' + sensorLocation.plot + ', ' + sensorLocation.bed + '.',
    sourceLabels[current.source] + '. Soil moisture: ' + Number(current.moisture.toFixed(1)) + ' percent.',
    ...(demo ? ['Simulated soil pH: ' + sample.ph + '. Temperature: ' + sample.temperature +
      ' degrees Celsius. Rainfall: ' + sample.rainfall + ' millimetres. Soil nutrients: ' + sample.nutrients +
      '. Reservoir: ' + state.tank + ' percent.'] : []),
  ].join(' ') : '';

  const digits = number => [...String(Number(number.toFixed(1)))].map(character =>
    character === '.' ? 'point' : character === '-' ? 'minus' : character);
  const speechClips = speech ? [
    current.source, 'moisture', ...digits(current.moisture), 'percent',
    ...(demo ? ['ph', ...digits(sample.ph), 'temperature', ...digits(sample.temperature), 'celsius',
      'rainfall', ...digits(sample.rainfall), 'millimetres', 'nutrients', sample.nutrients.toLowerCase(),
      'reservoir', ...digits(state.tank), 'percent'] : []),
  ] : [];

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = library.filter(entry => {
    const searchable = [cropName(entry.crop), ...Object.values(entry)].join(' ').toLowerCase();
    return (filter === 'all' || entry.crop === filter || entry.crop === 'all') &&
      terms.every(term => searchable.includes(term));
  });

  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header className="top">
      <div className="wrap header header-single">
        <a href="/" className="brand brand-wordmark">
          <img src="/agrishield-logo.png" alt="AgriShield" width="1024" height="572" />
        </a>
        {workspace && <WorkspaceNav className="desktop-nav" specialist={specialist} view={view} onView={setView} />}
        <div className="header-actions">
          {workspace && <button type="button" className="mobile-nav-toggle" popoverTarget="workspace-navigation"
            aria-label={t('Menu')} title={t('Menu')}>☰</button>}
          <LanguageSelect />
          {workspace && <ProfileMenu user={user} demo={demo} auth={auth}
            onAccount={() => setView('account')} onTeam={() => setView('team')} />}
        </div>
        {workspace && <div id="workspace-navigation" className="workspace-menu" popover="auto">
          <WorkspaceNav specialist={specialist} view={view} onView={next => {
            document.getElementById('workspace-navigation').hidePopover();
            setView(next);
          }} />
        </div>}
      </div>
    </header>
    <main id="main" className={'wrap' + (authPage ? ' auth-main' : '')} tabIndex={-1}>
      {storage && <p className="notice" role="status">{storage}</p>}
      {supportPage ? <Support /> : authPage ? <Account page={authPage} user={user} ready={ready} />
        : !workspace && !publicGuide && !publicAlerts ? <section className="welcome welcome-hero">
          <h1>{t("Manage your farm with AgriShield")}</h1>
          <p className="intro">Monitor field conditions, review readings and find crop guidance.</p>
          {!ready ? <p role="status">Checking your session…</p> : <div className="account-links">
            <a className="button primary" href={sensorPath('/signup')}>{t("Create an account")}</a>
            <a className="button" href={sensorPath('/signin')}>{t("Sign in")}</a>
          </div>}
          <p><a href={sensorPath('/demo')}>{t("Explore the offline demo")}</a> · <a href="/guide">{t('Local Guide')}</a> · <a href="/alerts">{t('Alerts')}</a></p>
        </section>
        : view === 'account' ? <FarmProfile user={user} auth={auth} />
        : view === 'team' ? <Team uid={user.uid} />
        : view === 'insights' ? <>
          {!loaded ? <p role="status">Loading activity…</p> :
            <Suspense fallback={<p role="status">Loading insights…</p>}>
              <Insights readings={history} cropName={cropName}>
                <ActivityStats sensors={state.sensors} history={history} onView={setView} />
              </Insights>
            </Suspense>}
        </> : view === 'alerts' ? <Alerts sensors={state.sensors} readings={history} loaded={loaded}
          demo={demo} sampleStatus={status} formatTime={formatTime} onWeather={() => { setWeatherReturn('alerts'); setView('weather'); }}
          onSensors={workspace && !specialist ? () => setView('sensors') : null} />
        : view === 'weather' ? <Suspense fallback={<p role="status">Loading weather tools…</p>}>
          <WeatherMap workspaceKey={farmKey} onClose={() => setView(weatherReturn)} />
        </Suspense>
        : view === 'readings' ? <>
          <h1>{t('Saved readings')}</h1>
          {!demo && <p className="intro" role="status">{readingFeed}</p>}
          <ReadingList sensors={state.sensors} readings={history} timestamp={formatTime}
            sourceLabels={sourceLabels} cropName={cropName} onOpen={openSensor} />
        </> : view === 'sensors-with-readings' ? <>
          <h1>{t('Sensors with readings')}</h1>
          {!demo && <p className="intro" role="status">{readingFeed}</p>}
          <SensorList sensors={state.sensors} readings={history} timestamp={formatTime}
            sourceLabels={sourceLabels} onOpen={openSensor} withReadings />
        </> : view === 'sensors' ? <>
          <h1>{t("Sensors")}</h1>
          <p className="intro">Register devices, update field locations and print QR labels.</p>
          {loaded && sensorLocation && <SensorMap sensor={sensorLocation} />}
          {!demo && sensorSync && <p className="monitor-note" role="status">{sensorSync}</p>}
          {!loaded ? <p role="status">Loading sensors…</p> :
            <SensorRegister key={sensorLocation?.id ?? 'empty'} sensors={state.sensors} sensor={sensorLocation}
              missing={missingSensor} disabled={busy} latest={sensorHistory[0]} lastSeen={sensorHistory[0] ? formatTime(sensorHistory[0].time) : ''}
              onSelect={selectSensor} onSave={saveSensor} />}
          {loaded && <SensorList sensors={state.sensors} readings={history} timestamp={formatTime}
            sourceLabels={sourceLabels} onOpen={openSensor} />}
        </> : view === 'dashboard' && !demo && !role ? <p role="status">Loading your workspace…</p>
        : view === 'dashboard' && specialist ? <Publications uid={user.uid} auth={auth} />
        : view === 'dashboard' ? <>
        <section className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <p className="workspace-label">{t(demo ? 'Demo workspace' : 'Farm workspace')}</p>
            <h1>{t("Field dashboard")}</h1>
            <p>{demo ? 'Explore field monitoring and irrigation with sample data.'
              : 'See field conditions and recent activity from your farm.'}</p>
          </div>
        </section>
        {loaded && <ActivityStats sensors={state.sensors} history={history} onView={setView} />}
        {!loaded ? <p role="status">Loading your dashboard…</p> : !sensorLocation ? <section className="card">
          <h2>{t("No field sensors yet")}</h2>
          <p className="monitor-note">Register a sensor to start collecting readings for your farm.</p>
          {!demo && sensorSync && <p className="monitor-note" role="status">{sensorSync}</p>}
          <button className="primary" onClick={() => setView('sensors')}>{t("Go to Sensors")}</button>
        </section> : <>
        <div className="card sensor-register">
          <label htmlFor="dashboard-sensor">{t("Sensor location")}</label>
          <select id="dashboard-sensor" value={sensorLocation.id} disabled={busy}
            onChange={event => selectSensor(event.target.value)}>
            {state.sensors.map(item => <option key={item.id} value={item.id}>{item.plot} · {item.bed} · {item.id}</option>)}
          </select>
          {missingSensor && <p className="monitor-note">Sensor {missingSensor} is unregistered in this workspace.</p>}
        </div>
        <div className="dashboard">
          <SensorTabs current={current} status={status} crop={crop}
            scenario={demo ? demoReadings[state.scenario] : null} source={sourceLabels[current?.source]} />
          <section className="card" aria-labelledby="setup-title">
            <h2 id="setup-title">{demo ? 'Demo controls' : 'Sensor connection'}</h2>
            <fieldset disabled={!loaded || busy}>
              <label htmlFor="crop">{t("Crop")}</label>
              <select id="crop" value={state.crop} onChange={event => changeSimulation({ crop: event.target.value })}>
                {Object.entries(crops).map(([key, item]) => <option key={key} value={key}>{t(item.name)}</option>)}
              </select>
              {demo && <>
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
              }}>Record simulated reading</button></>}
            </fieldset>
            {localEndpoint && <details>
              <summary>Local Wi-Fi sensor</summary>
              <p>Reads the configured endpoint once. Set up the mock or ESP32 connection using the project guide.</p>
              <button disabled={!loaded || busy} onClick={readSensor}>Read endpoint</button>
            </details>}
            {!demo && <>
              <p className="monitor-note">{readingFeed}</p>
              {!localEndpoint && <p className="monitor-note">A physical sensor needs a connected gateway to send its readings online.</p>}
              <details>
                <summary>Test Firebase sync</summary>
                <p>Save a labelled 52% mock reading for the selected sensor. No hardware is contacted.</p>
                <button type="button" disabled={!loaded || busy} onClick={() => {
                  setSensor('');
                  record({ moisture: 52, source: 'mock' });
                }}>Save mock reading</button>
                <p className="monitor-note">Load 12 labelled mock readings across three days for this sensor. Run this from the account you plan to demonstrate.</p>
                <button type="button" disabled={!loaded || busy || sampleBusy} onClick={loadSampleBatch}>Load sample readings</button>
              </details>
            </>}
            <p role="status" className="feedback">{sensor}</p>
            {!demo && cloudStatus && <p className="monitor-note" role="status">{cloudStatus}</p>}
          </section>
        </div>
        {demo && <><FieldMonitor scenario={state.scenario} tank={state.tank} demand={demand} paused={state.paused}
          disabled={!loaded}
          onTank={tank => setState(old => ({ ...old, tank }))}
          onPause={() => setState(old => ({ ...old, paused: !old.paused }))} />
        <MoistureTrend history={sensorHistory} crop={state.crop} threshold={crop.range[0]} /></>}
        <section className="card history" aria-labelledby="history-title">
          <h2 id="history-title">{t("Recent readings")}</h2>
          {sensorHistory.length ? <ul>
            {sensorHistory.map((item, index) => <li key={item.time + '-' + index}>
              <div><strong>{cropName(item.crop)}</strong><small>{sourceLabels[item.source]} · {formatTime(item.time)}</small></div>
              <strong>{Number(item.moisture.toFixed(1))}%</strong>
            </li>)}
          </ul> : <p>{demo ? 'Record a simulated reading to start your log.' : 'Waiting for a reading from this sensor.'}</p>}
        </section>
        </>}
      </> : <>
        <h1>{t("Local Guide")}</h1>
        <p className="intro">Offline field notes and a sample permission record for Indigenous Knowledge Systems.</p>
        <section className="card guide-weather" aria-labelledby="weather-heading">
          <h2 id="weather-heading">{t("Weather warnings")}</h2>
          <p className="monitor-note">Check a five-day forecast for your farm and open official South African Weather Service warnings.</p>
          <a href="https://www.weathersa.co.za/warnings?region=rsa" target="_blank" rel="noreferrer">{t("View official weather warnings")}</a>
          <div className="account-links weather-tools">
            <button type="button" className="primary" onClick={() => { setWeatherReturn('library'); setView('weather'); }}>Open weather &amp; map</button>
          </div>
        </section>
        <NewsFeed auth={auth} />
        <div className="card filters">
          <div><label htmlFor="query">{t("Search the library")}</label><input id="query" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try morogo or water" /></div>
          <div><label htmlFor="filter">{t("Filter by crop")}</label><select id="filter" value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="all">{t("All crops")}</option>
            {Object.entries(crops).map(([key, item]) => <option key={key} value={key}>{t(item.name)}</option>)}
          </select></div>
        </div>
        <p className="results" role="status">{results.length ? results.length + (results.length === 1 ? ' entry' : ' entries') : 'No entries match. Try another crop or search term.'}</p>
        <div className="library">
          {results.map(entry => <article className="card" key={entry.id}>
            <p className="topic">{t(cropName(entry.crop))} · {entry.topic}</p>
            <h2 lang="en-ZA">{entry.title}</h2><p lang="en-ZA">{entry.body}</p>
            <dl><dt>Provenance</dt><dd lang="en-ZA">{entry.source}</dd><dt>{t("Permission")}</dt><dd lang="en-ZA">{entry.permission}</dd></dl>
          </article>)}
        </div>
      </>}
      {workspace && loaded && needsDetails && role === 'grower' && !state.onboardingDismissed && user && !demo &&
        <FarmOnboarding uid={user.uid} onClose={closeOnboarding} />}
    </main>
    <QuickTools speech={speech} speechClips={speechClips} demo={demo} workspaceKey={workspace ? farmKey : 'public'} />
    {import.meta.env.PROD && <footer className="wrap footer"><span role="status">{t(offline)}</span></footer>}
  </>;
}

createRoot(document.getElementById('root')).render(<LanguageProvider><Root /></LanguageProvider>);
