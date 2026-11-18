import React from 'react';
import { useLanguage } from './Language.jsx';

export function SensorList({ sensors, readings, timestamp, sourceLabels, onOpen, withReadings = false }) {
  const { t } = useLanguage();
  const entries = sensors.map(sensor => ({
    sensor, latest: readings.find(reading => reading.sensorId === sensor.id),
  })).filter(item => !withReadings || item.latest);
  return <section className="card history" aria-label={t(withReadings ? 'Sensors with readings' : 'Registered sensors')}>
    <h2>{t(withReadings ? 'Sensors with readings' : 'Registered sensors')}</h2>
    {entries.length ? <ul className="activity-list">
      {entries.map(({ sensor, latest }) => <li key={sensor.id}>
        <div>
          <strong>{sensor.plot} · {sensor.bed}</strong>
          <small>{sensor.id}{sensor.landmark && ' · ' + sensor.landmark}</small>
          <small>{latest ? sourceLabels[latest.source] + ' · ' + timestamp(latest.time) : 'No readings yet'}</small>
        </div>
        <div className="activity-value">
          {latest && <strong>{Number(latest.moisture.toFixed(1))}%</strong>}
          <button type="button" onClick={() => onOpen(sensor.id)}>{t('View sensor')}</button>
        </div>
      </li>)}
    </ul> : <p>{withReadings ? 'No sensors have saved readings yet.' : 'No sensors registered yet.'}</p>}
  </section>;
}

export function ReadingList({ sensors, readings, timestamp, sourceLabels, cropName, onOpen }) {
  const { t } = useLanguage();
  const byId = new Map(sensors.map(sensor => [sensor.id, sensor]));
  return <section className="card history" aria-label={t('Saved readings')}>
    {!readings.length ? <p>No readings saved yet.</p> : <ul className="activity-list">
      {readings.map((reading, index) => {
        const sensor = byId.get(reading.sensorId);
        return <li key={reading.id || reading.time + '-' + index}>
          <div>
            <strong>{sensor ? sensor.plot + ' · ' + sensor.bed : reading.sensorId}</strong>
            <small>{reading.sensorId} · {t(cropName(reading.crop))}</small>
            <small>{sourceLabels[reading.source]} · {timestamp(reading.time)}</small>
          </div>
          <div className="activity-value">
            <strong>{Number(reading.moisture.toFixed(1))}%</strong>
            {sensor && <button type="button" onClick={() => onOpen(sensor.id)}>{t('View sensor')}</button>}
          </div>
        </li>;
      })}
    </ul>}
  </section>;
}
