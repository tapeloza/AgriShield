import React, { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { categories, chartConfig, insightData, presetPeriod, zones } from './insightData.js';

function InsightChart({ spec }) {
  const canvas = useRef(null);
  const hasData = spec.pairs.some(([, value]) => value !== null && (spec.type === 'line' || value > 0));
  useEffect(() => {
    if (!hasData) return;
    const chart = new Chart(canvas.current, chartConfig(spec));
    return () => chart.destroy();
  }, [hasData, spec]);

  return <section className="card analytics-chart">
    <h2>{spec.title}</h2>
    <p className="monitor-note">{spec.detail}</p>
    {hasData ? <>
      <div className="chart-canvas"><canvas ref={canvas} role="img" aria-label={spec.title} /></div>
      <details>
        <summary>View chart data</summary>
        <table className="insight-table"><thead><tr><th scope="col">{spec.type === 'line' ? 'Date' : 'Category'}</th>
          <th scope="col">{spec.type === 'line' ? 'Average moisture' : 'Readings'}</th></tr></thead>
          <tbody>{spec.pairs.map(([label, value]) => <tr key={label}>
            <th scope="row">{label}</th><td>{value === null ? 'No readings' : value + spec.unit}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </> : <p>No readings in this period.</p>}
  </section>;
}

export default function Insights({ readings, cropName, children }) {
  const [category, setCategory] = useState('All');
  const [source, setSource] = useState('all');
  const [period, setPeriod] = useState(() => presetPeriod(7));
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const valid = Boolean(period.start && period.end && period.start <= period.end);
  const data = useMemo(() => insightData(readings, period, source, cropName), [readings, period, source, cropName]);
  const charts = data.charts.filter(spec => category === 'All' || spec.category === category);

  async function download() {
    setExporting(true);
    setMessage('');
    try {
      const { saveInsightsReport } = await import('./insightReport.js');
      await saveInsightsReport({ data, charts, period, category, source });
      setMessage('PDF report downloaded.');
    } catch {
      setMessage('Could not create the PDF report. Try again.');
    } finally {
      setExporting(false);
    }
  }

  return <>
    <h1>Insights</h1>
    <p className="intro">Compare farm activity and moisture trends using the readings available in this workspace.</p>
    {children}
    <section className="card analytics-filters" aria-label="Insight report filters">
      <div className="analytics-presets" role="group" aria-label="Quick periods">
        {[7, 30, 90].map(days => <button key={days} type="button" onClick={() => setPeriod(presetPeriod(days))}>Last {days} days</button>)}
      </div>
      <div className="analytics-fields">
        <div><label htmlFor="insights-start">From</label><input id="insights-start" type="date" value={period.start}
          onChange={event => setPeriod(old => ({ ...old, start: event.target.value }))} /></div>
        <div><label htmlFor="insights-end">To</label><input id="insights-end" type="date" value={period.end}
          onChange={event => setPeriod(old => ({ ...old, end: event.target.value }))} /></div>
        <div><label htmlFor="insights-source">Data source</label><select id="insights-source" value={source} onChange={event => setSource(event.target.value)}>
          {Object.entries(zones).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></div>
      </div>
      <div className="analytics-export">
        <p className="monitor-note">Dates use South African time. The PDF reflects these filters.</p>
        <button className="primary" type="button" disabled={!valid || exporting} onClick={download}>
          {exporting ? 'Preparing PDF…' : 'Download PDF report'}
        </button>
      </div>
      {(!valid || message) && <p className="feedback" role="status">{valid ? message : 'Choose a valid start and end date.'}</p>}
    </section>
    <div className="analytics-tabs" role="group" aria-label="Insight categories">
      {categories.map(label => <button type="button" key={label} aria-pressed={label === category}
        onClick={() => setCategory(label)}>{label}</button>)}
    </div>
    {valid && <>
      <dl className="insight-grid analytics-summary">
        <div className="card"><dt>Readings in period</dt><dd>{data.count}</dd></div>
        <div className="card"><dt>Sensors reporting</dt><dd>{data.sensorCount}</dd></div>
        <div className="card"><dt>Average moisture</dt><dd>{data.average === null ? '—' : data.average + '%'}</dd></div>
      </dl>
      <div className="analytics-charts">{charts.map(spec => <InsightChart key={spec.id} spec={spec} />)}</div>
    </>}
  </>;
}
