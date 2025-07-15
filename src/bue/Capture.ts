/// <reference path="./joulescope_driver.d.ts" />

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

    let i_sum = 0
    let v_sum = 0
    let cnt = 0

    const sampleCb = (topic: string, value: Value) => {
        if (topic.indexOf('/s/i/') != -1) {
            process.stdout.write(`\r${(cnt / 1_000_000).toFixed(3)} s ...`)
            for (const v of value.data) {
                if (cnt < LEN) {
                    buf.writeFloatLE(v, cnt * 4)
                    i_sum += v
                    cnt += 1
                } else {
                    Fs.writeFileSync('current.f32.bin', buf)
                    process.stdout.write('\r                 \rdone.\n')
                    const avg = i_sum / cnt
                    console.log(`average current = ${toEng(avg, 'A')}`)
                    // drv.publish(dev.concat('/s/i/ctrl'), 0, 0);
                    // drv.publish(dev.concat('/s/v/ctrl'), 0, 0);
                    // drv.close(dev);
                    // drv.finalize();
                    process.exit()
                }
            }
            return
        }
        if (topic.indexOf('/s/v/') != -1) {
        }
    }

    drv.open(dev);
    drv.subscribe(dev.concat("/s/i/!data"), 2, sampleCb)
    drv.subscribe(dev.concat("/s/v/!data"), 2, sampleCb)
    drv.publish(dev.concat("/s/i/ctrl"), 1, 0)
    drv.publish(dev.concat("/s/v/ctrl"), 1, 0)
}

function toEng(x: number, u: string): string {
    const exp = Math.floor(Math.log10(Math.abs(x)) / 3) * 3
    const mantissa = x / 10 ** exp
    const unit = { [-9]: ` n${u}`, [-6]: ` µ${u}`, [-3]: ` m${u}`, [0]: ` ${u}` }[exp] || `e${exp} ${u}`
    return `${mantissa.toFixed(3)}${unit}`
}
