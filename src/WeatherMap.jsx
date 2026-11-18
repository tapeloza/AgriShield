import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { loadState, saveState } from './db.js';

const places = [
  { name: 'Polokwane, Limpopo', lat: -23.9045, lng: 29.4689 },
  { name: 'Tzaneen, Limpopo', lat: -23.8332, lng: 30.1635 },
  { name: 'Mbombela, Mpumalanga', lat: -25.4745, lng: 30.9703 },
  { name: 'Bushbuckridge, Mpumalanga', lat: -24.8325, lng: 31.0687 },
];
const region = 'Africa/Johannesburg';
const variables = [
  'weather_code', 'temperature_2m_min', 'temperature_2m_max',
  'precipitation_probability_max', 'precipitation_sum', 'wind_gusts_10m_max',
];
const pointKey = ({ lat, lng }) => lat.toFixed(4) + ',' + lng.toFixed(4);
const quantity = (value, unit) => Number.isFinite(value) ? Math.round(value * 10) / 10 + unit : 'Unavailable';

function conditions(code) {
  if (code === 0) return 'Clear';
  if (code >= 1 && code <= 3) return 'Partly cloudy to overcast';
  if (code === 45 || code === 48) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Conditions unavailable';
}

function LocationMap({ location, onPick }) {
  const element = useRef(null);
  const map = useRef(null);
  const pin = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const instance = L.map(element.current, { scrollWheelZoom: false });
    map.current = instance;
    const tiles = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(instance);
    tiles.on('tileerror', () => setFailed(true));
    tiles.on('tileload', () => setFailed(false));
    instance.on('click', ({ latlng }) => {
      const { lat, lng } = latlng.wrap();
      onPick({ name: 'Map pin', lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) });
    });
    pin.current = L.circleMarker([0, 0], { radius: 8, weight: 3, color: '#fff', fillColor: '#147847',
      fillOpacity: 1, interactive: false }).addTo(instance);
    return () => instance.remove();
  }, [onPick]);

  useEffect(() => {
    const coordinates = [location.lat, location.lng];
    map.current.setView(coordinates, map.current.getZoom() ?? 10);
    pin.current.setLatLng(coordinates);
  }, [location]);

  return <>
    <div className="farm-map" ref={element} role="region" aria-label="Farm location map" />
    {failed && <p role="status">Some map tiles are unavailable. You can still choose a town or enter coordinates.</p>}
  </>;
}

