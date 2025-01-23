import * as Fs from 'fs'
import * as Path from 'path'

import * as Err from './Err'

const LOCAL_INI_FILE = 'emscript-local.ini'
const PKG_INI_FILE = 'em-package.ini'
const ROOT_INI_FILE = 'emscript.ini'

const PROP_DISTRO = 'em.lang.Distro'
const PROP_EXTENDS = 'em.lang.SetupExtends'
const PROP_REQUIRES = 'em.lang.PackageRequires'

const SETUP_SEP = '://'

type PkgList = Array<string>
type PropMap = Map<string, string>
type PropSet = Set<string>

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

export function addWorkspace() {
    const path = Path.join(root_dir, ROOT_INI_FILE)
    if (!Fs.existsSync(path)) Err.fail(`can't find '${ROOT_INI_FILE}'`)
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

export function getDistro() {
    const ds = cur_props.get(PROP_DISTRO)!
    const sa = ds.split(SETUP_SEP)
    return { package: sa[0], bucket: sa[1] }
}

export function getPackages(): PkgList {
    return cur_pkgs
}

export function getProps(): PropMap {
    return cur_props
}

export function init(dir: string, sname?: string) {
    root_dir = dir
    if (sname === undefined) return
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

