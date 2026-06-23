import * as Fs from 'fs'
import * as Path from 'path'

import * as Err from './Err'
import * as Props from './Props'

export enum Mode {
    BUILD,
    CLEAN,
    PARSE,
    PROPS,
    ROOTS,
    UNITS,
}

let projDir: string
let workDir: string
let buildDir: string

let $$units = new Map<string, any>()

export function activate(root: string, mode: Mode, setup?: string): void {
    projDir = root.replaceAll(/\\/g, '/')
    workDir = `${projDir}/workspace`
    buildDir = `${workDir}/.emscript`
    if (mode == Mode.ROOTS) return
    process.chdir(projDir)
    Props.init(workDir)
    Props.addWorkspace()
    if (setup) Props.addSetup(setup)
    Props.addToolsHome(projDir)
    if (mode != Mode.BUILD && mode != Mode.CLEAN) return
    if (Fs.existsSync(buildDir)) Fs.rmSync(buildDir, { recursive: true })
    if (mode == Mode.CLEAN) return
    Fs.mkdirSync(buildDir)
    // Props.saveProps(Path.join(buildDir, 'props.json'))
    process.chdir(root)
}

export function getBuildDir(): string {
    return buildDir
}

export function getRootDir(): string {
    return projDir
}

export function getDistro(): { package: string, bucket: string } {
    return Props.getDistro()!
}

export function getShellPath(): string {
    // TODO -- infer path if necessary
    if (Fs.existsSync(`${process.env.SYSTEMDRIVE}\\git\\usr\\bin\\bash.exe`)) {
        return `${process.env.SYSTEMDRIVE}\\git\\usr\\bin\\bash.exe`
    } else if (Fs.existsSync(`${process.env.SYSTEMDRIVE}\\Program Files\\Git\\usr\\bin\\bash.exe`)) {
        return `${process.env.SYSTEMDRIVE}\\Program Files\\Git\\usr\\bin\\bash.exe`
    } else if (process.env.SHELL) {
        return process.env.SHELL
    } else if (process.env.COMSPEC) {
        return process.env.COMSPEC
    } else {
        return ''
    }
}

export function getUnits(): typeof $$units {
    return $$units
}

export function getWorkDir(): string {
    return workDir
}

export function hasDistro(): boolean {
    return Props.getDistro() != undefined
}

export function isPackage(path: string): boolean {
    if (!Fs.existsSync(path)) return false;
    if (!Fs.statSync(path).isDirectory()) return false;
    let ifile = Path.join(path, 'em-package.ini');
    if (!Fs.existsSync(ifile)) return false;
    return true;
}

export function listUnitPaths(): Array<string> {
    let res = new Array<string>()
    const wd = getWorkDir()
    for (const pn of Fs.readdirSync(wd)) {
        if (pn.startsWith('.')) continue
        const pd = Path.join(wd, pn)
        if (!Fs.statSync(pd).isDirectory()) continue
        for (const bn of Fs.readdirSync(pd)) {
            const bd = Path.join(pd, bn)
            if (!Fs.statSync(bd).isDirectory()) continue
            for (const fn of Fs.readdirSync(bd)) {
                if (fn.endsWith('.em.ts')) {
                    res.push(`${pn}/${bn}/${fn}`)
                }
            }
        }
    }
    return res
}

export function mkUid(upath: string): string {
    return `${Path.basename(Path.dirname(upath))}/${Path.basename(upath, '.em.ts')}`
}

export function saveProps() {
    Props.saveProps(Path.join(buildDir, 'props.json'))
}

export function setUnits(umap: typeof $$units) {
    $$units = umap
}

export function version(): string {
    const pkg = JSON.parse(
        Fs.readFileSync(Path.join(__dirname, '..', 'package.json'), 'utf8')
    )
    return pkg.version
}