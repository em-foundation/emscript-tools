import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Targ from './Targ'
import * as Unit from './Unit'

export function make(type: Ts.TypeNode): string {
    const txt = type.getText(Targ.context().ud.sf)
    let res = ""
    if (Ts.isTypeReferenceNode(type)) {
        res = txt.replaceAll('.', '::')
    }
    else if (Ts.isTypeQueryNode(type)) {
        res = txt.replaceAll('.', '::')
    }
    else if (type.kind === Ts.SyntaxKind.VoidKeyword) {
        res = 'void'
    }
    else {
        Ast.fail('Type', type)
    }
    return res
}