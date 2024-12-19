import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Expr from './Expr'
import * as Out from './Out'
import * as Type from './Type'
import * as Unit from './Unit'

export function generate(decl: Ts.Declaration, ud: Unit.Desc) {
    if (Ts.isTypeAliasDeclaration(decl)) {
        Out.print("%ttypedef %1 %2;\n", Type.make(decl.type, ud), (decl.name as Ts.Identifier).text)
    }
    else if (Ts.isVariableDeclaration(decl)) {
        const cs = ((decl.parent.flags & Ts.NodeFlags.Const) !== 0) ? 'const ' : ''
        const dn = (decl.name as Ts.Identifier).text
        const ts = Type.make(decl.type!, ud)
        const init = decl.initializer ? `= ${Expr.make(decl.initializer, ud)}` : ''
        Out.print("%t%1%2 %3%4;\n", cs, ts, dn, init)
    }
    else {
        Ast.fail('Decl', decl)
    }
}
