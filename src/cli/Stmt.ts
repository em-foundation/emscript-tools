import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Decl from './Decl'
import * as Out from './Out'
import * as Unit from './Unit'

export function generate(stmt: Ts.Statement, ud: Unit.Desc) {
    if (Ts.isVariableStatement(stmt)) {
        Decl.generate(stmt.declarationList.declarations[0], ud)
    }
    else if (Ts.isDeclarationStatement(stmt)) {
        Decl.generate(stmt, ud)
    }
    else {
        Ast.fail('Stmt', stmt)
    }
}