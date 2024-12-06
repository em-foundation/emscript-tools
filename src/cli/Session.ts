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

let curWorkDir: string

export function activate(workDir: string, mode: Mode): void {
    curWorkDir = workDir
}

export function buildUnit(upath: string): void {
    MetaProg.parse(upath)
    MetaProg.dump()
}

export function getWorkDir(): string {
    return curWorkDir
}