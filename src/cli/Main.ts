import * as Commander from 'commander'
import * as ChildProc from 'child_process'
import * as Crypto from 'crypto'
import * as Fs from 'fs'
import * as Path from 'path'

import * as Format from './Format'
import * as Meta from './Meta'
import * as Session from './Session'
import * as Targ from './Targ'
import * as Unit from './Unit'

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
    doBuildMeta(opts.unit)
    doBuildTarg(opts.unit)
    const dt = ((Date.now() - t0) / 1000).toFixed(2)
    console.log(`${curTab}done in ${dt} seconds`)
    if (opts.load) doLoad(opts.unit)
}

function doBuildMeta(upath: string) {
    console.log(`building '${Session.mkUid(upath)}' ...`)
    Meta.parse(upath)
    Meta.exec()
    printDom('meta')
    const unitCnt = Unit.units().size
    const usedCnt = Session.getUnits().size
    console.log(`    parsed ${unitCnt} units, translated ${usedCnt} units`)
}

function doBuildTarg(upath: string) {
    Targ.generate()
    const stdout = Targ.build()
    printDom('targ')
    printSha32()
    printSize(stdout)
}

function doClean(opts: any): void {
    Session.activate(getRoot(), Session.Mode.CLEAN)
    console.log('cleaned')
}

function doFormat(opts: any): void {
    Format.exec(opts.unit)
}

function doLoad(upath: string) {
    console.log(`loading '${Session.mkUid(upath)}'...`)
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

function printDom(dom: string) {
    console.log(`  em$${dom} {}`)
}

function printSha32() {
    const txt = Fs.readFileSync(Path.join(Session.getBuildDir(), '.out', 'main.out.hex'), 'utf-8')
    const hash = Crypto.createHash('sha256').update(txt).digest('hex').slice(0, 8)
    console.log(`    image sha32: ${hash}`)
}

function printSize(stdout: string) {
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
