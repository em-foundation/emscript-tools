import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Targ from './Targ'
import * as Unit from './Unit'

export function make(type: Ts.TypeNode): string {
    let res = ""
    if (Ts.isTypeReferenceNode(type)) {
        res = type.getText(Targ.context().ud.sf).replaceAll('.', '::')
    }
    else if (Ts.isTypeQueryNode(type)) {
        res = type.getText(Targ.context().ud.sf).replaceAll('.', '::')
    }
    else {
        Ast.fail('Type', type)
    }
    return res
}