import React, { useEffect, useState } from 'react';
import { useLanguage } from './Language.jsx';
import QRCode from 'qrcode';
import { sensorPath, validSensorId } from './sensors.js';
import { googleEmbedUrl } from './sensorMaps.js';

const empty = { id: '', plot: '', bed: '', landmark: '', mapEmbed: '' };

export default function SensorRegister({ sensors, sensor, latest, lastSeen, missing, disabled, onSelect, onSave }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const path = sensor ? sensorPath(location.pathname === '/demo' ? '/demo' : '/', sensor.id) : '';
  const url = location.origin + path;

  useEffect(() => {
    if (!path) return;
    let active = true;
    QRCode.toDataURL(url, { width: 224, margin: 4 }).then(result => {
      if (active) setQr(result);
    }).catch(() => {
      if (active) setQr('');
    });
    return () => { active = false; };
  }, [path, url]);

  function open(item) {
    setEditing(item ? 'edit' : 'add');
    setForm(item ? { ...empty, ...item } : { ...empty, id: missing || '' });
    setError('');
  }

  function save(event) {
    event.preventDefault();
    if (disabled) return;
    const id = form.id.trim().toUpperCase();
    if (!validSensorId.test(id)) {
      setError('Use 2–32 letters, numbers or hyphens for the device ID.');
      return;
    }
    if (editing === 'add' && sensors.some(item => item.id === id)) {
      setError('That ID is already registered. Select the sensor to edit it.');
      return;
    }
    const plot = form.plot.trim();
    const bed = form.bed.trim();
    if (!plot || !bed) {
      setError('Enter both the plot and bed.');
      return;
    }
    const mapEmbed = googleEmbedUrl(form.mapEmbed);
    if (form.mapEmbed.trim() && (!mapEmbed || mapEmbed.length > 2048)) {
      setError('Copy the Google Maps HTML from Share → Embed a map, or paste its embed URL.');
      return;
    }
    onSave({ id, plot, bed, landmark: form.landmark.trim(), mapEmbed });
    setEditing(null);
  }

  return <section className="card sensor-register" aria-labelledby="sensor-register-heading">
    <h2 id="sensor-register-heading">{t("Field sensors")}</h2>
    {missing && <p className="monitor-note" role="status">Sensor {missing} has no location in this workspace. Register it to track readings.</p>}
    <fieldset disabled={disabled}>
      {sensor ? <>
        <label htmlFor="field-sensor">{t("Sensor location")}</label>
        <select id="field-sensor" value={sensor.id} onChange={event => {
          setEditing(null);
          onSelect(event.target.value);
        }}>
          {sensors.map(item => <option key={item.id} value={item.id}>{item.plot} · {item.bed} · {item.id}</option>)}
        </select>
        <p className="monitor-note"><strong>{sensor.id}</strong>{sensor.landmark && ' · ' + sensor.landmark}</p>
        {latest && <p><strong>{Number(latest.moisture.toFixed(1))}%</strong> · {t('Moisture')}</p>}
        <p>{lastSeen ? 'Last recorded · ' + lastSeen : 'No readings recorded for this sensor.'}</p>
      </> : <p>No sensors registered. Add the ID printed on your first device.</p>}
      <div className="account-links sensor-actions">
        <button type="button" onClick={() => open(null)}>{t("Register sensor")}</button>
        {sensor && <button type="button" onClick={() => open(sensor)}>{t("Edit location")}</button>}
      </div>
    </fieldset>
    {editing && <form onSubmit={save} className="sensor-form">
      <h3>{editing === 'add' ? 'Register a field sensor' : 'Edit sensor location'}</h3>
      {[
        { name: 'id', label: 'Device ID', max: 32 },
        { name: 'plot', label: 'Plot name', max: 80 },
        { name: 'bed', label: 'Bed or zone', max: 80 },
        { name: 'landmark', label: 'Landmark (optional)', max: 120 },
      ].map(({ name, label, max }) => <div key={name}>
        <label htmlFor={'register-' + name}>{t(label)}</label>
        <input id={'register-' + name} value={form[name]} maxLength={max}
          required={name !== 'landmark'} readOnly={name === 'id' && editing === 'edit'}
          onChange={event => setForm(old => ({ ...old, [name]: event.target.value }))} />
      </div>)}
      <label htmlFor="register-map">Google Maps embed (optional)</label>
      <textarea id="register-map" rows={2} maxLength={4096} value={form.mapEmbed}
        onChange={event => setForm(old => ({ ...old, mapEmbed: event.target.value }))}
        aria-describedby="register-map-help" />
      <p id="register-map-help" className="monitor-note">In Google Maps, place the pin, then choose Share → Embed a map → Copy HTML. Paste it here.</p>
      {error && <p className="feedback" role="alert">{error}</p>}
      <div className="account-links sensor-actions">
        <button className="primary" disabled={disabled}>{t("Save sensor")}</button>
        <button type="button" onClick={() => setEditing(null)}>{t("Cancel")}</button>
      </div>
    </form>}
    {sensor && <details key={url}>
      <summary>QR label for {sensor.id}</summary>
      <p>Print the QR and ID on the enclosure. Scan it with your phone camera.</p>
      {qr && <img className="sensor-qr" src={qr} width="160" height="160" alt={'QR label for sensor ' + sensor.id} />}
      <a href={path}>Open sensor link</a>
      <p className="monitor-note">For field use, generate this label from the hosted app address.</p>
    </details>}
  </section>;
}
