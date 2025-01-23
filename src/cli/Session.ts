import * as Fs from 'fs'
import * as Path from 'path'

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

let $$units = new Map<string, any>()

export function activate(root: string, mode: Mode, setup?: string): void {
    projDir = root
    workDir = Path.join(projDir, 'workspace').replaceAll(/\\/g, '/')
    buildDir = Path.join(workDir, '.emscript').replaceAll(/\\/g, '/')
    process.chdir(projDir)
    if (Fs.existsSync(buildDir)) Fs.rmSync(buildDir, { recursive: true })
    Props.init(workDir, setup)
    if (setup) Props.addSetup(setup)
    Props.addWorkspace()
}

export function getBuildDir(): string {
    return buildDir
}

export function getDistro(): { package: string, bucket: string } {
    return { package: 'ti.cc23xx', bucket: 'ti.distro.cc23xx' }
}

export function getShellPath(): string {
    // TODO -- infer path if necessary
    return process.env['SHELL']!
}

export function getUnits(): typeof $$units {
    return $$units
}

export function getWorkDir(): string {
    return workDir
}

export function mkUid(upath: string): string {
    return `${Path.basename(Path.dirname(upath))}/${Path.basename(upath, '.em.ts')}`
}

export function setUnits(umap: typeof $$units) {
    $$units = umap
}