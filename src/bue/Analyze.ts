import Fs from 'fs'
import Path from 'path'

type Sig = Float32Array<ArrayBuffer>

type SigKind = 'current' | 'voltage'

const sig_units = new Map<SigKind, string>([
    ['current', 'A'],
    ['voltage', 'V'],
])

interface Marker {
    start: number
    end: number
}

class Signal {
    private data: Float32Array<ArrayBuffer>
    constructor(readonly kind: SigKind, readonly rate: number = 1_000_000, dir: string = '.') {
        const buf = Fs.readFileSync(Path.join(dir, `${kind}.bin`))
        const cnt = buf.length / 4
        this.data = new Float32Array(cnt)
        for (let i = 0; i < cnt; i++) {
            this.data[i] = buf.readFloatLE(i * 4)
        }
    }
    get duration(): number { return this.length / this.rate }
    get length(): number { return this.data.length }
    get units(): string { return sig_units.get(this.kind)! }
    average(): number {
        const sum = this.data.reduce((a, b) => a + b, 0)
        const avg = sum / this.length
        return avg
    }
    findEvents(thresh: number, dt: number): Marker[] {
        let res = new Array<Marker>()
        let in_event = false
        let start = 0
        const min_width = Math.round(dt * this.rate)
        for (let i = 0; i < this.length; i++) {
            const val = this.data[i]
            if (!in_event && val >= thresh) {
                in_event = true
                start = i
            } else if (in_event && val < thresh) {
                if (i - start >= min_width) {
                    res.push({ start: start, end: i })
                }
                in_event = false
            }
        }
        return res
    }
}

export function exec(opts: any) {
    const I_sig = new Signal('current')
    console.log(`length = ${I_sig.length}`)
    console.log(`duration = ${I_sig.duration} s`)
    console.log(`average = ${toEng(I_sig.average(), I_sig.units)}`)
    for (const [i, evt] of I_sig.findEvents(0.0001, 0.001).entries()) {
        console.log(`event ${i}: ${evt.end - evt.start} µs`)
    }
}

function toEng(x: number, u: string): string {
    const exp = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    const mantissa = x / 10 ** exp
    const unit = { [-9]: ` n${u}`, [-6]: ` µ${u}`, [-3]: ` m${u}`, [0]: ` ${u}` }[exp] || `e${exp} ${u}`
    return `${mantissa.toFixed(3)}${unit}`
}

