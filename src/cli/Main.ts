#!/usr/bin/env node

import * as Commander from 'commander'
import * as ChildProc from 'child_process'
import * as Crypto from 'crypto'
import * as Fs from 'fs'
import * as Path from 'path'

import * as Ast from './Ast'
import * as Format from './Format'
import * as Markdown from './Markdown'
import * as Meta from './Meta'
import * as Prettier from './Prettier'
import * as Props from './Props'
import * as Render from './Render'
import * as SemTokens from './SemTokens'
import * as Session from './Session'
import * as Targ from './Targ'
import * as Tracks from './Tracks'
import * as Unit from './Unit'

declare global {
    const $$tdefs: Map<string, string>
    const $$units: Map<string, any>
}


(global as any).$$tdefs = new Map();
(global as any).$$units = new Map();

let curTab = ''

const CMD = new Commander.Command('emscript')

CMD.version(Session.version()).option(
    '--root <dir>',
    'project root directory',
    '..'
)
CMD.command('build')
    .description('build a unit')
    .option('-a --ast', 'display AST', false)
    .option('-l --load', 'load after build', false)
    .option('-m --meta', 'meta-program only', false)
    .option(
        '-S --setup-properties <setup-name>',
        `add definitions '<setup-name>-setup.properties'`
    )
    .requiredOption(
        '-u --unit <qualified-name>',
        '<package-name>/<bucket-name>/<unit-name>'
    )
    .action((opts: any) => doBuild(opts))
CMD.command('clean')
    .description('clean this workspace')
    .action((opts: any) => doClean(opts))
CMD.command('config')
    .description('auto configure this project')
    .option(
        '-S --setup-properties <setup-name>',
        `add definitions '<setup-name>-setup.properties'`
    )
    .action((opts: any) => doConfig(opts))
CMD.command('fmt')
    .description('format a unit')
    .requiredOption(
        '-u --unit <qualified-name>',
        '<package-name>/<bucket-name>/<unit-name>'
    )
    .action((opts: any) => doFormat(opts))
CMD.command('genregs')
    .description('generate distro REGS unit')
    .requiredOption(
        '-d --distro <qualified-name>',
        '<package-name>/<distro-bucket-name>'
    )
    .action((opts: any) => doGenRegs(opts))
CMD.command('grammar')
    .description('generate HTML file of language grammar')
    .option('-o, --outdir <dir>', 'output directory', '.')
    .action((opts: any) => doGrammar(opts))
CMD.command('load')
    .description('load program')
    .action((opts: any) => doLoad(opts))

CMD.command('markdown')
    .description('generate markdown for a package')
    .requiredOption('-o, --outdir <dir>', 'output directory', '.')
    .requiredOption('-p, --package <dir>', 'package directory', '.')
    .option(
        '-S --setup-properties <setup-name>',
        `add definitions '<setup-name>-setup.properties'`
    )
    .action((opts: any) => doMarkdown(opts))
CMD.command('parse')
    .description('display AST for a unit')
    .requiredOption(
        '-u --unit <qualified-name>',
        '<package-name>/<bucket-name>/<unit-name>'
    )
    .action((opts: any) => doParse(opts))
CMD.command('prettier')
    .description("format using 'prettier'")
    .requiredOption(
        '-u --unit <qualified-name>',
        '<package-name>/<bucket-name>/<unit-name>'
    )
    .action((opts: any) => doPrettier(opts))
CMD.command('properties')
    .description('display workspace properties')
    .option(
        '-S --setup-properties <setup-name>',
        `add definitions '<setup-name>-setup.properties'`
    )
    .action((opts: any) => doProperties(opts))
CMD.command('render')
    .description('render a unit')
    .requiredOption(
        '-u --unit <qualified-name>',
        '<package-name>/<bucket-name>/<unit-name>'
    )
    .option('--verbose', 'additional output', false)
    .action((opts: any) => doRender(opts))
