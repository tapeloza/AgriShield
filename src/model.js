export const crops = {
  tomatoes: { name: 'Tomatoes', range: [40, 65] },
  cabbage: { name: 'Cabbage', range: [45, 70] },
  morogo: { name: 'Morogo', range: [35, 60] },
};

export const demoReadings = {
  dry: { label: 'Dry', moisture: 32, ph: 6.1, temperature: 28, rainfall: 0, nutrients: 'Low' },
  steady: { label: 'In range', moisture: 52, ph: 6.5, temperature: 24, rainfall: 2, nutrients: 'Typical' },
  wet: { label: 'Wet', moisture: 81, ph: 6.8, temperature: 21, rainfall: 18, nutrients: 'Typical' },
};

export const tankCapacity = 5000;

export function irrigationDemand(moisture, [low, high], previous = false) {
  if (moisture < low) return true;
  if (moisture > high) return false;
  return previous;
}

export function irrigationStatus(value, [low, high]) {
  if (value < low) return { label: 'Below demo range', tone: 'dry' };
  if (value > high) return { label: 'Above demo range', tone: 'wet' };
  return { label: 'Within demo range', tone: 'steady' };
}

export async function fetchReading(sensorId) {
  const response = await fetch('/api/moisture?sensor=' + encodeURIComponent(sensorId), {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Endpoint unavailable');
  }
  const { moisture, source, sensorId: receivedId } = await response.json();
  if (receivedId !== sensorId) throw new Error('Sensor ID mismatch');
  if (!Number.isFinite(moisture) || moisture < 0 || moisture > 100 ||
      !['mock', 'esp32'].includes(source)) throw new Error('Unexpected payload');
  return { moisture, source };
}
