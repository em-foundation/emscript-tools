import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Unit from './Unit'

export function make(type: Ts.TypeNode, ud: Unit.Desc): string {
    let res = ""
    if (Ts.isTypeReferenceNode(type)) {
        res = type.getText(ud.sf).replaceAll('.', '::')
    }
    else {
        Ast.fail('Type', type)
    }
    return res
}