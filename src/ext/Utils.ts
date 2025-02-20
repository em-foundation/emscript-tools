import ChildProc from 'child_process'
import Fs from "fs";
import Path from "path";
import Vsc from "vscode";

import * as JSON5 from 'json5'

import * as Session from '../cli/Session'

const EXT = ".em.ts"
const EXTENSION_ID = "the-em-foundation.emscript"

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

export function showVersion() {
    Vsc.window.showInformationMessage(`EM•Script activated [ version ${getVersFull()} ]`)
}

export function updateConfig(): void {
    let main = Path.join(getExtRoot(), 'out/cli/Main.js')
    let args = [main, 'config']
    process.env['NODE_PATH'] = Path.join(getExtRoot(), 'node_modules')
    ChildProc.spawnSync('node', args, { cwd: workPath() })
}

export async function updateSettings(sect: string, key: string, val: any) {
    let conf = Vsc.workspace.getConfiguration(sect, Vsc.Uri.file(rootPath()))
    await conf.update(key, val, Vsc.ConfigurationTarget.Workspace)
}

export function workPath(): string {
    return Path.join(rootPath(), "workspace")
}


