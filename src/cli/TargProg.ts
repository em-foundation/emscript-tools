import * as Fs from 'fs'
import * as Path from 'path'
import * as Ts from 'typescript'

import * as Out from './Out'
import * as Session from './Session'
import * as UnitMgr from './UnitMgr'

const unitGenSet = new Set<string>()
const unitTab = UnitMgr.units()

let $$units: Map<string, any>

function genBody(uid: string) {
    Out.open(`${Session.getBuildDir()}/${uid}.cpp`)
    Out.close()
}

function genHeader(uid: string) {
    console.log(`${uid}.hpp`)
    Out.open(`${Session.getBuildDir()}/${uid}.hpp`)
    Out.close()
}

function genMain() {
    Out.open(`${Session.getBuildDir()}/main.cpp`)
    Out.print("void main() {\n%+")
    Out.print("%-}\n")
    Out.addText("\n")
    Out.close()
}

function genUnit(uid: string) {
    unitGenSet.add(uid)
    unitTab.get(uid)!.imports.forEach((iid) => {
        const iud = unitTab.get(iid)!
        if (iud.kind != 'INTERFACE') return
        if (unitGenSet.has(iid)) return
        unitGenSet.add(iid)
        genHeader(iid)
    })
    genHeader(uid)
}

export function generate(umap: Map<string, any>) {
    $$units = umap
    for (let k of umap.keys()) genUnit(k)
    genMain()
}
