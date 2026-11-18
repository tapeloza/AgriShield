export const crops = {
  tomatoes: { name: 'Tomatoes', range: [40, 65] },
  cabbage: { name: 'Cabbage', range: [45, 70] },
  morogo: { name: 'Morogo', range: [35, 60] },
};

export const demoReadings = {
  dry: { label: 'Dry', moisture: 24 },
  steady: { label: 'In range', moisture: 52 },
  wet: { label: 'Wet', moisture: 81 },
};

export function irrigationStatus(value, [low, high]) {
  if (value < low) return { label: 'Below demo range', tone: 'dry' };
  if (value > high) return { label: 'Above demo range', tone: 'wet' };
  return { label: 'Within demo range', tone: 'steady' };
}

export async function fetchReading() {
  const response = await fetch('/api/moisture', {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Endpoint unavailable');
  }
  const { moisture, source } = await response.json();
  if (!Number.isFinite(moisture) || moisture < 0 || moisture > 100 ||
      !['mock', 'esp32'].includes(source)) throw new Error('Unexpected payload');
  return { moisture, source };
}
