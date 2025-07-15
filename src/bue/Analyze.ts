import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const UnitToMicro = 1000000

export enum SigKind {
    Current = 'current'
}

export type Values = Readonly<Float32Array>

export interface Marker {
    sample_offset: number
    sample_count: number
}

export class Options {
    readonly sample_rate: number = 1_000_000 // 1 MHz
    readonly event_thresh: number = 0.0001
    readonly voltage: number = 3.3
    readonly kernel_length = 20
    event_min_dt: number = 0.001 // 1 ms
    dir = '.'
    data_source = ''
    constructor(init?: Partial<Options>) {
        Object.assign(this, init)
    }
}

export class Signal {
    private static units = new Map<SigKind, string>([
        [SigKind.Current, 'A']
    ])
    private data: Float32Array<ArrayBuffer>

    constructor(readonly kind: SigKind, dir: string = '.', readonly opts: Options = new Options) {
        this.opts.dir = dir
        this.opts.data_source = resolve(dir, `${kind}.f32.bin`)
        const buf = readFileSync(this.opts.data_source)
        const cnt = buf.length / 4
        this.data = new Float32Array(cnt)
        for (let i = 0; i < cnt; i++) {
            this.data[i] = buf.readFloatLE(i * 4)
        }
    }

    get elapsed_seconds(): number { return this.data.length / this.opts.sample_rate }
    get data_source(): string { return this.opts.data_source }
    get kernel_length(): number { return this.opts.kernel_length }
    get number_of_samples(): number { return this.data.length }
    get sample_average(): number { return this.sample_total / this.data.length }
    get sample_rate(): number { return this.opts.sample_rate }
    get sample_total(): number { return this.data.reduce((a, b) => a + b, 0) }
    get units(): string { return Signal.units.get(this.kind)! }
    get values(): Values { return this.data }
    get voltage(): number { return this.opts.voltage }

    convolve1D(kernel: number[]): number[] {
        const input = this.data
        const output = new Array(input.length + kernel.length - 1).fill(0);
        for (let i = 0; i < input.length; i++) {
            for (let j = 0; j < kernel.length; j++) {
                output[i + j] += input[i] * kernel[j];
            }
        }
        return output;
    }

    findEvents(): Marker[] {
        const thresh = this.opts.event_thresh
        const dt = this.opts.event_min_dt
        const min_width = Math.round(dt * this.opts.sample_rate)
        let res = new Array<Marker>()
        let in_event = false
        let sample_offset = 0
        const kernel = new Array(this.opts.kernel_length).fill(1.0 / this.opts.kernel_length)
        this.convolve1D(kernel).forEach((val, i) => {
            if (!in_event && val >= thresh) {
                in_event = true
                sample_offset = i
            } else if (in_event && val < thresh) {
                const width = i - sample_offset
                if (width >= min_width &&
                    sample_offset >= (0.5 * this.opts.sample_rate) &&
                    i < (this.number_of_samples - 0.5 * this.opts.sample_rate)
                ) {
                    res.push({
                        sample_offset: sample_offset - 2 * this.opts.kernel_length,
                        sample_count: width + 3 * this.opts.kernel_length
                    })
                }
                in_event = false
            }
        })
        return res
    }
}

export function exec(opts: any) {
    const I_sig = new Signal(SigKind.Current)
    const events = I_sig.findEvents()
    console.log(`*** Analyzing ${I_sig.opts.data_source} ***`)
    console.log(`Sample Rate = ${I_sig.sample_rate.toLocaleString()} Hz`)
    console.log(`Voltage = ${I_sig.voltage} V`)
    console.log(`Number of Samples = ${I_sig.number_of_samples.toLocaleString()}`)
    console.log(`Elapsed time = ${I_sig.elapsed_seconds} S`)
    console.log(`Average current = ${I_sig.sample_average * UnitToMicro} uA`)
    console.log(`Average power consumption = ${I_sig.sample_average * UnitToMicro * I_sig.voltage} uW`)
    const eventTimes = events.map(evt => ({
        offset_s: evt.sample_offset / I_sig.sample_rate,
        duration_us: evt.sample_count * UnitToMicro / I_sig.sample_rate
    }))
    console.log(`Events Detected (${eventTimes.length}): ${JSON.stringify(eventTimes, null, 2)}`)
    const filename = resolve(I_sig.opts.dir, 'current.json')
    writeFileSync(filename, JSON.stringify({
        opts: I_sig.opts,
        number_of_samples: I_sig.values.length,
        elapsed_seconds: I_sig.elapsed_seconds,
        average_current: I_sig.sample_average,
        average_power: I_sig.sample_average * I_sig.voltage,
        number_of_events: events.length,
        events: events,
        sample_data: I_sig.values
    }, null, 2))
    console.log(`Wrote JSON data to ${filename}`)
}
