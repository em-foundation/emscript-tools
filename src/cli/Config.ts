import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Session from './Session'
import * as Targ from './Targ'

export type Kind = 'NONE' | 'PARAM' | 'PROXY' | 'TABLE'

export function genParam(decl: Ts.VariableDeclaration, dn: string) {
    const cobj = getObj(dn)
    const txt = decl.getText(Targ.context().ud.sf)
    const m = txt.match(/\<(.+)\>/)
    const cs = 'static const '
    const ts = `em::param<${m![1].replaceAll('.', '::')}>`
    const init = String(cobj.val)
    Out.print("%t%1%2 %3 = %4;\n", cs, ts, dn, init)
}

export function getKind(node: Ts.Node): Kind {
    const te = Ast.getTypeExpr(Targ.context().ud.tc, node)
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

