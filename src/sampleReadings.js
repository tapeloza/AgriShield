const series = [52, 49, 42, 37, 41, 58, 65, 61, 53, 47, 44, 57];

export function sampleReadings(sensorId, crop, source, offset = 0) {
  const latest = Date.now() - 60 * 60 * 1000;
  return series.map((value, index) => ({
    id: 'sample-' + sensorId + '-' + index,
    sensorId, crop, source, moisture: value + offset,
    time: latest - index * 6 * 60 * 60 * 1000,
  }));
}

export function mergeSampleHistory(history, samples) {
  const ids = new Set(samples.map(item => item.id));
  const counts = new Map();
  return [...history.filter(item => !ids.has(item.id)), ...samples]
    .sort((left, right) => right.time - left.time)
    .filter(item => {
      const sensorId = item.sensorId ?? 'AS-001';
      const count = counts.get(sensorId) ?? 0;
      counts.set(sensorId, count + 1);
      return count < 30;
    });
}
