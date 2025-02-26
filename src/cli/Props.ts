import * as Fs from 'fs'
import * as Path from 'path'

import * as Err from './Err'

export const PROP_BOARD = 'em.lang.BoardKind'
export const PROP_DISTRO = 'em.lang.Distro'
export const PROP_EXTENDS = 'em.lang.SetupExtends'
export const PROP_PROG = 'em.lang.Prog'
export const PROP_REQUIRES = 'em.lang.PackageRequires'

export const PROP_R_ADRFMT = 'em.regs.AdrFmt'
export const PROP_R_FLDFMT = 'em.regs.FldFmt'
export const PROP_R_IDXFMT = 'em.regs.IdxFmt'
export const PROP_R_REGFMT = 'em.regs.RegFmt'

export const PROP_TOOLS_HOME = 'em.build.ToolsHome'

const LOCAL_INI_FILE = 'emscript-local.ini'
const PKG_INI_FILE = 'em-package.ini'
const ROOT_INI_FILE = 'emscript.ini'


const SETUP_SEP = '://'

type PkgList = Array<string>
type PropMap = Map<string, string>
type PropSet = Set<string>
type RegInfo = {
    adrFmt: string
    fldFmt: string
    idxFmt: string
    regFmt: string
}

let cur_pkgs: PkgList = new Array
let cur_props: PropMap = new Map

let done_set: PropSet = new Set
let work_set: PropSet = new Set

let has_setup = false
let root_dir: string

export function addPackage(name: string) {
    if (done_set.has(name)) return
    if (work_set.has(name)) Err.fail(`package cycle in ${name}`)
    work_set.add(name)
    const path = Path.join(root_dir, name, PKG_INI_FILE)
    const pm = readProps(path)
    applyRequires(pm)
    pm.forEach((v, k) => cur_props.set(k, v))
    work_set.delete(name)
    done_set.add(name)
    cur_pkgs.unshift(Path.dirname(path))
}

export function addSetup(name: string) {
    const sa = name.split(SETUP_SEP)
    const path = Path.join(root_dir, sa[0], `setup-${sa[1]}.ini`)
    addWorkspaceProps(path)
}

export function addToolsHome(projDir: string) {
    if (cur_props.has(PROP_TOOLS_HOME)) return;
    let p = `${projDir}/tools`
    if (Fs.existsSync(p)) {
        cur_props.set(PROP_TOOLS_HOME, p)
        return
    }
    Err.fail('no tools directory configured or found')
}

export function addWorkspace() {
    let path = Path.join(root_dir, ROOT_INI_FILE)
    if (!Fs.existsSync(path)) Err.fail(`can't find '${root_dir}/${ROOT_INI_FILE}'`)
    addWorkspaceProps(path)
    path = Path.join(root_dir, LOCAL_INI_FILE)
    if (!Fs.existsSync(path)) return
    addWorkspaceProps(path)
}

function addWorkspaceProps(ppath: string) {
    const pm = readProps(ppath)
    if (!ppath.endsWith(LOCAL_INI_FILE) || !has_setup) applyExtends(pm)
    applyRequires(pm)
    pm.forEach((v, k) => {
        if (has_setup && k == PROP_EXTENDS) return
        cur_props.set(k, v)
    })
}

function applyExtends(pm: PropMap) {
    if (!pm.has(PROP_EXTENDS)) return
    const reqs = pm.get(PROP_EXTENDS)!.trim()
    reqs.split(', ').forEach(sn => addSetup(sn))
}

function applyRequires(pm: PropMap) {
    if (!pm.has(PROP_REQUIRES)) return
    const reqs = pm.get(PROP_REQUIRES)!.trim()
    reqs.split(', ').forEach(pn => addPackage(pn))
}

export function bindProg(prog: string) {
    cur_props.set(PROP_PROG, prog)
}

export function getBoardKind(): string {
    return cur_props.get(PROP_BOARD)!
}

export function getDistro() {
    const ds = cur_props.get(PROP_DISTRO)!
    const sa = ds.split(SETUP_SEP)
    return { package: sa[0], bucket: sa[1] }
}

export function getPackages(): PkgList {
    return cur_pkgs
}

export function getProg(): string {
    return cur_props.get(PROP_PROG)!
}

export function getProps(): PropMap {
    return cur_props
}

export function getRegInfo(): RegInfo {
    return {
        adrFmt: cur_props.get(PROP_R_ADRFMT) ?? '',
        fldFmt: cur_props.get(PROP_R_FLDFMT) ?? '',
        idxFmt: cur_props.get(PROP_R_IDXFMT) ?? '',
        regFmt: cur_props.get(PROP_R_REGFMT) ?? '',
    }
}

export function getSetup(): string {
    return cur_props.get(PROP_EXTENDS)!
}

export function init(dir: string, sname?: string) {
    root_dir = dir
    if (!sname) return
    has_setup = true
    cur_props.set(PROP_EXTENDS, sname)
}

export function print() {
    cur_props.forEach((v, k) => console.log(`${k} = ${v}`))
    cur_pkgs.forEach(pn => console.log(`package ${pn}`))
}

function readProps(path: string): PropMap {
    const text = String(Fs.readFileSync(path))
    let res: PropMap = new Map
    let lines = text.replace(/\r/g, '').replace(/\\\n/g, ';').split('\n')
    let pre = ''
    for (let line of lines) {
        line = line.replace(/#.*$/, '').trim()
        if (line.startsWith('[')) {
            let m = line.match(/^\[(.*)\]$/)
            if (m) pre = `${m[1].trim()}`
            if (pre) pre += '.'
            continue
        }
        let m = line.match(/(.+?)=(.*)/)
        if (!m) continue
        res.set(pre + m[1].trim(), m[2].trim())
    }
    return res
}

export function saveProps(path: string) {
    Fs.writeFileSync(path, JSON.stringify(Object.fromEntries(cur_props), undefined, 4))
}

