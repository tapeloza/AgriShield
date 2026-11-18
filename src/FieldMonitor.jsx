import React from 'react';
import { demoReadings, tankCapacity } from './model.js';

export default function FieldMonitor({ scenario, tank, demand, paused, disabled, onTank, onPause }) {
  const { rainfall, nutrients } = demoReadings[scenario];
  const running = demand && !paused && tank > 0;
  const litres = Math.round(tankCapacity * tank / 100).toLocaleString('en-ZA');

  return <div className="field-grid">
    <section className="card" aria-labelledby="field-heading">
      <h2 id="field-heading">Field sensors</h2>
      <p className="monitor-note">Simulated readings</p>
      <dl className="metrics">
        <div><dt>Rainfall</dt><dd>{rainfall} mm</dd></div>
        <div><dt>Soil nutrients (NPK)</dt><dd>{nutrients}</dd></div>
      </dl>
    </section>
    <section className="card" aria-labelledby="tank-heading">
      <h2 id="tank-heading">Reservoir and drip irrigation</h2>
      <p className="monitor-note">Simulation only · no commands sent to hardware</p>
      <p><strong>{tank}%</strong> · {litres} L of 5 000 L</p>
      <meter className="tank-meter" min="0" max="100" value={tank} aria-label="Simulated reservoir level" />
      <div role="status" className="irrigation-message">
        <strong>{running ? 'Drip irrigation on' : 'Drip irrigation off'}</strong>
        <span>{paused ? 'Manually paused.' : tank === 0 ? 'Tank empty. Irrigation is blocked.' :
          demand ? 'Moisture called for watering.' : 'Waiting for moisture to drop below the demo range.'}</span>
        <span>{tank <= 20 ? 'Refill requested · reservoir level at or below 20%.' : 'Refill valve closed.'}</span>
      </div>
      <fieldset disabled={disabled}>
        <label htmlFor="tank-level">Simulated tank level</label>
        <input type="range" id="tank-level" min="0" max="100" step="5" value={tank}
          onChange={event => onTank(Number(event.target.value))} />
        <button className="wide" onClick={onPause}>{paused ? 'Resume automatic irrigation' : 'Pause irrigation'}</button>
      </fieldset>
    </section>
  </div>;
}

export function MoistureTrend({ history, crop, threshold }) {
  const samples = history.filter(item => item.crop === crop && item.source === 'simulation')
    .slice(0, 12).reverse();
  const points = samples.map((item, index) => [
    8 + index * 284 / Math.max(1, samples.length - 1), 108 - item.moisture,
  ]);
  const description = samples.map(item => item.moisture + '%').join(', ');
  return <section className="card history" aria-labelledby="trend-heading">
    <h2 id="trend-heading">Soil moisture trend</h2>
    <p className="monitor-note">Recorded simulations for the selected crop · oldest to newest</p>
    {samples.length === 0 ? <p>Record a simulated reading to start the trend.</p> : <>
      <svg className="trend" viewBox="0 0 300 116" aria-hidden="true">
        <line x1="8" x2="292" y1={108 - threshold} y2={108 - threshold} stroke="#94500a" strokeDasharray="4 4" />
        <polyline points={points.map(point => point.join(',')).join(' ')} fill="none" stroke="#176140" strokeWidth="2" />
        {points.map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" fill="#176140" />)}
      </svg>
      <p>Recorded moisture · {description}</p>
      <p className="monitor-note">Dashed line · demo start threshold at {threshold}%</p>
    </>}
  </section>;
}
