import * as Fs from 'fs'
import * as Path from 'path'

export enum Mode {
    BUILD,
    CLEAN,
    PARSE,
    PROPS,
    UNITS,
}

let curWorkDir: string

export function activate(workDir: string, mode: Mode) {
    curWorkDir = workDir
}

export function getWorkDir(): string {
    return curWorkDir
}