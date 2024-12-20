import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Decl from './Decl'
import * as Expr from './Expr'
import * as Out from './Out'

export function generate(stmt: Ts.Statement) {
    if (Ts.isVariableStatement(stmt)) {
        Decl.generate(stmt.declarationList.declarations[0])
    }
    else if (Ts.isDeclarationStatement(stmt)) {
        Decl.generate(stmt)
    }
    else if (Ts.isExpressionStatement(stmt)) {
        Out.print("%t%1;\n", Expr.make(stmt.expression))
    }
    else if (Ts.isBlock(stmt)) {
        stmt.statements.forEach(s => generate(s))
    }
    else if (Ts.isWhileStatement(stmt)) {
        Out.print("%twhile (%1) {%+\n", Expr.make(stmt.expression))
        generate(stmt.statement)
        Out.print("%-%t}\n")
    }
    else {
        Ast.fail('Stmt', stmt)
    }
}