CMD.command('semtoks')
    .description('generate token metadata for the workspace')
    .action((opts: any) => doSemToks(opts))

let t0 = Date.now()
CMD.parse(process.argv)

function doBuild(opts: any): void {
    const upath = opts.unit
    if (!Fs.existsSync(upath)) {
        console.error(`*** unit '${upath}' not found`)
        process.exit(1)
    }
    if (opts.ast) {
        doParse(opts)
        return
    }
    if (opts.setupProperties) {
        const cwd = process.cwd()
        doConfig(opts)
        process.chdir(cwd)
    }
    Session.activate(
        getRootDir(),
        Session.Mode.BUILD,
        opts.setupProperties ?? ''
    )
    Props.bindProg(Session.mkUid(upath))
    if (!Props.getSetup()) {
        console.error('*** no setup defined')
        process.exit(1)
    }
    printProgress('building', true)
    Meta.parse(upath)
    Meta.exec()
    const unitCnt = Unit.units().size
    const usedCnt = Session.getUnits().size
    const t1 = mkDelta()
    Targ.generate()
    console.log(
        `${curTab}  translated ${t1} sec .emscript/main.cpp using [${usedCnt}/${unitCnt}] units`
    )
    if (opts.meta) return
    const stdout = Targ.build()
    if (stdout === null) process.exit(1)
    const t2 = mkDelta()
    const sha32 = sprintSha32()
    const sizes = sprintSizes(stdout)
    console.log(`${curTab}  compiled ${t2} sec .emscript/.out image: ${sizes}, ${sha32}`)
    if (!opts.load) return
    printProgress('loading')
    loadProg()
}

function doClean(opts: any): void {
    Session.activate(getRootDir(), Session.Mode.CLEAN)
    console.log('cleaned')
}

function doConfig(opts: any) {
    const file = Path.join(getRootDir(), 'tsconfig.json')
    const json: any = {
        extends: './tsconfig.base.json',
        compilerOptions: {},
    }
    json.compilerOptions.paths = {
        '@$$emscript': ['./workspace/em.core/em.lang/emscript'],
    }
    Session.activate(
        getRootDir(),
        Session.Mode.PROPS,
        opts.setupProperties ?? ''
    )
    const wdir = Session.getWorkDir()
    Fs.readdirSync(wdir).forEach((f1) => {
        let ppath = Path.join(wdir, f1)
        if (Session.isPackage(ppath))
            Fs.readdirSync(ppath).forEach((f2) => {
                let bpath = Path.join(ppath, f2)
                if (Fs.statSync(bpath).isDirectory()) {
                    json.compilerOptions.paths[`@${f2}/*`] = [
                        `./workspace/${f1}/${f2}/*`,
                    ]
                }
            })
    })
    if (Session.hasDistro()) {
        const d = Session.getDistro()
        json.compilerOptions.paths[`@$distro/*`] = [
            `./workspace/${d.package}/${d.bucket}/*`,
        ]
    }
    Fs.writeFileSync(file, JSON.stringify(json, null, 4), 'utf-8')
}

function doFormat(opts: any): void {
    Format.exec(opts.unit)
}

function doGenRegs(opts: any): void {
    const distro = opts.distro as string
    const genprog = Path.join(distro, 'genregs.ts')
    if (!Fs.existsSync(genprog)) {
        console.error(`*** 'genregs.ts' not found in ${distro}`)
        process.exit(1)
    }
    console.log('generating...')
    const proc = ChildProc.spawnSync('npx', ['ts-node', 'genregs.ts'], {
        cwd: distro,
        shell: Session.getShellPath(),
    })
    if (proc.error) console.log(String(proc.error))
    console.log('done')
}

function doGrammar(opts: any): void {
    Tracks.generate(opts.outdir)
}

