import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Decl from './Decl'
import * as Expr from './Expr'
import * as Out from './Out'

export function generate(stmt: Ts.Statement, tab: boolean = true) {
    if (Ts.isVariableStatement(stmt)) {
        Decl.generate(stmt.declarationList.declarations[0])
    }
    else if (Ts.isDeclarationStatement(stmt)) {
        Decl.generate(stmt)
    }
    else if (Ts.isExpressionStatement(stmt)) {
        Out.print("%t%1;\n", Expr.make(stmt.expression))
    }
    else if (Ts.isReturnStatement(stmt)) {
        const retval = stmt.expression ? ` ${Expr.make(stmt.expression)}` : ''
        Out.print("%treturn%1;\n", retval)
    }
    else if (Ts.isBlock(stmt)) {
        stmt.statements.forEach(s => generate(s))
    }
    else if (Ts.isIfStatement(stmt)) {
        Out.print("%tif (%1) {%+\n", Expr.make(stmt.expression))
        generate(stmt.thenStatement)
        Out.print("%-%t}\n")
        if (stmt.elseStatement) {
            Out.print("%telse {%+\n")
            generate(stmt.elseStatement)
            Out.print("%-%t}\n")
        }
    }
    else if (Ts.isForStatement(stmt)) {
        let init = ''
        if (stmt.initializer) {
            if (Ts.isVariableDeclarationList(stmt.initializer)) {
                init = Decl.makeVarDecl(stmt.initializer.declarations[0])
            }
            else if (Ts.isExpression(stmt.initializer)) {
                init = Expr.make(stmt.initializer)
            }
        }
        let cond = stmt.condition ? Expr.make(stmt.condition) : ''
        let incr = stmt.incrementor ? Expr.make(stmt.incrementor) : ''
        Out.print("%tfor (%1; %2; %3) {%+\n", init, cond, incr)
        generate(stmt.statement)
        Out.print("%-%t}\n")
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
