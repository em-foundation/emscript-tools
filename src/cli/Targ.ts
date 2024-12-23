import * as ChildProc from 'child_process'
import * as Fs from 'fs'
import * as Path from 'path'
import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Decl from './Decl'
import * as Expr from './Expr'
import * as Out from './Out'
import * as Session from './Session'
import * as Stmt from './Stmt'
import * as Unit from './Unit'

export interface Context {
    gen: 'BODY' | 'HEADER'
    ud: Unit.Desc
}

const unitGenSet = new Set<string>()
const unitTab = Unit.units()

let $$units: Map<string, any>

let curCtx: Context = { gen: 'HEADER' } as Context

export function build(): string {
    try {
        let proc = ChildProc.spawnSync('./build.sh', [], { cwd: Session.getBuildDir(), shell: Session.getShellPath() })
        if (proc.status != 0 || proc.stderr.length > 0) {
            console.log(`*** target build failed with status ${proc.status}`)
            console.log(String(proc.stderr))
        }
        return String(proc.stdout)
    } catch (err) {
        throw new Error('*** fatal exception: target build failed')
    }
}

export function context(): Context {
    return curCtx
}

function genBody(ud: Unit.Desc) {
    Out.open(`${Session.getBuildDir()}/${ud.id}.cpp`)
    Out.addText(`#include <${ud.id}.hpp>\n\n`)
    Out.print("namespace %1 {\n\n%+", ud.cname)
    genFxns(ud.sf)
    Out.print("\n%-};\n")
    Out.close()
}

function genFxns(node: Ts.Node) {
    node.forEachChild(child => {
        if (Ts.isFunctionDeclaration(child)) {
            Decl.generate(child)
        }
    })
}

function genHeader(ud: Unit.Desc) {
    Out.open(`${Session.getBuildDir()}/${ud.id}.hpp`)
    Out.addText(`#ifndef ${ud.cname}__M\n`)
    Out.addText(`#define ${ud.cname}__M\n`)
    Out.addText('#include <emscript.hpp>\n\n')
    ud.imports.forEach((iid) => {
        const iud = unitTab.get(iid)!
        // if (iud.kind != 'INTERFACE') return
        Out.addText(`#include <${iud.id}.hpp>\n`)
    })
    Out.print("\nnamespace %1 {\n\n%+", ud.cname)
    ud.imports.forEach((iid, key) => {
        const iud = unitTab.get(iid)!
        if (key == 'em$_R') return
        Out.print(`%tnamespace %1 = %2;\n`, key, iud.cname)
    })
    genStmts(ud.sf)
    Out.print("\n%-};\n\n")
    Out.addText(`#endif // ${ud.cname}__M\n`)
    Out.close()
}

function genMain() {
    Out.open(`${Session.getBuildDir()}/main.cpp`)
    Out.genTitle('MODULE HEADERS')
    Array.from($$units.keys()).forEach(uid => Out.addText(`#include <${uid}.hpp>\n`))
    Array.from($$units.keys()).forEach(uid => {
        Out.genTitle(`MODULE ${uid}`)
        Out.addText(`#include <${uid}.cpp>\n`)
    })
    Out.genTitle('EXIT FUNCTIONS')
    Out.print('static void em__done() {\n%+')
    Out.print('%tvolatile int dummy = 0xCAFE;\n')
    Out.print('%twhile (dummy) ;\n')
    Out.print('%-}\n')
    Out.print('static void em__fail() {\n%+')
    Out.print('%tem__done();\n')
    Out.print('%-}\n')
    Out.print('static void em__halt() {\n%+')
    Out.print('%tem__done();\n')
    Out.print('%-}\n')
    Out.genTitle('MAIN ENTRY')
    Out.print('extern "C" int main() {\n%+')
    for (let [uid, uobj] of Array.from($$units.entries()).reverse()) {
        if ('em$run' in uobj) {
            const ud = unitTab.get(uid)!
            Out.print('%t%1::em$run();\n', ud.cname)
            break
        }
    }
    Out.print('%tem__halt();\n')
    Out.print("%-}\n")
    Out.addText("\n")
    const dist = Session.getDistro()
    Out.addText(`#include <${dist.bucket}/startup.c>\n`)
    Out.close()
}

function genStmts(node: Ts.Node) {
    node.forEachChild(child => {
        if (Ts.isStatement(child)) {
            Stmt.generate(child)
        }
    })
}

function genUnit(uid: string) {
    unitGenSet.add(uid)
    const ud = unitTab.get(uid)!
    curCtx.ud = ud
    ud.imports.forEach((iid) => {
        const iud = unitTab.get(iid)!
        if (iud.kind != 'INTERFACE') return
        if (unitGenSet.has(iid)) return
        unitGenSet.add(iid)
        genHeader(iud)
    })
    genHeader(ud)
    curCtx.gen = 'BODY'
    genBody(ud)
    curCtx.gen = 'HEADER'
}

export function generate() {
    $$units = Session.getUnits()
    for (let k of $$units.keys()) genUnit(k)
    genMain()
}
