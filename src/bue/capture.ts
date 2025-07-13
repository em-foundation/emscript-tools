/// <reference path="./joulescope_driver.d.ts"

import Fs from 'fs'
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






// ------------------------------------

/*

const JoulescopeDriver = require("..");


function initialize(){
    const drv = new JoulescopeDriver();
    const device_paths = drv.device_paths();
    console.log('device_paths: ' + device_paths);
    if (0 == device_paths.length) {
        drv.finalize()
        return null;
    }
    let unsubs = [];

    const LEN = 3_000_000
    const buf = Buffer.allocUnsafe(LEN * 4)

    let cur_cnt = 0

    device_paths.forEach((device_path) => {
        drv.open(device_path);
        var sample_cbk = (topic, value) => {
            if (cur_cnt < LEN) {

            }

            // const avg = value['data'].reduce((accumulator, currentValue) =>
            //     accumulator + currentValue, 0) / value['data'].length;
            // console.log(topic + ' : ' + avg);
        }

        drv.publish(device_path.concat("/s/i/range/mode"), "auto");
        // drv.publish(device_path.concat("/s/v/range/mode"), "auto");

        unsubs.push(drv.subscribe(device_path.concat("/s/i/!data"), 2, sample_cbk));
        // unsubs.push(drv.subscribe(device_path.concat("/s/v/!data"), 2, sample_cbk));
        drv.publish(device_path.concat("/s/i/ctrl"), 1, 0);
        // drv.publish(device_path.concat("/s/v/ctrl"), 1, 0);
    });

    return () => {
        unsubs.forEach((unsub) => unsub());
        device_paths.forEach((device_path) => {
            drv.publish(device_path.concat('/s/i/ctrl'), 0, 0);
            // drv.publish(device_path.concat('/s/v/ctrl'), 0);
            drv.close(device_path);
        })
        drv.finalize();
    }
}

finalize_cbk = initialize();
process.on('SIGINT', finalize_cbk);
 */
