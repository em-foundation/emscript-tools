import Fs from 'fs'

const buf = Fs.readFileSync('current.bin')
const cnt = buf.length / 4
const current = new Float32Array(cnt)

for (let i = 0; i < cnt; i++) {
    current[i] = buf.readFloatLE(i * 4)
}

let event_tab = new Array<number>()

const threshold = 0.0001  // 100 uA
const minWidth = 1000  // samples = 1000 µs = 1 ms
let inEvent = false, start = 0

for (let i = 0; i < current.length; i++) {
    const val = current[i]
    if (!inEvent && val >= threshold) {
        inEvent = true
        start = i
    } else if (inEvent && val < threshold) {
        if (i - start >= minWidth) {
            console.log(`event: ${i - start} µs`)
            event_tab.push(start)
        }
        inEvent = false
    }
}

const PRE = 300

genHtml(current.slice(event_tab[0] - PRE, event_tab[0] + 5100), 2)

function decimate<T>(factor: number, data: T[]): T[] {
    return data.filter((_, i) => i % factor === 0)
}

function genHtml(signal: Float32Array, down_sample: number = 1) {
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


// xaxis: {
//     title: 'ms',
//     color: '#eee',
//     side: 'top',
//     tickmode: 'array',
//     tickvals: [0, 1, 2, 3, 4, 5],
//     ticktext: ['0', '1', '2', '3', '4', '5'],
//     showgrid: true,
//     gridcolor: '#444',
//     gridwidth: 1,
//     ticks: 'inside',
//     ticklen: 6,
//     zeroline: true,
//     zerolinecolor: '#444',
//     zerolinewidth: 1,
//     tick0: 0,
//     dtick: 0.2
// },
// 

// xaxis: {
//     title: 'Time (ms)',
//     color: '#eee',
//     gridcolor: '#444',
//     zeroline: true,
//     zerolinecolor: '#444',
//     zerolinewidth: 1,
//     tick0: 0,
//     dtick: 0.2,  // 200 µs = 0.2 ms
//     tickvals: Array.from({ length: 6 }, (_, i) => i * 1),  // 0 to 5 ms
//     ticktext: ['0', '1', '2', '3', '4', '5']
// },

// xaxis: {
//     title: 'ms',
//     color: '#eee',
//     side: 'top',
//     tick0: -0.2,
//     dtick: 0.2,
//     tickmode: 'linear',
//     showgrid: true,
//     gridcolor: '#444',
//     gridwidth: 1,
//     ticks: 'inside',
//     ticklen: 6,
//     zeroline: true,
//     zerolinecolor: '#444',
//     zerolinewidth: 1,
//     tickvals: [0, 1, 2, 3, 4, 5],         // label positions only
//     ticktext: ['0', '1', '2', '3', '4', '5']  // corresponding text
// },
// 

    // xaxis: {
    //     title: 'ms',
    //     color: '#eee',
    //     gridcolor: '#444',
    //     zeroline: true,
    //     zerolinecolor: '#444',
    //     zerolinewidth: 1,
    //     tick0: -0.2,
    //     dtick: 0.2,
    //     tickvals: Array.from({ length: 6 }, (_, i) => i * 1),  // 0 to 5 ms
    //     ticktext: ['0', '1', '2', '3', '4', '5'],
    //     showgrid: true,
    //     ticks: 'inside',
    //     ticklen: 6
    // },
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
    Fs.writeFileSync('event.html', html)
}



// const fs = 1_000_000  // samples per second
// for (let i = 0; i < current.length; i += fs) {
//     const window = current.slice(i, i + fs)
//     const sum = window.reduce((a, b) => a + b, 0)
//     const avg = sum / window.length
//     console.log(`t = ${i / fs}s: avg = ${toEngLabel(avg)}`)
// }

// const sum = current.reduce((a, b) => a + b, 0)
// const avg = sum / current.length
// 
// console.log('avg current:', toEng(avg))

function toEngLabel(x: number): string {
    const exp = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    const mantissa = x / 10 ** exp
    const unit = { [-9]: ' nA', [-6]: ' µA', [-3]: ' mA', [0]: ' A' }[exp] || `e${exp} A`
    return `${mantissa.toFixed(3)}${unit}`
}
