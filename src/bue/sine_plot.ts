// sine_plot.ts
import { writeFileSync } from 'fs'

const x = Array.from({ length: 5000 }, (_, i) => i * 0.01).filter((_, i) => i % 4 === 0)
const y = x.map(t => Math.sin(2 * Math.PI * t))

const html = `
<!DOCTYPE html>
<meta charset="utf-8">
<style>
  body {
    background: #111;
    color: #eee;
    font-family: sans-serif;
    margin: 0;
    padding: 0;
  }
  #plot-container {
    width: 800px;
    height: 400px;
    margin: auto;
    padding-top: 10px;
  }
</style>
<script src="https://cdn.plot.ly/plotly-2.30.1.min.js"></script>
<body>
<div id="plot-container">
  <div id="plot" style="width:100%; height:100%"></div>
</div>
<script>
Plotly.newPlot('plot', [{
    x: ${JSON.stringify(x)},
    y: ${JSON.stringify(y)},
    mode: 'lines',
    type: 'scatter',
    line: { color: 'yellow' }
}], {
    paper_bgcolor: '#111',
    plot_bgcolor: '#111',
    font: { color: '#eee' },
    margin: { l: 50, r: 20, t: 30, b: 40 },
    xaxis: { title: 'Time (s)', color: '#eee' },
    yaxis: { title: 'Amplitude', color: '#eee' }
})
</script>
</body>
`

writeFileSync('sine.html', html)
