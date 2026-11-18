const places = [
  { names: /\b(nelspruit|mbombela)\b/i, label: 'Mbombela (Nelspruit)', lat: -25.4745, lng: 30.9703 },
  { names: /\bpolokwane\b/i, label: 'Polokwane', lat: -23.9045, lng: 29.4689 },
  { names: /\btzaneen\b/i, label: 'Tzaneen', lat: -23.8332, lng: 30.1635 },
  { names: /\bbushbuckridge\b/i, label: 'Bushbuckridge', lat: -24.8325, lng: 31.0687 },
];

export function googleEmbedUrl(value) {
  const text = value.trim();
  const candidate = text.startsWith('<')
    ? text.match(/<iframe\b[^>]*\s+src\s*=\s*["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&')
    : text;
  if (!candidate || candidate.length > 2048) return '';
  try {
    const url = new URL(candidate);
    if (url.origin !== 'https://www.google.com' || url.pathname !== '/maps/embed' ||
        url.username || url.password || !url.searchParams.get('pb')) return '';
    return 'https://www.google.com/maps/embed?' + new URLSearchParams({ pb: url.searchParams.get('pb') });
  } catch {
    return '';
  }
}

export function sensorMap(sensor, apiKey) {
  const plot = sensor.plot + ', South Africa';
  const external = 'https://www.google.com/maps/search/?' + new URLSearchParams({ api: '1', query: plot });
  const custom = googleEmbedUrl(sensor.mapEmbed ?? '');
  if (custom) return { src: custom, external, note: 'Saved Google Maps location.' };
  if (apiKey) {
    const src = 'https://www.google.com/maps/embed/v1/place?' + new URLSearchParams({ key: apiKey, q: plot });
    return { src, external, note: 'Google Maps search for the plot name. Save a shared embed for an exact sensor pin.' };
  }
  const place = places.find(item => item.names.test(sensor.plot));
  const bbox = place
    ? [place.lng - 0.19, place.lat - 0.13, place.lng + 0.19, place.lat + 0.13]
    : [27, -26.8, 32.6, -21.8];
  const query = new URLSearchParams({ bbox: bbox.join(','), layer: 'mapnik' });
  if (place) query.set('marker', [place.lat, place.lng].join(','));
  return {
    src: 'https://www.openstreetmap.org/export/embed.html?' + query,
    external,
    note: place ? 'Approximate town location · ' + place.label : 'Regional map · no exact sensor pin saved.',
  };
}
