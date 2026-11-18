import React, { useRef, useState } from 'react';
import { useLanguage } from './Language.jsx';

const tabs = [
  { id: 'moisture', label: 'Moisture' },
  { id: 'ph', label: 'pH' },
  { id: 'temperature', label: 'Temperature' },
];

export default function SensorTabs({ current, status, crop, scenario, source }) {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);
  const buttons = useRef([]);
  const selected = tabs[active].id;

  function navigate(event, index) {
    const destinations = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = destinations[event.key];
    if (typeof next !== 'number') return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  }

  return <section className="hero" aria-labelledby="sensor-title">
    <h2 id="sensor-title">{t("Sensor readings")}</h2>
    <div className="sensor-tabs" role="tablist" aria-label="Field sensor">
      {tabs.map(({ id, label }, index) => <button key={id} type="button"
        ref={element => { buttons.current[index] = element; }}
        id={'sensor-tab-' + id} role="tab" aria-selected={index === active}
        aria-controls={'sensor-panel-' + id} tabIndex={index === active ? 0 : -1}
        onClick={() => setActive(index)} onKeyDown={event => navigate(event, index)}>
        {t(label)}
      </button>)}
    </div>
    {tabs.map(({ id }) => <div key={id} role="tabpanel" id={'sensor-panel-' + id}
      aria-labelledby={'sensor-tab-' + id} tabIndex={id === selected ? 0 : -1} hidden={id !== selected}>
      {id === 'moisture' && !current ? <p className="range">{t("No moisture readings yet.")}</p>
        : id !== 'moisture' && !scenario ? <p className="range">The current sensor connection provides soil moisture only.</p>
        : id === 'moisture' ? <>
        <span className="source">{source}</span>
        <div aria-live="polite" aria-atomic="true">
          <p className="number">{Number(current.moisture.toFixed(1))}<span>%</span></p>
          <meter min="0" max="100" value={current.moisture} aria-label="Soil moisture percentage" />
          <div className="scale" aria-hidden="true"><span>0%</span><span>100%</span></div>
          {status && <p className={'status ' + status.tone}>{status.label}</p>}
        </div>
        {status && <><p className="range">Demo-only range for {crop.name.toLowerCase()} · {crop.range.join('–')}%</p>
        <p className="range">Illustrative thresholds. Do not use for watering decisions.</p></>}
      </> : <>
        <span className="source">Simulation</span>
        <div aria-live="polite" aria-atomic="true">
          {id === 'ph'
            ? <p className="number">{scenario.ph.toFixed(1)}<span>pH</span></p>
            : <p className="number">{scenario.temperature}<span>°C</span></p>}
        </div>
        <p className="range">{id === 'ph' ? 'Simulated soil pH' : 'Simulated field temperature'}</p>
      </>}
    </div>)}
  </section>;
}
