import ChildProc from 'child_process'
import Fs from 'fs'
import Path from 'path'
import Vsc from 'vscode'
import Yaml from 'js-yaml'

import * as Props from '../cli/Props'
import * as Session from '../cli/Session'

const EXT = ".em.ts"
const EXTENSION_ID = "the-em-foundation.emscript"

const curPropMap = new Map<string, string>()

const loggerC = new class Logger {
    readonly output = Vsc.window.createOutputChannel('EM•Script', 'em-log')
    addBreak = (flag: boolean) => {
        if (!flag) return
        this.output.appendLine('----')
        this.output.show(true)
    }
    addErr = async (msg: string) => { this.writeEntry('E', msg) }
    addInfo = async (msg: string) => { this.writeEntry('I', msg) }
    private writeEntry = (kind: string, msg: string) => {
        msg.split('\n').forEach(ln => {
            if (ln.length) this.output.appendLine(`${mkTime()} ${kind}: ${ln.trimEnd()}`)
        })
        this.output.show(true)
    }
}

abstract class StatusItem {
    private static UNK = '<empty>'
    private static COMMENT = '## **** DO NOT EDIT THIS LINE ****'
    private readonly key: string
    private readonly pre: string
    private readonly prop: string
    private readonly status = Vsc.window.createStatusBarItem(Vsc.StatusBarAlignment.Left)
    private readonly title: string
    constructor(key: string, prop: string, cmd: string, tip: string, title: string, pre: string) {
        this.key = key
        this.pre = pre
        this.prop = prop
        this.status.command = cmd
        this.status.tooltip = tip
        this.title = title
    }
    private display(name: string) {
        const text = name ? name : StatusItem.UNK
        this.status.text = `${this.title} – ${text}`
        this.status.show()
    }
    get(): string {
        const conf = Vsc.workspace.getConfiguration('emscript', Vsc.Uri.file(rootPath()))
        const res = conf.get(this.key) as string
        return res
    }
    init() {
        this.display('')
    }
    abstract pickList(): string[]
    async set(name: string) {
        this.display(name)
        updateSettings('emscript', this.key, name ? name : undefined)
        let ppath = Path.join(workPath(), 'emscript-local.ini')
        if (!Fs.existsSync(ppath)) return
        let lines = Fs.readFileSync(ppath, 'utf-8').split('\n')
        for (let i = 0; i < lines.length; i++) {
            let ln = lines[i].trim()
            if (!ln.endsWith(StatusItem.COMMENT)) break
            if (!ln.startsWith(this.prop)) continue
            lines.splice(i, 1)
        }
        if (name != '') {
            lines.unshift(`${this.prop} = ${name}   ${StatusItem.COMMENT}`)
        }
        Fs.writeFileSync(ppath, lines.join('\n'))
        refreshProps()
        this.setAux(name)
    }
    protected setAux(name: string) { }
    trim(name: string): string {
        return name.substring(this.pre.length).trim()
    }
}

export const boardC = new class Board extends StatusItem {
    private static PRE = '$(circuit-board)  '
    constructor() {
        super('board', Props.PROP_BOARD, 'em.bindBoard', 'Board – click to edit', '$(circuit-board) Board', Board.PRE)
    }
    pickList(): string[] {
        Session.activate(rootPath(), Session.Mode.PROPS, setupC.get())
        if (!Session.hasDistro()) return []
        const distro = Session.getDistro()
        const file = Path.join(workPath(), distro.package, distro.bucket, 'em-boards')
        if (!Fs.existsSync(file)) return []
        let yobj = Yaml.load(String(Fs.readFileSync(file))) as Object
        let bset = new Set<string>()
        Object.keys(yobj).filter(k => !(k.startsWith('$'))).forEach(k => bset.add(`${Board.PRE}${k}`))
        // TODO -- em-boards-local
        return Array.from(bset.keys()).sort()
    }
}

export const setupC = new class Setup extends StatusItem {
    private static PRE = '$(gear)  '
    constructor() {
        super('setup', Props.PROP_EXTENDS, 'em.bindSetup', 'Setup – click to edit', '$(gear) Setup', Setup.PRE)
    }
    pickList(): string[] {
        return mkSetupNames().map(sn => `${Setup.PRE}${sn}`)
    }
    async setAux(name: string) {
        const brd = !name ? '' : curPropMap.get(Props.PROP_BOARD) ?? ''
        await boardC.set(brd)
    }
}

export function build(upath: string, opt: string) {
    let main = Path.join(getExtRoot(), 'out/cli/Main.js')
    let args = [main, 'build', '-u', upath, opt]
    process.env['NODE_PATH'] = Path.join(getExtRoot(), 'node_modules')
    let proc = ChildProc.spawn('node', args, { cwd: workPath() })
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (data => loggerC.addInfo(data)))
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (data => loggerC.addErr(data)))
    proc.on('close', (stat => {
        loggerC.addBreak(true)
    }))
    proc.on('error', (err) => {
        loggerC.addErr(err.message)
    })
}

