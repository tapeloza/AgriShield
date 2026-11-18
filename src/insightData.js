const dayMs = 86400000;
const palette = ['#24764f', '#306bb0', '#c37b27', '#8264ad', '#b64c61', '#479ca3'];
export const categories = ['All', 'Sensors', 'Crops', 'Soil data'];
export const zones = {
  all: 'All sources', esp32: 'Field sensor', mock: 'Mock sensor', simulation: 'Simulation',
};
export const dayInSA = value => new Date(value + 2 * 3600000).toISOString().slice(0, 10);
export const presetPeriod = days => {
  const now = Date.now();
  return { start: dayInSA(now - (days - 1) * dayMs), end: dayInSA(now) };
};

export function insightData(readings, period, source, cropName) {
  const start = Date.parse(period.start + 'T00:00:00+02:00');
  const end = Date.parse(period.end + 'T00:00:00+02:00') + dayMs;
  const rows = readings.filter(row => row.time >= start && row.time < end && (source === 'all' || source === row.source));
  const sensorTotals = new Map(), cropTotals = new Map(), daily = new Map();
  const bands = [0, 0, 0];
  let sum = 0;
  for (const row of rows) {
    const sensor = row.sensorId ?? 'Unassigned';
    sensorTotals.set(sensor, (sensorTotals.get(sensor) ?? 0) + 1);
    const crop = cropName(row.crop);
    cropTotals.set(crop, (cropTotals.get(crop) ?? 0) + 1);
    const day = dayInSA(row.time);
    const running = daily.get(day) ?? { total: 0, count: 0 };
    daily.set(day, { total: running.total + row.moisture, count: running.count + 1 });
    bands[row.moisture < 33 ? 0 : row.moisture < 67 ? 1 : 2] += 1;
    sum += row.moisture;
  }
  const sorted = totals => [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sensorRank = sorted(sensorTotals);
  const sensorTop = sensorRank.slice(0, 6);
  if (sensorRank.length > 6) sensorTop.push(['Other sensors', sensorRank.slice(6).reduce((total, item) => total + item[1], 0)]);
  // Break the trend across gaps without rendering thousands of empty calendar days.
  const trend = [];
  for (const day of [...daily.keys()].sort()) {
    const previous = trend.at(-1)?.[0];
    if (previous && Date.parse(day) - Date.parse(previous) > dayMs) {
      trend.push([dayInSA(Date.parse(previous) + dayMs), null]);
    }
    const item = daily.get(day);
    trend.push([day, Number((item.total / item.count).toFixed(1))]);
  }
  const charts = [
    { id: 'trend', title: 'Daily average soil moisture', category: 'Soil data', type: 'line', unit: '%',
      detail: 'A daily average shows movement over time. Gaps indicate days with no saved readings.', pairs: trend },
    { id: 'sensors', title: 'Share of readings by sensor', category: 'Sensors', type: 'doughnut', unit: '',
      detail: 'Shows which sensors contributed to the reading history.', pairs: sensorTop },
    { id: 'crops', title: 'Readings by crop', category: 'Crops', type: 'bar', unit: '',
      detail: 'Compares how many readings were recorded for each crop.', pairs: sorted(cropTotals) },
    { id: 'bands', title: 'Moisture reading bands', category: 'Soil data', type: 'doughnut', unit: '',
      detail: 'Groups recorded values into descriptive bands. These are not irrigation thresholds.',
      pairs: [['Below 33%', bands[0]], ['33% to below 67%', bands[1]], ['67% and above', bands[2]]] },
  ];
  return { charts, count: rows.length, sensorCount: sensorTotals.size, average: rows.length ? (sum / rows.length).toFixed(1) : null };
}

export function chartConfig(spec, responsive = true) {
  const line = spec.type === 'line';
  const bar = spec.type === 'bar';
  const doughnut = spec.type === 'doughnut';
  const dates = line ? spec.pairs.filter(([, value]) => value !== null).map(([day]) => Date.parse(day)) : [];
  const ticks = dates.length <= 8 ? dates : Array.from({ length: 8 }, (_, index) =>
    dates[Math.round(index * (dates.length - 1) / 7)]);
  return {
    type: spec.type,
    data: {
      labels: spec.pairs.map(([label, value]) => doughnut ? label + ' (' + value + ')' : label),
      datasets: [{
        label: line ? 'Average moisture (%)' : 'Readings',
        data: spec.pairs.map(([label, value]) => line ? { x: Date.parse(label), y: value } : value),
        backgroundColor: line ? '#24764f24' : doughnut ? spec.pairs.map((_, index) => palette[index % palette.length]) : '#24764f',
        ...(line ? { borderColor: '#24764f', pointRadius: 3, tension: 0.22, spanGaps: false } : {}),
      }],
    },
    options: {
      responsive, maintainAspectRatio: false, animation: false, indexAxis: bar ? 'y' : 'x',
      plugins: {
        legend: { display: doughnut, position: 'bottom' },
        ...(line ? { tooltip: { callbacks: {
          title: points => points.length ? new Date(points[0].parsed.x).toISOString().slice(0, 10) : '',
          label: point => 'Average moisture: ' + point.parsed.y + '%',
        } } } : {}),
      },
      ...(line ? { scales: { y: { min: 0, max: 100, ticks: { callback: value => value + '%' } },
        x: { type: 'linear',
          afterBuildTicks: axis => { axis.ticks = ticks.map(value => ({ value })); },
          ticks: { callback: value => new Date(value).toISOString().slice(5, 10) } } } } :
        bar ? { scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } } : {}),
    },
  };
}
