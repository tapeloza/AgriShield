import library from './library.json';

export const prompts = ['Which sensors have readings?', 'Show my latest soil readings', 'Will it rain today?'];
const labels = { simulation: 'Simulation', mock: 'Mock sensor', esp32: 'ESP32' };
const normal = value => String(value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const contains = (text, term) => term && (' ' + text + ' ').includes(' ' + term + ' ');
const number = value => Math.round(value * 10) / 10;
const time = value => new Date(value).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });

function selectSensors(text, sensors) {
  const ids = sensors.filter(sensor => {
    const id = normal(sensor.id);
    return contains(text, id) || contains(text, id.replaceAll(' ', ''));
  });
  if (ids.length) return { sensors: ids };
  const named = sensors.map(sensor => ({
    sensor,
    score: [sensor.plot, sensor.bed, sensor.landmark].filter(name => contains(text, normal(name))).length,
  }));
  const max = Math.max(0, ...named.map(item => item.score));
  const matched = named.filter(item => max > 0 && item.score === max).map(item => item.sensor);
  if (matched.length > 1 && !/\b(all|compare|plot|field)\b/.test(text)) {
    return { error: 'That location matches more than one sensor. Try ' + matched.map(s => s.id).join(', ') + '.' };
  }
  if (matched.length) return { sensors: matched };
  if (/\b[a-z]{1,8}[ -]?\d{2,}\b/.test(text) || /\b(?:bed|plot) \d+\b/.test(text)) {
    return { error: 'I couldn’t match that sensor or bed in your workspace. Ask “Which sensors are registered?” to see the available names.' };
  }
  return { sensors };
}

export function answerQuestion(question, { sensors, readings, weather, publications = [] }) {
  const text = normal(question);
  const selected = selectSensors(text, sensors);
  const listOnly = /\b(?:which|list|registered|how many)\b/.test(text) && /\bsensors?\b/.test(text);
  const weatherRequested = /\b(?:weather|forecast|rain|rainfall|wind|air temperature)\b/.test(text);
  const guideRequested = /\b(?:guide|iks|knowledge|publication|publications)\b/.test(text);
  const watering = /\b(?:water|irrigate|irrigation|watering)\b/.test(text);
  const unavailableMetric = /\b(?:ph|npk|nutrients?|soil temperature|salinity)\b/.test(text) ||
    (/\btemperature\b/.test(text) && !weatherRequested);
  const soilRequested = watering || listOnly || unavailableMetric || /\b(?:soil|moisture|sensor|sensors|reading|readings|bed|compare|average|trend|data)\b/.test(text) ||
    selected.error || selected.sensors?.length < sensors.length;
  const lines = [];
  const sources = new Set();

  if (soilRequested) {
    if (selected.error) lines.push(selected.error);
    else if (unavailableMetric) lines.push('Your saved sensor records currently contain soil moisture. I don’t have stored readings for that metric.');
    else if (!selected.sensors.length) lines.push('There are no registered sensors in your workspace yet.');
    else {
      const indexed = new Map(selected.sensors.map(sensor => [sensor.id, []]));
      for (const reading of readings) {
        if (Number.isFinite(reading.moisture) && Number.isFinite(reading.time)) indexed.get(reading.sensorId)?.push(reading);
      }
      const summary = /\b(?:average|mean|trend|history|changed|change)\b/.test(text);
      const requireReadings = listOnly && /\b(?:have|with)\b.*\breadings\b/.test(text);
      const rows = selected.sensors.flatMap(sensor => {
        const available = indexed.get(sensor.id).sort((a, b) => b.time - a.time);
        const [latest, previous] = available;
        if (requireReadings && !latest) return [];
        const name = [sensor.id, sensor.plot, sensor.bed].filter(Boolean).join(' · ');
        if (!latest) return [name + ' — no saved readings.'];
        sources.add('Farm sensor register and saved readings');
        const comparable = available.filter(reading => reading.source === latest.source);
        const comparison = comparable[1];
        const details = summary && comparable.length > 1
          ? ' Average of ' + comparable.length + ' saved ' + (labels[latest.source] ?? 'sensor') + ' readings: ' +
            number(comparable.reduce((sum, reading) => sum + reading.moisture, 0) / comparable.length) +
            '%. Previous comparable reading: ' + number(comparison.moisture) + '%.'
          : watering && previous?.source === latest.source ? ' Previous reading: ' + number(previous.moisture) + '%.' : '';
        return [name + ' — ' + number(latest.moisture) + '% soil moisture, ' + time(latest.time) +
          ' (' + (labels[latest.source] ?? 'saved reading') + ').' + details];
      });
      if (listOnly) {
        lines.push((requireReadings ? rows.length + ' sensors with saved readings.' : selected.sensors.length + ' registered sensors.'));
        sources.add('Farm sensor register');
      }
      lines.push(...rows);
    }
  }
  if (weatherRequested || watering) {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const tomorrow = /\btomorrow\b/.test(text);
    const nextDate = new Date(date + 'T12:00:00+02:00');
    if (tomorrow) nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const target = tomorrow ? nextDate.toISOString().slice(0, 10) : date;
    const daily = weather?.forecast?.daily;
    const index = daily?.time?.indexOf(target) ?? -1;
    if (index < 0) lines.push('There is no saved forecast covering ' + (tomorrow ? 'tomorrow' : 'today') + ' for your selected location. Open Weather & Map to set or refresh the location.');
    else {
      const rain = daily.precipitation_probability_max?.[index];
      const low = daily.temperature_2m_min?.[index];
      const high = daily.temperature_2m_max?.[index];
      const values = [
        Number.isFinite(rain) ? rain + '% chance of rain' : '',
        Number.isFinite(low) && Number.isFinite(high) ? low + '–' + high + ' °C' : '',
      ].filter(Boolean);
      lines.push((weather.location.name || 'Saved farm location') + ' · ' + target + ': ' + (values.join(', ') || 'forecast values unavailable') + '.');
      sources.add('Open-Meteo forecast saved ' + time(weather.forecast.fetched));
    }
  }
  if (guideRequested || watering) {
    const terms = text.split(' ').filter(word => word.length >= 4 && !['what','does','about','guide','knowledge','publication','publications','show','local'].includes(word));
    const articles = guideRequested ? publications.filter(item => item.permission === 'granted' && item.content &&
      (!terms.length || terms.some(term => contains(normal(item.title + ' ' + item.content), term)))).slice(0, 2) : [];
    if (articles.length) {
      for (const article of articles) {
        lines.push(article.title + ': ' + article.content.slice(0, 400) + (article.content.length > 400 ? '…' : ''));
        sources.add(article.title + ' · ' + article.provenance + ' · permission granted');
      }
    } else {
      const entry = library.find(item => item.id === 'water-log' && item.permission === 'Demo content · shareable');
      if (entry) {
        lines.push(entry.body);
        sources.add(entry.title + ' · ' + entry.source + ' · ' + entry.permission);
      }
    }
  }
  if (watering) lines.push('Check the soil in the bed before deciding whether to irrigate.');
  return { text: lines.join('\n\n') || 'Ask about a sensor by its ID or bed name, your latest readings, the weather or the Local Guide.', sources: [...sources] };
}
