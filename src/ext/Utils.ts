import ChildProc from 'child_process'
import Fs from "fs";
import Path from "path";
import Vsc from "vscode";

import * as JSON5 from 'json5'

const EXT = ".em.ts"
const EXTENSION_ID = "the-em-foundation.em-script"

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

export function build(upath: string) {
    let main = Path.join(getExtRoot(), 'out/cli/Main.js')
    let args = [main, 'build', '-u', upath]
    process.env['NODE_PATH'] = Path.join(getExtRoot(), 'node_modules')
    let proc = ChildProc.spawn('node', args, { cwd: workPath() })
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (data => loggerC.addInfo(data)))
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (data => loggerC.addErr(data)))
    proc.on('close', (stat => {
        loggerC.addInfo('done.')
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

export function isPackage(path: string): boolean {
    if (!Fs.existsSync(path)) return false;
    if (!Fs.statSync(path).isDirectory()) return false;
    let ifile = Path.join(path, 'em-package.ini');
    if (!Fs.existsSync(ifile)) return false;
    return true;
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
    return `${pn}/${bn}/${un}.em`
}

export function rootPath(): string {
    return Vsc.workspace.workspaceFolders![0].uri.fsPath
}

export function updateConfig(): void {
    const file = Path.join(rootPath(), 'tsconfig.json')
    const json = JSON5.parse(Fs.readFileSync(file, 'utf-8'))
    json.compilerOptions.paths = { "@EM-SCRIPT": ["./workspace/em.core/em.lang/em-script"] }
    let wdir = workPath()
    Fs.readdirSync(wdir).forEach(f1 => {
        let ppath = Path.join(wdir, f1);
        if (isPackage(ppath)) Fs.readdirSync(ppath).forEach(f2 => {
            let bpath = Path.join(ppath, f2);
            if (Fs.statSync(bpath).isDirectory()) {
                json.compilerOptions.paths[`@${f2}/*`] = [`./workspace/${f1}/${f2}/*`]
            }
        });
    });
    Fs.writeFileSync(file, JSON.stringify(json, null, 4), 'utf-8')
}

export async function updateSettings(sect: string, key: string, val: any) {
    let conf = Vsc.workspace.getConfiguration(sect, Vsc.Uri.file(rootPath()))
    await conf.update(key, val, Vsc.ConfigurationTarget.Workspace)
}

export function workPath(): string {
    return Path.join(rootPath(), "workspace")
}


