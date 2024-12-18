import * as ChildProc from 'child_process'
import * as Fs from 'fs'
import * as Path from 'path'
import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Session from './Session'
import * as Unit from './Unit'

const unitGenSet = new Set<string>()
const unitTab = Unit.units()

let $$units: Map<string, any>

export function build() {
    try {
        let proc = ChildProc.spawnSync('./build.sh', [], { cwd: Session.getBuildDir(), shell: Session.getShellPath() })
        if (proc.status != 0 || proc.stderr.length > 0) {
            console.log(proc.status)
            console.log(String(proc.stderr))
        }
    } catch (err) {
        throw new Error('*** target build failed')
    }
}

function genBody(ud: Unit.Desc) {
    Out.open(`${Session.getBuildDir()}/${ud.id}.cpp`)
    Out.addText(`#include "../${ud.id}.hpp"\n\n`)
    Out.print("namespace %1 {\n\n%+", ud.cname)
    // const em$targ = Ast.findNamespace(ud.sf, 'em$targ')
    // Ast.printTree(em$targ)
    // if (em$targ) {
    //     console.log(ud.id + ':')
    //     Ast.printChildren(em$targ)
    // }
    Out.print("\n%-};\n")
    Out.close()
}

function genHeader(ud: Unit.Desc) {
    Out.open(`${Session.getBuildDir()}/${ud.id}.hpp`)
    ud.imports.forEach((iid) => {
        const iud = unitTab.get(iid)!
        if (iud.kind != 'INTERFACE') return
        Out.addText(`#include "../${iud.id}.hpp"\n`)
    })
    Out.print("\nnamespace %1 {\n\n%+", ud.cname)
    const em$targ = Ast.findNamespace(ud.sf, 'em$targ')
    if (em$targ) {
        console.log(ud.id, '-->')
        Ast.printTree(em$targ)
        em$targ.forEachChild(child => {
            if (Ts.isVariableStatement(child)) {
                genVarDecl(child.declarationList.declarations[0])
            }
        })
    }
    Out.print("\n%-};\n")
    Out.close()
}

function genMain() {
    Out.open(`${Session.getBuildDir()}/main.cpp`)
    Out.genTitle('MODULE HEADERS')
    Array.from($$units.keys()).forEach(uid => Out.addText(`#include "${uid}.hpp"\n`))
    Array.from($$units.keys()).forEach(uid => {
        Out.genTitle(`MODULE ${uid}`)
        Out.addText(`#include "${uid}.cpp"\n`)
    })
    Out.genTitle('MAIN ENTRY')
    Out.print("static void em_main() {\n%+")
    Out.print("%-}\n")
    Out.addText("\n")
    const dist = Session.getDistro()
    Out.addText(`#include "${dist.bucket}/startup.c"\n`)
    Out.close()
}

function genUnit(uid: string) {
    unitGenSet.add(uid)
    const ud = unitTab.get(uid)!
    ud.imports.forEach((iid) => {
        const iud = unitTab.get(iid)!
        if (iud.kind != 'INTERFACE') return
        if (unitGenSet.has(iid)) return
        unitGenSet.add(iid)
        genHeader(iud)
    })
    genHeader(ud)
    genBody(ud)
}

function genVarDecl(decl: Ts.VariableDeclaration) {
    // console.log((decl.name as Ts.Identifier).text)
    // Ast.printTree(decl)
}

export function generate(umap: Map<string, any>) {
    $$units = umap
    for (let k of umap.keys()) genUnit(k)
    genMain()
}
