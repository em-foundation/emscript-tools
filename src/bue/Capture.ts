import JoulescopeDriver, { Value } from 'joulescope_driver'

import Fs from 'fs'

export function exec(opts: any) {
    const drv = new JoulescopeDriver
    const dev = drv.device_paths()[0]
    if (!dev) {
        console.error("*** no connected joulescope")
        drv.finalize()
        process.exit(1)
    }

    let unsubs: any[] = [];

    const LEN = Math.round(opts.seconds * 1_000_000)

    let buf = Buffer.allocUnsafe(LEN * 4)

    let i_cnt = 0
    let i_sum = 0
    let v_cnt = 0
    let v_sum = 0

    const sampleCb = (topic: string, value: Value) => {
        if (i_cnt >= LEN && v_cnt >= LEN) {
            Fs.writeFileSync('current.f32.bin', buf)
            process.stdout.write('\r                 \rdone.\n')
            const avg = i_sum / i_cnt
            console.log(`average current = ${toEng(i_sum / i_cnt, 'A')}`)
            console.log(`average voltage = ${toEng(v_sum / v_cnt, 'V')}`)
            // drv.publish(dev.concat('/s/i/ctrl'), 0, 0);
            // drv.publish(dev.concat('/s/v/ctrl'), 0, 0);
            // drv.close(dev);
            // drv.finalize();
            process.exit()

        }
        if (topic.indexOf('/s/i/') != -1) {
            process.stdout.write(`\r${(i_cnt / 1_000_000).toFixed(3)} s ...`)
            for (const v of value.data) {
                if (i_cnt < LEN) {
                    buf.writeFloatLE(v, i_cnt * 4)
                    i_sum += v
                    i_cnt += 1
                }
            }
            return
        }
        if (topic.indexOf('/s/v/') != -1) {
            for (const v of value.data) {
                if (v_cnt < LEN) {
                    v_sum += v
                    v_cnt += 1
                }
            }
            return
        }
    }

    drv.open(dev);
    drv.subscribe(dev.concat("/s/v/!data"), 2, sampleCb)
    drv.subscribe(dev.concat("/s/i/!data"), 2, sampleCb)
    drv.publish(dev.concat("/s/i/ctrl"), 1, 0)
    drv.publish(dev.concat("/s/v/ctrl"), 1, 0)
}

function toEng(x: number, u: string): string {
    const exp = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    const mantissa = x / 10 ** exp
    const unit = { [-9]: ` n${u}`, [-6]: ` µ${u}`, [-3]: ` m${u}`, [0]: ` ${u}` }[exp] || `e${exp} ${u}`
    return `${mantissa.toFixed(3)}${unit}`
}
