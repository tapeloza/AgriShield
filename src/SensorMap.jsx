import React, { useEffect, useState } from 'react';
import { sensorMap } from './sensorMaps.js';

export default function SensorMap({ sensor }) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const network = () => setOnline(navigator.onLine);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    return () => {
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
    };
  }, []);

  const { src, external, note } = sensorMap(sensor, import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY);
  const label = sensor.plot + ' · ' + sensor.bed + ' · ' + sensor.id;
  return <section className="card sensor-map-card" aria-labelledby="sensor-map-heading">
    <div className="sensor-map-heading">
      <div><h2 id="sensor-map-heading">Sensor map</h2><p>{label}</p></div>
      <a href={external} target="_blank" rel="noreferrer">Search plot in Google Maps</a>
    </div>
    <p className="monitor-note">{online ? note : 'Map unavailable offline. Your saved sensor location is shown above.'}</p>
    {online && <iframe key={src} src={src} title={'Map for ' + label} className="sensor-map-frame"
      loading="lazy" referrerPolicy="origin" allowFullScreen />}
  </section>;
}
