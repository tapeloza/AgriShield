import library from './library.json';

export const beds = {
  cabbage: { name: 'Cabbage Bed 1', latest: 32, previous: 39, rain: 10, guide: 'cabbage-compare' },
  tomatoes: { name: 'Tomato Bed 2', latest: 46, previous: 44, rain: 75, guide: 'tomato-log' },
  morogo: { name: 'Morogo Bed 3', latest: null, previous: 41, rain: 35, guide: 'morogo-name' },
};

export const prompts = [
  'Should I water today?',
  'What changed in the soil?',
  'Is rain expected today?',
  'What does the Local Guide say?',
];

const training = {
  water: ['water irrigation irrigate watering dry enough roots', 'should i water today', 'does this bed need water'],
  soil: ['soil moisture reading sensor trend changed percent', 'what does the sensor show', 'is moisture falling or rising'],
  weather: ['rain forecast weather chance showers rain expected', 'will it rain today', 'what is the local weather'],
  guide: ['guide knowledge iks local practice indigenous advice', 'what does the local guide say', 'where did this guidance come from'],
};
const words = (value) => value.toLowerCase().match(/[a-z]+/g) ?? [];
const model = Object.entries(training).map(([intent, examples]) => {
  const tokens = examples.flatMap(words);
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return { intent, counts, size: tokens.length };
});
const vocabulary = new Set(model.flatMap(({ counts }) => [...counts.keys()]));

export function predictIntent(question) {
  const tokens = words(question).filter(token => !['i','it','is','the','a','to','does','this','what','today','in','will','can'].includes(token));
  if (!tokens.some(token => vocabulary.has(token))) return null;
  return model.map(({ intent, counts, size }) => ({
    intent,
    score: tokens.filter(token => vocabulary.has(token)).reduce(
      (score, token) => score + Math.log(((counts.get(token) ?? 0) + 1) / (size + vocabulary.size)), 0),
  })).sort((a, b) => b.score - a.score)[0].intent;
}

export function answerQuestion(bed, question) {
  const intent = predictIntent(question);
  if (!intent) return { text: 'I can help with watering decisions, soil moisture, the sample forecast or the Local Guide. Try one of the example questions.', sources: [] };

  const entry = library.find(item => item.id === bed.guide && item.permission === 'Demo content · shareable');
  const soil = bed.latest === null
    ? 'Today’s sample soil reading is missing. Yesterday’s reading was ' + bed.previous + '%. Check the bed or take a fresh reading before deciding.'
    : 'Sample soil moisture ' + (bed.latest < bed.previous ? 'fell' : 'rose') + ' from ' + bed.previous + '% yesterday to ' + bed.latest + '% this morning.';
  const weather = 'Today’s sample forecast gives a ' + bed.rain + '% chance of rain.';
  const guidance = bed.latest !== null && bed.rain >= 65
    ? 'Check soil near the roots and reassess after any rain before deciding whether to water.'
    : 'Check soil near the roots before deciding whether to water.';
  const guide = entry?.body ?? 'A shareable guide entry is unavailable for this bed.';
  const answer = {
    water: [soil, weather, bed.latest === null ? '' : guidance, guide],
    soil: [soil, guide],
    weather: [weather, soil, bed.latest === null ? '' : guidance],
    guide: [guide, soil, weather],
  };
  const sources = [
    'Sensor history · Sample observations for yesterday and today',
    'Weather · Sample forecast for today',
    ...(entry ? [entry.title + ' · ' + entry.source + ' · ' + entry.permission] : []),
  ];
  return { text: answer[intent].filter(Boolean).join(' '),
    sources: intent === 'soil' ? sources.filter((_, i) => i !== 1)
      : intent === 'weather' ? sources.slice(0, 2) : sources };
}
