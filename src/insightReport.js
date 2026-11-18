import { jsPDF } from 'jspdf';
import Chart from 'chart.js/auto';
import { chartConfig, zones } from './insightData.js';

async function reportLogo() {
  const image = new Image();
  image.src = '/agrishield-logo.png';
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 840;
  canvas.height = 218;
  canvas.getContext('2d').drawImage(image, 92, 184, 840, 218, 0, 0, 840, 218);
  return canvas.toDataURL('image/png');
}

function drawChart(spec) {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 440;
  const chart = new Chart(canvas, chartConfig(spec, false));
  const image = chart.toBase64Image();
  chart.destroy();
  return image;
}

export async function saveInsightsReport({ data, charts, period, category, source }) {
  const logo = await reportLogo();
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: 'AgriShield insights report', subject: period.start + ' to ' + period.end });
  function header() {
    pdf.addImage(logo, 'PNG', 15, 12, 47, 12.2, 'agrishield-logo');
    pdf.setTextColor(25, 60, 43);
    pdf.setFontSize(19);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Insights report', 15, 34);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(period.start + ' to ' + period.end + ' (SAST)  |  ' + category + '  |  ' + zones[source], 15, 42);
    pdf.text('Readings: ' + data.count + '   Sensors reporting: ' + data.sensorCount +
      '   Average moisture: ' + (data.average === null ? 'Unavailable' : data.average + '%'), 15, 50);
    pdf.setDrawColor(210, 225, 214);
    pdf.line(15, 55, 195, 55);
  }
  header();
  let y = 65;
  for (const spec of charts) {
    const hasData = spec.pairs.some(([, value]) => value !== null && (spec.type === 'line' || value > 0));
    const height = hasData ? 101 : 27;
    if (y + height > 279) { pdf.addPage(); header(); y = 65; }
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text(spec.title, 15, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize(spec.detail, 178), 15, y + 6);
    if (hasData) pdf.addImage(drawChart(spec), 'PNG', 15, y + 13, 177, 77.9);
    else pdf.text('No readings in this period.', 15, y + 15);
    y += height;
  }
  const pages = pdf.getNumberOfPages();
  for (let index = 1; index <= pages; index++) {
    pdf.setPage(index);
    pdf.setFontSize(8);
    pdf.setTextColor(71, 88, 77);
    pdf.text('AgriShield | Available workspace readings', 15, 289);
    pdf.text(index + ' / ' + pages, 195, 289, { align: 'right' });
  }
  pdf.save('AgriShield-insights-' + period.start + '-to-' + period.end + '.pdf');
}