export default function WeatherMap({ workspaceKey, onClose }) {
  const key = 'weather:' + workspaceKey;
  const [location, setLocation] = useState(places[0]);
  const [forecast, setForecast] = useState(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [status, setStatus] = useState('Loading saved forecast…');
  const [locationStatus, setLocationStatus] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    loadState(key).then(saved => {
      if (!active || !saved) return;
      if (saved.location) setLocation(saved.location);
      if (saved.forecast) setForecast(saved.forecast);
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    const network = () => setOnline(navigator.onLine);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    return () => {
      active = false;
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
    };
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    saveState(key, { location, forecast }).catch(() => {});
  }, [key, ready, location, forecast]);

  useEffect(() => {
    if (!ready) return;
    if (!online) {
      setStatus('Offline. Only a previously saved forecast can be shown.');
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({
      latitude: location.lat.toFixed(4), longitude: location.lng.toFixed(4),
      daily: variables.join(','), forecast_days: '5', timezone: region,
    });
    setStatus('Updating forecast…');
    fetch('https://api.open-meteo.com/v1/forecast?' + query, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    }).then(async response => {
      if (!response.ok) throw new Error('Forecast unavailable');
      const data = await response.json();
      if (!data.daily?.time?.length) throw new Error('Forecast missing');
      return data.daily;
    }).then(daily => {
      if (controller.signal.aborted) return;
      setForecast({ point: pointKey(location), fetched: Date.now(), daily });
      setStatus('Latest forecast');
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('Forecast unavailable. Showing the last saved forecast if available.');
    });
    return () => controller.abort();
  }, [location, online, ready, refresh]);

  function placeCoordinates(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const lat = Number(fields.get('latitude'));
    const lng = Number(fields.get('longitude'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
      setLocationStatus('Enter valid map coordinates.');
      return;
    }
    setLocationStatus('');
    setLocation({ name: 'Entered coordinates', lat, lng });
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocationStatus('This browser does not provide location. Choose a town or enter coordinates.');
      return;
    }
    setLocationStatus('Finding your location…');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocationStatus('');
      setLocation({ name: 'Current location', lat: coords.latitude, lng: coords.longitude });
    }, () => setLocationStatus('Location unavailable. Choose a town or enter coordinates.'), { timeout: 8000 });
  }

  const current = forecast?.point === pointKey(location) ? forecast : null;
  const days = current?.daily;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: region, dateStyle: 'short' }).format(new Date());
  const visibleDays = (days?.time ?? []).map((date, index) => ({ date, index })).filter(({ date }) => date >= today);
  const dayLabel = date => new Date(date + 'T12:00:00Z').toLocaleDateString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: region,
  });

  return <>
    <button type="button" onClick={onClose}>Back to Local Guide</button>
    <h1 className="weather-title">Weather &amp; map</h1>
    <p className="intro">Choose a location for a five-day forecast. Forecasts and official warnings are separate.</p>
    <div className="weather-layout">
      <section className="card" aria-labelledby="map-heading">
        <h2 id="map-heading">Forecast location</h2>
        <label htmlFor="weather-place">Nearby town</label>
        <select id="weather-place" value={places.some(item => item.name === location.name) ? location.name : ''}
          onChange={event => setLocation(places.find(item => item.name === event.target.value) ?? location)}>
          <option value="" disabled>Custom location</option>
          {places.map(item => <option key={item.name}>{item.name}</option>)}
        </select>
        <div className="account-links weather-tools">
          <button type="button" onClick={locate}>Use my location</button>
        </div>
        <p className="monitor-note" role="status">{locationStatus}</p>
        <p className="monitor-note">{location.name} · {pointKey(location)}</p>
        {ready && online ? <LocationMap location={location} onPick={setLocation} /> :
          <p className="monitor-note">The interactive map needs internet. Saved coordinates are still available.</p>}
        <details>
          <summary>Enter coordinates</summary>
          <form onSubmit={placeCoordinates}>
            <label htmlFor="weather-lat">Latitude</label>
            <input id="weather-lat" name="latitude" type="number" step="any" min="-85" max="85" required />
            <label htmlFor="weather-lng">Longitude</label>
            <input id="weather-lng" name="longitude" type="number" step="any" min="-180" max="180" required />
            <button className="wide">Use coordinates</button>
          </form>
        </details>
        <a className="weather-credit" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a>
      </section>
      <section className="card" aria-labelledby="forecast-heading">
        <h2 id="forecast-heading">Five-day forecast</h2>
        <p role="status" className="monitor-note">{status}</p>
        {current && <p className="monitor-note">Last checked · {new Date(current.fetched).toLocaleString('en-ZA', {
          timeZone: region, dateStyle: 'medium', timeStyle: 'short',
        })} SAST</p>}
        {visibleDays.length ? <ul className="forecast-list">
          {visibleDays.map(({ date, index }) => <li key={date}>
            <div><strong>{dayLabel(date)}</strong><small>{conditions(days.weather_code[index])}</small></div>
            <div className="forecast-values">
              <strong>{quantity(days.temperature_2m_min[index], '°')} / {quantity(days.temperature_2m_max[index], '°C')}</strong>
              <small>Rain {quantity(days.precipitation_probability_max[index], '%')} · {quantity(days.precipitation_sum[index], ' mm')}</small>
              <small>Gusts {quantity(days.wind_gusts_10m_max[index], ' km/h')}</small>
            </div>
          </li>)}
        </ul> : <p>No current forecast is saved for this location.</p>}
        <div className="account-links weather-tools">
          <button type="button" disabled={!online || status === 'Updating forecast…'} onClick={() => setRefresh(value => value + 1)}>Refresh forecast</button>
        </div>
        <p className="monitor-note">Forecast data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>.</p>
        <a href="https://www.weathersa.co.za/warnings?region=rsa" target="_blank" rel="noreferrer">Check official SAWS warnings</a>
      </section>
    </div>
  </>;
}
