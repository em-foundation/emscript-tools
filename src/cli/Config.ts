import * as Ts from 'typescript'

import * as Out from './Out'
import * as Session from './Session'
import * as Targ from './Targ'

export function genParam(decl: Ts.VariableDeclaration, dn: string) {
    const cobj = getConfig(dn)
    const txt = decl.getText(Targ.context().ud.sf)
    const m = txt.match(/\<(.+)\>/)
    const cs = 'static const '
    const ts = `em::param<${m![1].replaceAll('.', '::')}>`
    const init = String(cobj.val)
    Out.print("%t%1%2 %3 = %4;\n", cs, ts, dn, init)
}

function getConfig(name: string): any {
    const $$units = Session.getUnits()
    const uobj = $$units.get(Targ.context().ud.id)!
    return uobj[name]
}