export function format(upath: string): void {
    let main = Path.join(getExtRoot(), 'out/cli/Main.js')
    let args = [main, 'fmt', '-u', upath]
    process.env['NODE_PATH'] = Path.join(getExtRoot(), 'node_modules')
    let proc = ChildProc.spawnSync('node', args, { cwd: workPath() })
}

export function getExtRoot(): string {
    return Vsc.extensions.getExtension(EXTENSION_ID)!.extensionPath
}

export function getDefaultSetup(): string {
    return curPropMap.get(Props.PROP_EXTENDS) ?? ''
    // Session.activate(rootPath(), Session.Mode.PROPS)
    // return Props.getSetup()
}

export function getProps() {
    return curPropMap as ReadonlyMap<string, string>
}

export function getVers(): string {
    const vers = Session.version()
    return vers.slice(0, vers.lastIndexOf('.'))
}

export function getVersFull(): string {
    return Session.version()
}

export function isPackage(path: string): boolean {
    return Session.isPackage(path);
}

export function isUnitFile(uri: Vsc.Uri): boolean {
    if (!Fs.existsSync(uri.fsPath)) return false
    if (!Fs.statSync(uri.fsPath).isFile()) return false
    if (!uri.fsPath.endsWith(EXT)) return false
    return true

}

export function mkBucketNames(): string[] {
    let res = new Array<string>();
    let wpath = workPath()
    Fs.readdirSync(wpath).forEach(f => {
        let ppath = Path.join(wpath, f);
        if (isPackage(ppath)) Fs.readdirSync(ppath).forEach(f => {
            let bpath = Path.join(ppath, f);
            if (Fs.statSync(bpath).isDirectory()) res.push(f);
        });
    });
    return res;
}

export function mkPackageNames(): string[] {
    let res = new Array<string>();
    let wpath = workPath()
    Fs.readdirSync(wpath).forEach(f => {
        if (isPackage(Path.join(wpath, f))) res.push(f);
    });
    return res;
}

function mkSetupNames(): string[] {
    let res = new Array<string>();
    const wpath = workPath()
    for (const pkg of mkPackageNames()) {
        for (const f of Fs.readdirSync(Path.join(wpath, pkg))) {
            const m = f.match(/^setup-(.+)\.ini$/)
            if (m == undefined) continue
            res.push(`${pkg}://${m[1]}`)
        }
    }
    return res
}

export function mkTime(): string {
    return (new Date).toISOString()
}

export function mkUpath(uri: Vsc.Uri): string {
    const un = Path.basename(uri.fsPath, EXT)
    const bn = Path.basename(Path.dirname(uri.fsPath))
    const pn = Path.basename(Path.dirname(Path.dirname(uri.fsPath)))
    return `${pn}/${bn}/${un}.em.ts`
}

export function rootPath(): string {
    return Vsc.workspace.workspaceFolders![0].uri.fsPath
}

export async function newUnit(uri: Vsc.Uri, uks: string, content: string) {
    let uname = await Vsc.window.showInputBox({ placeHolder: `${uks} name` })
    if (!uname) return
    if (!(uname.match(/^\w(\w|\d)*$/))) {
        Vsc.window.showErrorMessage(`'${uname}' is not a valid identifier`)
        return
    }
    let ppath = uri.fsPath
    let upath = Path.join(ppath, `${uname}.em.ts`)
    let pname = Path.basename(ppath)
    if (Fs.existsSync(upath)) {
        Vsc.window.showErrorMessage(`unit '${pname}/${uname}' already exists`)
        return
    }
    Fs.writeFileSync(upath, content)
    Vsc.commands.executeCommand('vscode.open', Vsc.Uri.file(upath), { preview: true })
}

export async function refreshProps() {
    const main = Path.join(getExtRoot(), 'out/cli/Main.js')
    const args = [main, 'properties']
    process.env['NODE_PATH'] = Path.join(getExtRoot(), 'node_modules')
    const proc = ChildProc.spawnSync('node', args, { cwd: workPath() })
    const lines = String(proc.stdout).split('\n')
    curPropMap.clear()
    for (const ln of lines) {
        const m = ln.match(/^([\w.]+)\s+=\s+(.*)$/)
        if (m) {
            curPropMap.set(m[1], m[2])
        }
    }
}

export function showVersion() {
    Vsc.window.showInformationMessage(`EM•Script activated [ version ${getVersFull()} ]`)
}

export async function updateConfig() {
    let main = Path.join(getExtRoot(), 'out/cli/Main.js')
    let args = [main, 'config']
    process.env['NODE_PATH'] = Path.join(getExtRoot(), 'node_modules')
    ChildProc.spawnSync('node', args, { cwd: workPath() })
}

export async function updateSettings(sect: string, key: string, val: any) {
    const conf = Vsc.workspace.getConfiguration(sect, Vsc.Uri.file(rootPath()))
    await conf.update(key, val, Vsc.ConfigurationTarget.Workspace)
}

export function workPath(): string {
    return Path.join(rootPath(), "workspace")
}


