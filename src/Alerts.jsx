import React from 'react';
import { useLanguage } from './Language.jsx';

const day = 24 * 60 * 60 * 1000;

export default function Alerts({ sensors, readings, loaded, demo, sampleStatus, formatTime, onSensors, onWeather }) {
  const { t } = useLanguage();
  const now = Date.now();
  const latestBySensor = new Map();
  for (const reading of readings) {
    if ((demo || reading.source === 'esp32') && !latestBySensor.has(reading.sensorId)) {
      latestBySensor.set(reading.sensorId, reading);
    }
  }
  const sensorAlerts = sensors.flatMap(sensor => {
    const latest = latestBySensor.get(sensor.id);
    if (!latest) return [{ sensor, message: demo ? 'No saved sample reading.' : 'No physical sensor reading saved yet.' }];
    return now - latest.time >= day
      ? [{ sensor, message: 'Last saved reading is at least 24 hours old.', time: latest.time }]
      : [];
  });

  return <>
    <h1>{t('Alerts')}</h1>
    <p className="intro">Review weather warnings and sensor issues that may need attention.</p>
    <div className="alert-grid">
      <section className="card" aria-labelledby="alert-weather">
        <h2 id="alert-weather">Weather warnings</h2>
        <p>Check the South African Weather Service for current warnings in your area.</p>
        <div className="account-links weather-tools">
          <a className="button primary" href="https://www.weathersa.co.za/warnings?region=rsa" target="_blank" rel="noreferrer">
            View official SAWS warnings
          </a>
          <button type="button" onClick={onWeather}>Open local forecast &amp; map</button>
        </div>
      </section>
      {onSensors && <section className="card" aria-labelledby="alert-sensors">
        <h2 id="alert-sensors">{demo ? 'Demo sensor alerts' : 'Sensor alerts'}</h2>
        {!loaded ? <p role="status">Loading saved readings…</p> : <>
          {sampleStatus && sampleStatus.tone !== 'steady' && <p className="notice">
            Selected demo bed: {sampleStatus.label.toLowerCase()}. This uses a simulated reading and demo limits.
          </p>}
          {sensorAlerts.length > 0 ? <ul className="alert-list">{sensorAlerts.map(({ sensor, message, time }) =>
            <li key={sensor.id}><strong>{sensor.id}</strong> · {message} {time && <small>{formatTime(time)}</small>}</li>)}
          </ul> : <p>{sensors.length ? 'No missing or old saved readings.' : 'Register a sensor to see its reading status here.'}</p>}
        </>}
        <button type="button" onClick={onSensors}>Open Sensors</button>
      </section>}
    </div>
  </>;
}
