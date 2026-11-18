import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { sensorPath, validSensorId } from './sensors.js';

const empty = { id: '', plot: '', bed: '', landmark: '' };

export default function SensorRegister({ sensors, sensor, lastSeen, missing, disabled, onSelect, onSave }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const path = sensorPath(location.pathname === '/demo' ? '/demo' : '/', sensor.id);
  const url = location.origin + path;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 224, margin: 4 }).then(result => {
      if (active) setQr(result);
    }).catch(() => {
      if (active) setQr('');
    });
    return () => { active = false; };
  }, [url]);

  function open(item) {
    setEditing(item ? 'edit' : 'add');
    setForm(item ?? { ...empty, id: missing || '' });
    setError('');
  }

  function save(event) {
    event.preventDefault();
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
    onSave({ id, plot, bed, landmark: form.landmark.trim() });
    setEditing(null);
  }

  return <section className="card sensor-register" aria-labelledby="sensor-register-heading">
    <h2 id="sensor-register-heading">Field sensors</h2>
    {missing && <p className="monitor-note" role="status">Sensor {missing} has no location in this workspace. Register it to track readings.</p>}
    <fieldset disabled={disabled}>
      <label htmlFor="field-sensor">Sensor location</label>
      <select id="field-sensor" value={sensor.id} onChange={event => {
        setEditing(null);
        onSelect(event.target.value);
      }}>
        {sensors.map(item => <option key={item.id} value={item.id}>{item.plot} · {item.bed} · {item.id}</option>)}
      </select>
      <p className="monitor-note"><strong>{sensor.id}</strong>{sensor.landmark && ' · ' + sensor.landmark}</p>
      <p>{lastSeen ? 'Last recorded · ' + lastSeen : 'No readings recorded for this sensor.'}</p>
      <div className="account-links sensor-actions">
        <button type="button" onClick={() => open(null)}>Register sensor</button>
        <button type="button" onClick={() => open(sensor)}>Edit location</button>
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
        <label htmlFor={'register-' + name}>{label}</label>
        <input id={'register-' + name} value={form[name]} maxLength={max}
          required={name !== 'landmark'} readOnly={name === 'id' && editing === 'edit'}
          onChange={event => setForm(old => ({ ...old, [name]: event.target.value }))} />
      </div>)}
      {error && <p className="feedback" role="alert">{error}</p>}
      <div className="account-links sensor-actions">
        <button className="primary">Save sensor</button>
        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </form>}
    <details key={url}>
      <summary>QR label for {sensor.id}</summary>
      <p>Print the QR and ID on the enclosure. Scan it with your phone camera.</p>
      {qr && <img className="sensor-qr" src={qr} width="160" height="160" alt={'QR label for sensor ' + sensor.id} />}
      <a href={path}>Open sensor link</a>
      <p className="monitor-note">For field use, generate this label from the hosted app address.</p>
    </details>
  </section>;
}
