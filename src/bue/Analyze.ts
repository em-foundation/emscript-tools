import { readFileSync, writeFileSync } from 'fs'
import { relative, resolve } from 'path'

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
    data_source = ''
    dir = '.'
    readonly event_min_dt: number = 0.001 // 1 ms
    readonly event_rate: number = 1 // Hz
    readonly event_thresh: number = 0.0001
    readonly kernel_length = 20
    readonly sample_rate: number = 1_000_000 // 1 MHz
    readonly voltage: number = 3.3

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
    get event_rate(): number { return this.opts.event_rate }
    get kernel_length(): number { return this.opts.kernel_length }
    get number_of_samples(): number { return this.data.length }
    get sample_average(): number { return this.sample_total / this.data.length }
    get sample_margin(): number { return this.opts.sample_rate * 0.5 / this.event_rate }
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
                    sample_offset >= this.sample_margin &&
                    i < this.number_of_samples - this.sample_margin
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
    console.log(`Analyzing ${relative('.', I_sig.opts.data_source)}`)
    const events = I_sig.findEvents()
    const eventTimes = events.map(evt => ({
        offset_s: evt.sample_offset / I_sig.sample_rate,
        duration_us: evt.sample_count * UnitToMicro / I_sig.sample_rate
    }))
    if (events.length > I_sig.values.length / I_sig.sample_rate) {
        throw new Error('Bad input file.  Too many events')
    }
    const startOffset = events[0].sample_offset - I_sig.sample_margin
    const endOffset = startOffset + events.length * I_sig.sample_rate
    const goodSamples = I_sig.values.slice(startOffset, endOffset)
    const goodSampleTotal = goodSamples.reduce((a, b) => a + b, 0)
    const goodSampleAverage = goodSampleTotal / goodSamples.length
    const averageEventDuration = events.reduce((a, b) => a + b.sample_count, 0) / events.length
    console.log(`Events Detected: ${eventTimes.length}, Average Duration: ${averageEventDuration}`)
    const outputJson = JSON.stringify({
        analysis_time: new Date().toISOString(),
        opts: I_sig.opts,
        number_of_samples_averaged: goodSamples.length,
        number_of_samples_total: I_sig.values.length,
        elapsed_seconds_averaged: goodSamples.length / I_sig.sample_rate,
        elapsed_seconds_total: I_sig.values.length / I_sig.sample_rate,
        average_current: goodSampleAverage,
        average_power: goodSampleAverage * I_sig.voltage,
        average_event_sample_count: averageEventDuration,
        number_of_events: events.length,
        events: events
    }, null, 2)
    const filename = resolve(I_sig.opts.dir, 'analysis_results.json')
    writeFileSync(filename, outputJson)
    console.log(`Analysis results in ${relative('.', filename)}`)
}
