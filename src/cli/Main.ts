import * as Commander from 'commander'
import * as ChildProc from 'child_process'
import * as Path from 'path'

import * as Format from './Format'
import * as Session from './Session'

let curTab = ""

const CMD = new Commander.Command('emscript')

CMD
    .version("0.0.1")
    .option('--root <dir>', 'project root directory', '..')
CMD
    .command('build')
    .description('build a unit')
    .option('-l --load', 'load after build', false)
    .requiredOption('-u --unit <qualified-name>', '<package-name>/<bundle-name>/<unit-name>')
    .action((opts: any) => doBuild(opts))
CMD
    .command('clean')
    .description('clean a bundle')
    .action((opts: any) => doClean(opts))
CMD
    .command('fmt')
    .description('format a unit')
    .requiredOption('-u --unit <qualified-name>', '<package-name>/<bundle-name>/<unit-name>')
    .action((opts: any) => doFormat(opts))

CMD.parse(process.argv)

function doBuild(opts: any): void {
    let t0 = Date.now()
    Session.activate(getRoot(), Session.Mode.BUILD)
    console.log(`${curTab}building META ...`)
    const $$units = Session.buildMeta(opts.unit)
    console.log(`${curTab}building TARG ...`)
    const stdout = Session.buildTarg($$units)
    printSizes(stdout)
    const dt = ((Date.now() - t0) / 1000).toFixed(2)
    console.log(`${curTab}done in ${dt} seconds`)
    if (opts.load) doLoad()
}

function doClean(opts: any): void {
    Session.activate(getRoot(), Session.Mode.CLEAN)
    console.log('cleaned')
}

function doFormat(opts: any): void {
    Format.exec(opts.unit)
}

function doLoad() {
    console.log('loading ...')
    let proc = ChildProc.spawnSync('./load.sh', [], { cwd: Session.getBuildDir(), shell: Session.getShellPath() })
    if (proc.status != 0) {
        console.error('*** loader failed')
        process.exit(1)
    }
    console.log('done')
}

function getRoot() {
    return Path.resolve(CMD.opts().root)
}

function printSizes(stdout: string) {
    const lines = stdout.split('\n').filter(ln => ln.match(/^\s*\d/))
    const map = new Map<string, number>([
        ['.text', 0],
        ['.const', 0],
        ['.data', 0],
        ['.bss', 0],
    ])
    lines.forEach(ln => {
        const words = ln.split(/\s+/)
        const sect = words[2]
        if (map.has(sect)) map.set(sect, Number('0x' + words[3]))
    })
    const textSz = map.get('.text')
    const constSz = map.get('.const')
    const dataSz = map.get('.data')
    const bssSz = map.get('.bss')
    console.log(`    image size: text (${textSz}) + const (${constSz}) + data (${dataSz}) + bss (${bssSz})`)
}
