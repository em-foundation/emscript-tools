import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Err from './Err'
import * as Expr from './Expr'
import * as Out from './Out'
import * as Session from './Session'
import * as Targ from './Targ'
import * as Type from './Type'

export type Kind = 'NONE' | 'CONFIG' | 'PROXY' | 'TABLE'

export function genConfig(decl: Ts.VariableDeclaration, dn: string) {
    const cobj = getObj(dn)
    const call = decl.initializer! as Ts.CallExpression
    const cs = Targ.isHdr() ? 'extern const ' : 'const '
    const ts = Type.make(call.typeArguments![0])
    Out.print("%t%1%2 %3", cs, ts, dn)
    if (Targ.isMain()) {
        Out.print(" = ((%1)(", ts)
        printVal(cobj.$$val, ts)
        Out.print("))")
    }
    Out.print(";\n")
}

export function genTable(decl: Ts.VariableDeclaration, dn: string) {
    const cobj = getObj(dn)
    const acc = cobj.access
    const es = Targ.isHdr() ? 'extern ' : ''
    const cs = acc == 'ro' ? 'const ' : ''
    const len = cobj.elems.length
    const call = decl.initializer! as Ts.CallExpression
    if (cobj.tab_align > 0) {
        Out.print("alignas(%1) ", cobj.tab_align)
    }
    const ts = `em::table_${acc}<${Type.make(call.typeArguments![0])}, ${len}>`
    Out.print("%t%1%2%3 %4", es, cs, ts, dn)
    if (Targ.isMain() && cobj.elems.length > 0) {
        Out.print(" = {%+\n")
        for (let i = 0; i < len; i++) {
            Out.print("%t")
            printVal(cobj.elems[i])
            Out.print(",\n")
        }
        Out.print("%-%t}")
    }
    Out.print(";\n")
}

export function getKind(node: Ts.Node): Kind {
    const te = Ast.getTypeExpr(Targ.context().ud.tc, node)
    if (te.startsWith('em$config_t')) return 'CONFIG'
    if (te.startsWith('em$proxy_t')) return 'PROXY'
    if (te.startsWith('table_t<')) return 'TABLE'
    return 'NONE'
}

export function getObj(name: string): any {
    const $$units = Session.getUnits()
    const uobj = $$units.get(Targ.context().ud.id)!
    let cobj = uobj[name]
    if (!cobj) cobj = uobj.em$decls[name]
    if (!cobj) Err.fail(`no object corresponding to '${name}'`)
    return cobj
}

function printVal(val: any, ts?: string) {
    if (typeof val === 'number' || typeof val === 'boolean') {
        const vs = val.toString()
        const suf = (vs.indexOf('.') != -1) ? 'f' : ''
        Out.print("%1%2", vs, suf)
        return
    }
    if (typeof val === 'object') {
        if (val === null) {
            Out.print("nullptr")
            return
        }
        if (val.__em$class == 'em$eref') {
            if (val.$idx == -1) {
                Out.print("nullptr")
            }
            else {
                if (ts) Out.print("%1", ts)
                Out.print("(&%1[%2])", val.$cname, val.$idx)
            }
            return
        }


        if (val?.constructor?.name === 'em$text_t') {
            Out.print("%1", Expr.mkTextVal(val.str))
            return
        }
        if (val.__em$class == 'em$cb') {
            if (val.fxn == undefined) {
                Out.print("nullptr")
            }
            else {
                Out.print("%1::%2", val.cname, val.fxn.name)
            }
            return
        }
        if (val.__em$class == 'em$frame') {
            // em::frame_t<em::u8>((em::u8[]){ 1, 2 }, 2)
            const ts = val.__$type
            Out.print("em::frame_t<%1>((%1[]){\n%+", ts)
            for (const e of val.items) {
                Out.print("%t")
                printVal(e)
                Out.print(",\n")
            }
            Out.print("%-%t}, %1)", val.items.length)
            return
        }
        if (val.__em$class == 'em$ref') {
            if (val.$$ == undefined) {
                Out.print("nullptr")
            }
            else {
                printVal(val.$$)
            }
            return
        }
        if (val.__em$class == 'em$oref') {
            if (val.idx == -1) {
                Out.print("nullptr")
            }
            else {
                if (ts) Out.print("%1", ts)
                Out.print("(&%1[%2])", val.cname, val.idx)
            }
            return
        }
        if (val.__em$class == 'em$vector') {
            Out.print("%1::%2({\n%+", val.constructor?.em$metaData, val.constructor?.name)
            for (const e of val.items) {
                Out.print("%t")
                printVal(e, ts)
                Out.print(",\n")
            }
            Out.print("%-%t})")
            return
        }
        if (val.constructor?.em$metaData) {
            Out.print("%1::%2({\n%+", val.constructor?.em$metaData, val.constructor?.name)
            for (let p in val) {
                if (typeof val[p] == 'function' || val[p] === undefined) continue
                Out.print("%t.%1 = ", p)
                printVal(val[p], ts)
                Out.print(",\n")
            }
            Out.print("%-%t})")
            return
        }
    }
    console.log('*** UNKNOWN')
    console.log(val)
    Out.print("<<UNKNOWN VALUE>>")
}
