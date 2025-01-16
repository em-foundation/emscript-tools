import * as Commander from 'commander'
import * as ChildProc from 'child_process'
import * as Crypto from 'crypto'
import * as Fs from 'fs'
import * as Path from 'path'

import * as Ast from './Ast'
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
    .option('-a --ast', 'display AST', false)
    .option('-l --load', 'load after build', false)
    .option('-m --meta', 'meta-program only', false)
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
CMD
    .command('parse')
    .description('display AST for a unit')
    .requiredOption('-u --unit <qualified-name>', '<package-name>/<bundle-name>/<unit-name>')
    .action((opts: any) => doParse(opts))

let t0 = Date.now()
CMD.parse(process.argv)

function doBuild(opts: any): void {
    const upath = opts.unit
    if (opts.ast) {
        doParse(opts)
        return
    }
    Session.activate(getRoot(), Session.Mode.BUILD)
    console.log(`building '${Session.mkUid(upath)}' ...`)
    Meta.parse(upath)
    Meta.exec()
    const unitCnt = Unit.units().size
    const usedCnt = Session.getUnits().size
    const t1 = mkDelta()
    Targ.generate()
    console.log(`    executed 'em$meta' program, generated 'main.cpp' using [${usedCnt}/${unitCnt}] units in ${t1} seconds`)
    if (opts.meta) return
    console.log(`compiling 'main.cpp' ...`)
    const stdout = Targ.build()
    if (stdout === null) process.exit(1)
    printSha32()
    printSize(stdout)
    const t2 = mkDelta()
    console.log(`${curTab}done in ${t2} seconds`)
    if (opts.load) doLoad(opts.unit)
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

function doParse(opts: any): void {
    const upath = opts.unit
    Session.activate(getRoot(), Session.Mode.BUILD)
    const uid = Session.mkUid(upath)
    console.log(`parsing '${uid}' ...`)
    Meta.parse(upath)
    const sf = Unit.units().get(uid!)?.sf!
    sf.statements.forEach(stmt => Ast.printTree(stmt, '    '))
}
function getRoot() {
    return Path.resolve(CMD.opts().root)
}

function mkDelta(): string {
    return ((Date.now() - t0) / 1000).toFixed(2)
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