function doLoad(opts: any) {
    Session.activate(getRootDir(), Session.Mode.ROOTS)
    const file = Path.join(Session.getBuildDir(), '.PROG')
    if (!Fs.existsSync(file)) {
        console.error('*** no program found')
        process.exit(1)
    }
    const prog = Fs.readFileSync(file, 'utf-8')
    Props.bindProg(prog)
    const board = Fs.readFileSync(
        Path.join(Session.getBuildDir(), '.BOARD'),
        'utf-8'
    )
    const setup = Fs.readFileSync(
        Path.join(Session.getBuildDir(), '.SETUP'),
        'utf-8'
    )
    printProgress('loading', { setup: setup, board: board })
    loadProg()
}

function doMarkdown(opts: any) {
    Session.activate(getRootDir(), Session.Mode.BUILD)
    Markdown.generate(opts.package, opts.outdir)
}

function doParse(opts: any): void {
    const ud = mkUnit(opts, 'parsing')
    ud.sf.statements.forEach((stmt) => Ast.printTree(stmt, '    '))
}

function doPrettier(opts: any) {
    Prettier.exec(opts.unit)
}

function doProperties(opts: any) {
    const setup = (opts.setupProperties ? opts.setupProperties : '') as string
    Session.activate(getRootDir(), Session.Mode.PROPS, setup)
    Props.print()
}

function doRender(opts: any) {
    const ud = mkUnit(opts, 'rendering')
    console.log(Render.exec(ud, opts.verbose))
}

function doSemToks(opts: any) {
    const rd = getRootDir()
    Session.activate(rd, Session.Mode.PARSE)
    for (const up of Session.listUnitPaths()) {
        console.log(up)
        SemTokens.generate(up)
    }
}

function loadProg() {
    let proc = ChildProc.spawnSync('./load.sh', [], {
        cwd: Session.getBuildDir(),
        shell: Session.getShellPath(),
    })
    if (proc.status != 0) {
        console.error('*** loader failed')
        process.exit(1)
    }
    console.log('done')
}

function getRootDir() {
    return Path.resolve(CMD.opts().root)
}

function mkDelta(): string {
    return ((Date.now() - t0) / 1000).toFixed(2)
}

function mkUnit(opts: any, action: string): Unit.Desc {
    const upath = opts.unit
    Session.activate(getRootDir(), Session.Mode.BUILD)
    const uid = Session.mkUid(upath)
    console.log(`${action} '${uid}' ...`)
    Meta.parse(upath)
    const ud = Unit.units().get(uid!)!
    return ud
}

function printProgress(
    label: string,
    using: { setup: string; board: string } | boolean = false
) {
    let brd = using === false ? '' : using === true ? Props.getBoardKind() : using.board
    brd = brd.replace(/^.*\:\/\/(.*)$/, '$1')
    const output = `${label} '${Props.getProg()}'` +
        (
            using !== false
                ? ` for '${brd}' with setup '${using === true ? Props.getSetup() : using.setup}'`
                : ''
        )
    console.log(output)
}

function sprintSha32() {
    const txt = Fs.readFileSync(
        Path.join(Session.getBuildDir(), '.out', 'main.out.hex'),
        'utf-8'
    )
    const hash = Crypto.createHash('sha256')
        .update(txt)
        .digest('hex')
        .slice(0, 8)
    return `sha(${hash})`
}

function sprintSizes(stdout: string) {
    const lines = stdout.split('\n').filter((ln) => ln.match(/^\s*\d/))
    const map = new Map<string, number>([
        ['.text', 0],
        ['.const', 0],
        ['.data', 0],
        ['.bss', 0],
    ])
    lines.forEach((ln) => {
        const words = ln.split(/\s+/)
        const sect = words[2]
        if (map.has(sect)) map.set(sect, Number('0x' + words[3]))
    })
    const textSz = map.get('.text')
    const constSz = map.get('.const')
    const dataSz = map.get('.data')
    const bssSz = map.get('.bss')
    return `text(${textSz}), const(${constSz}), data(${dataSz}), bss(${bssSz})`
}
