import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Session from './Session'
import * as Targ from './Targ'
import * as Type from './Type'

export type Kind = 'NONE' | 'ARRAY_P' | 'ARRAY_V' | 'PARAM' | 'PROXY' | 'TABLE'

export function genArrayProto(decl: Ts.VariableDeclaration, dn: string) {
    if (!Targ.isHdr()) return
    const cobj = getObj(dn)
    const len = cobj.$len
    const ts = 'em::u8'
    Out.print("%tstruct %1 {\n%+", dn)
    Out.print("%tstatic constexpr em::u16 $len = %1;\n", len)
    Out.print("%tstatic %1 $make() { return %1(); }\n", dn)
    Out.print("%t%1 items[%2] = {0};\n", "em::u8", len, ts)
    Out.print("%t%1& operator[](em::u16 index) { return items[index]; }\n", ts)
    Out.print("%tconst %1& operator[](em::u16 index) const { return items[index]; }\n", ts)
    Out.print("%-%t};\n")
}

export function genArrayVal(decl: Ts.VariableDeclaration, dn: string) {
    if (!Targ.isHdr()) return
    Ast.printTree(decl)
    Out.print("%t// %1\n", dn)
}

export function genParam(decl: Ts.VariableDeclaration, dn: string) {
    const cobj = getObj(dn)
    const txt = decl.getText(Targ.context().ud.sf)
    const m = txt.match(/\<(.+)\>/)
    const cs = Targ.isHdr() ? 'extern const ' : 'const '
    const ts = `em::param<${m![1].replaceAll('.', '::')}>`
    const init = Targ.isMain() ? ` = ${String(cobj.val)}` : ''
    Out.print("%t%1%2 %3%4;\n", cs, ts, dn, init)
}

export function genTable(decl: Ts.VariableDeclaration, dn: string) {
    const cobj = getObj(dn)
    const acc = cobj.access
    const es = Targ.isHdr() ? 'extern ' : ''
    const cs = acc == 'ro' ? 'const ' : ''
    const len = cobj.elems.length
    const txt = decl.getText(Targ.context().ud.sf)
    const m = txt.match(/\<(.+)\>/)
    const ts = `em::table_${acc}<${m![1].replaceAll('.', '::')}, ${len}>`
    Out.print("%t%1%2%3 %4", es, cs, ts, dn)
    if (Targ.isMain()) {
        Out.print(" = {%+\n")
        for (let i = 0; i < len; i++) {
            Out.print("%t%1,\n", cobj.elems[i])
        }
        Out.print("%-%t}")
    }
    Out.print(";\n")
}

export function getKind(node: Ts.Node): Kind {
    const te = Ast.getTypeExpr(Targ.context().ud.tc, node)
    if (te.startsWith('em$ArrayProto')) return 'ARRAY_P'
    // if (te.startsWith('em$ArrayVal')) return 'ARRAY_V'
    if (te.startsWith('em$param_t')) return 'PARAM'
    if (te.startsWith('em$proxy_t')) return 'PROXY'
    if (te.startsWith('em$table_t')) return 'TABLE'
    return 'NONE'
}

function getObj(name: string): any {
    const $$units = Session.getUnits()
    const uobj = $$units.get(Targ.context().ud.id)!
    return uobj[name]
}

