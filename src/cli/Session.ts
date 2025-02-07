import * as Fs from 'fs'
import * as Path from 'path'

import * as Err from './Err'
import * as Props from './Props'

export enum Mode {
    BUILD,
    CLEAN,
    PARSE,
    PROPS,
    UNITS,
}

let projDir: string
let workDir: string
let buildDir: string

let vers = '@VERS'
if (vers[0] == '@') vers = '0.0.0.' + new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -5)

let $$units = new Map<string, any>()

export function activate(root: string, mode: Mode, setup?: string): void {
    projDir = root
    workDir = Path.join(projDir, 'workspace').replaceAll(/\\/g, '/')
    buildDir = Path.join(workDir, '.emscript').replaceAll(/\\/g, '/')
    process.chdir(projDir)
    Props.init(workDir, setup)
    if (setup) Props.addSetup(setup)
    Props.addWorkspace()
    Props.addToolsHome()
    if (mode != Mode.BUILD && mode != Mode.CLEAN) return
    if (Fs.existsSync(buildDir)) Fs.rmSync(buildDir, { recursive: true })
    if (mode == Mode.CLEAN) return
    Fs.mkdirSync(buildDir)
    Props.saveProps(Path.join(buildDir, 'props.json'))
}

export function getBuildDir(): string {
    return buildDir
}

export function getDistro(): { package: string, bucket: string } {
    return Props.getDistro()
}

export function getShellPath(): string {
    // TODO -- infer path if necessary
    if (process.env['SHELL']) {
        return process.env.SHELL
    } else if (Fs.existsSync('C:\\git\\usr\\bin\\bash.exe')) {
        return 'C:\\git\\usr\\bin\\bash.exe'
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

export function isPackage(path: string): boolean {
    if (!Fs.existsSync(path)) return false;
    if (!Fs.statSync(path).isDirectory()) return false;
    let ifile = Path.join(path, 'em-package.ini');
    if (!Fs.existsSync(ifile)) return false;
    return true;
}

export function mkUid(upath: string): string {
    return `${Path.basename(Path.dirname(upath))}/${Path.basename(upath, '.em.ts')}`
}

export function setUnits(umap: typeof $$units) {
    $$units = umap
}

export function version(): string {
    return vers
}
