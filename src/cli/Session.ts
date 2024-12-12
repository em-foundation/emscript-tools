import * as Fs from 'fs'
import * as MetaProg from './MetaProg'
import * as Path from 'path'

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
    workDir = Path.join(projDir, 'workspace')
    buildDir = Path.join(workDir, '.emscript')
    process.chdir(projDir)
    if (Fs.existsSync(buildDir)) Fs.rmSync(buildDir, { recursive: true })
}

export function buildUnit(upath: string): void {
    MetaProg.parse(upath)
    // MetaProg.dump()
    // MetaProg.emit()
    MetaProg.exec()
}

export function getWorkDir(): string {
    return workDir
}