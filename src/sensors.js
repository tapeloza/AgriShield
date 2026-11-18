export const firstId = 'AS-001';
export const initialSensors = [
  { id: firstId, plot: 'North Plot', bed: 'Bed 3', landmark: 'Third row from the pump', scenario: 'steady' },
  { id: 'AS-002', plot: 'South Plot', bed: 'Bed 1', landmark: 'Along the lower fence', scenario: 'dry' },
];
export const validSensorId = /^[A-Z0-9][A-Z0-9-]{1,31}$/;
const requested = new URLSearchParams(location.search).get('sensor')?.toUpperCase();
export const requestedSensor = validSensorId.test(requested ?? '') ? requested : '';

export function sensorPath(path, id = requestedSensor) {
  return id ? path + '?sensor=' + encodeURIComponent(id) : path;
}
