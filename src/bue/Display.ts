import * as Analyze from './Analyze'

import Fs from 'fs'

const PRE = 300

export function exec(opts: any) {
    const I_sig = new Analyze.Signal('current')
    const event = I_sig.findEvents()[0]     // TODO: assuming event #0
    const vals = I_sig.values
    const html = genHtml(vals.slice(event.start - PRE, event.start + 5100), 2)
    Fs.writeFileSync('event.html', html)
}

function decimate<T>(factor: number, data: T[]): T[] {
    return data.filter((_, i) => i % factor === 0)
}

function genHtml(signal: Analyze.Values, down_sample: number = 1): string {
    const x_data = decimate(down_sample, Array.from({ length: signal.length }, (_, i) => (i - PRE) * 0.001))
    const y_data = decimate(down_sample, Array.from(signal).map(y => y * 1000))
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
    width: 680px;
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
    x: ${JSON.stringify(x_data)},
    y: ${JSON.stringify(y_data)},
    mode: 'lines',
    type: 'scatter',
    line: {
        color: 'yellow',
        width: 1,
    }
}], {
    paper_bgcolor: '#111',
    plot_bgcolor: '#111',
    font: { color: '#eee' },
    margin: { l: 50, r: 20, t: 30, b: 40 },
    xaxis: {
        title: 'ms',
        side: 'top',
        color: '#eee',
        tickmode: 'array',
        tickvals: [0, 1, 2, 3, 4, 5],
        ticktext: ['0', '1', '2', '3', '4', '5'],
        showgrid: true,
        gridcolor: '#444',
        gridwidth: 1,
        minor: {
            tickmode: 'linear',
            tick0: 0,
            dtick: 0.2,
            showgrid: true,
            gridcolor: '#333',
            gridwidth: 1
        }
    },
    yaxis: {
        title: 'mA',
        color: '#eee',
        range: [-0.5, 10],
        fixedrange: true,
        gridcolor: '#444',
        zeroline: true,
        zerolinecolor: '#444',
        zerolinewidth: 1
    }
})
</script>
</body>

`
    return html
}
