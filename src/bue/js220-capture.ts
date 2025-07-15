/// <reference path="./joulescope_driver.d.ts" />

import * as Fs from 'fs'
import JoulescopeDriver, { Value } from 'joulescope_driver'

const drv = new JoulescopeDriver

const dev = drv.device_paths()[0]

if (!dev) {
    console.error("*** no connected joulescope")
    drv.finalize()
    process.exit(1)
}

function initialize() {

    let unsubs: any[] = [];

    const LEN = 3_500_000
    let buf = Buffer.allocUnsafe(LEN * 4)

    let cur_cnt = 0

    drv.open(dev);
    const sample_cbk = (topic: string, value: Value) => {
        console.log(cur_cnt)
        for (const v of value.data) {
            if (cur_cnt < LEN) {
                buf.writeFloatLE(v, cur_cnt * 4)
                cur_cnt += 1
            } else {
                console.log('write file')
                Fs.writeFileSync('capture.f32', buf)
                drv.publish(dev.concat('/s/i/ctrl'), 0, 0);
                drv.close(dev);
                drv.finalize();
                process.exit()
            }
        }
    }
    drv.publish(dev.concat("/s/i/range/mode"), "auto");
    unsubs.push(drv.subscribe(dev.concat("/s/i/!data"), 2, sample_cbk));
    drv.publish(dev.concat("/s/i/ctrl"), 1, 0);
    return () => {
        unsubs.forEach((unsub) => unsub());
        drv.publish(dev.concat('/s/i/ctrl'), 0, 0);
        drv.close(dev);
        drv.finalize();
    }
}

const finalize_cbk = initialize();
process.on('SIGINT', finalize_cbk);
