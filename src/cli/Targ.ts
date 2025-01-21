import * as ChildProc from 'child_process'
import * as Fs from 'fs'
import * as Path from 'path'
import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Decl from './Decl'
import * as Err from './Err'
import * as Expr from './Expr'
import * as Out from './Out'
import * as Session from './Session'
import * as Stmt from './Stmt'
import * as Unit from './Unit'

export interface Context {
    gen: 'BODY' | 'HDR' | 'MAIN' | 'UNK'
    ud: Unit.Desc
}

const unitGenSet = new Set<string>()
const unitTab = Unit.units()

let $$units: Map<string, any>

let curCtx: Context = { gen: 'UNK' } as Context

export function build(): string | null {
    try {
        let proc = ChildProc.spawnSync('./build.sh', [], { cwd: Session.getBuildDir(), shell: Session.getShellPath() })
        if (proc.status != 0 || proc.stderr.length > 0) {
            console.log(`*** target build failed with status ${proc.status}`)
            console.log(String(proc.stderr))
            return null
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

function genConfigs(ud: Unit.Desc) {
    curCtx.ud = ud
    curCtx.gen = 'MAIN'
    Out.print("namespace %1 {\n%+", ud.cname)
    genStmts(ud.sf)
    Out.print("%-};\n", ud.cname)
    curCtx.gen = 'UNK'
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
    const rid = ud.imports.get('em$_R')
    if (rid) {
        const rud = unitTab.get(rid)!
        if (rud) Out.addText(`#include <${rud.id}.hpp>\n`)
    }
    ud.imports.forEach((iid, key) => {
        if (key == 'em$_R') return
        const iud = unitTab.get(iid)!
        if (iud.isMetaOnly()) return
        Out.addText(`#include <${iud.id}.hpp>\n`)
    })
    Out.print("\nnamespace %1 {\n\n%+", ud.cname)
    Out.print("%tnamespace $$ = %1;\n", ud.cname)
    ud.imports.forEach((iid, key) => {
        if (key == 'em$_R') return
        const iud = unitTab.get(iid)!
        if (iud.isMetaOnly()) return
        Out.print(`%tnamespace %1 = %2;\n`, key, iud.cname)
    })
    genStructFwds(ud)
    genStmts(ud.sf)
    genStructBodies(ud)
    Out.print("\n%-};\n\n")
    genUsing(ud)
    Out.addText(`#endif // ${ud.cname}__M\n`)
    Out.close()
}

function genMain() {
    Out.open(`${Session.getBuildDir()}/main.cpp`)
    Out.addText('#include <emscript.hpp>\n')
    Out.genTitle('MODULE HEADERS')
    Array.from($$units.keys()).forEach(uid => Out.addText(`#include <${uid}.hpp>\n`))
    Out.genTitle('PROXY BINDINGS')
    Array.from($$units.keys()).forEach(uid => genProxies(uid))
    Array.from($$units.keys()).forEach(uid => {
        Out.genTitle(`MODULE ${uid}`)
        Out.addText(`#include <${uid}.cpp>\n`)
        genConfigs(unitTab.get(uid)!)
    })
    Out.genTitle('EXIT FUNCTIONS')
    Out.print('static void em__done() {\n%+')
    Out.print('%tvolatile int dummy = 0xCAFE;\n')
    Out.print('%twhile (dummy) ;\n')
    Out.print('%-}\n')
    const ubot = Array.from($$units.entries())
    const utop = ubot.reverse()
    Out.print('static void em__fail() {\n%+')
    genSpecial(ubot, 'em$fail', 'FIRST')
    Out.print('%tem__done();\n')
    Out.print('%-}\n')
    Out.print('static void em__halt() {\n%+')
    genSpecial(ubot, 'em$halt', 'FIRST')
    Out.print('%tem__done();\n')
    Out.print('%-}\n')
    Out.genTitle('MAIN ENTRY')
    Out.print('extern "C" int main() {\n%+')
    genSpecial(ubot, 'em$reset', 'FIRST')
    genSpecial(ubot, 'em$startup', 'ALL')
    genSpecial(ubot, 'em$ready', 'FIRST')
    genSpecial(utop, 'em$run', 'FIRST')
    Out.print('%tem__halt();\n')
    Out.print("%-}\n")
    Out.addText("\n")
    const dist = Session.getDistro()
    Out.addText(`#include <${dist.bucket}/startup.cpp>\n`)
    Out.close()
}

function genProxies(uid: string) {
    const ud = unitTab.get(uid)!
    const uobj = $$units.get(uid)
    ud.sf.statements.forEach(stmt => {
        if (!Ts.isVariableStatement(stmt)) return
        const decl = stmt.declarationList.declarations[0]
        const txt = decl.getText(ud.sf)
        if (!txt.match(/\$(delegate|proxy)/)) return
        const pn = (decl.name as Ts.Identifier).text
        const pobj = uobj[pn] || uobj.em$decls[pn]
        const did = pobj.prx.em$_U.uid
        const dud = unitTab.get(did)
        if (dud) Out.print('namespace %1 { namespace %2 = %3; };\n', ud.cname, pn, dud.cname)
        else Err.fail(`unbound proxy: ${uid}.${pn}`)
    })
}

function genSpecial(ulist: Array<[string, any]>, name: string, card: 'ALL' | 'FIRST') {
    for (let [uid, uobj] of ulist) {
        if (name in uobj) {
            const ud = unitTab.get(uid)!
            Out.print('%t%1::%2();\n', ud.cname, name)
            if (card == 'FIRST') return
        }
    }
}

function genStmts(node: Ts.Node) {
    node.forEachChild(child => {
        if (Ts.isStatement(child)) {
            Stmt.generate(child)
        }
    })
}

function genStructBodies(ud: Unit.Desc) {
    ud.sf.statements.forEach(node => {
        if (Ts.isClassDeclaration(node)) {
            Decl.genStruct(node, 'BODY')
        }
    })
}

function genStructFwds(ud: Unit.Desc) {
    ud.sf.statements.forEach(node => {
        if (Ts.isClassDeclaration(node)) {
            Out.print("%tstruct %1;\n", node.name!.text)
        }
    })
}

function genUnit(uid: string) {
    unitGenSet.add(uid)
    const ud = unitTab.get(uid)!
    ud.imports.forEach((iid) => {
        const iud = unitTab.get(iid)!
        if (iud.kind != 'INTERFACE') return
        if (unitGenSet.has(iid)) return
        unitGenSet.add(iid)
        curCtx.ud = unitTab.get(iid)!
        genHeader(iud)
    })
    curCtx.ud = ud
    curCtx.gen = 'HDR'
    genHeader(ud)
    curCtx.gen = 'BODY'
    genBody(ud)
    curCtx.gen = 'UNK'
}

function genUsing(ud: Unit.Desc) {
    ud.sf.statements.forEach(node => {
        if (Ts.isFunctionDeclaration(node) && node.name && node.name.text.endsWith('$$')) {
            Out.print("using %1::%2;\n", ud.cname, node.name.text)
        }
    })
}

export function generate() {
    $$units = Session.getUnits()
    for (let k of $$units.keys()) genUnit(k)
    genMain()
}

export function isBody() { return curCtx.gen == 'BODY' }
export function isHdr() { return curCtx.gen == 'HDR' }
export function isMain() { return curCtx.gen == 'MAIN' }
