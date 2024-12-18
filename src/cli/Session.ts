import * as Fs from 'fs'
import * as Path from 'path'

import * as Meta from './Meta'
import * as Targ from './Targ'

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

export function activate(root: string, mode: Mode): void {
    projDir = root
    workDir = Path.join(projDir, 'workspace').replaceAll(/\\/g, '/')
    buildDir = Path.join(workDir, '.emscript').replaceAll(/\\/g, '/')
    process.chdir(projDir)
    if (Fs.existsSync(buildDir)) Fs.rmSync(buildDir, { recursive: true })
}

export function buildUnit(upath: string): void {
    Meta.parse(upath)
    const $$units = Meta.exec()
    Targ.generate($$units)
    Targ.build()
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

export function getWorkDir(): string {
    return workDir
}