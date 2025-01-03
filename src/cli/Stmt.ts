import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Decl from './Decl'
import * as Expr from './Expr'
import * as Out from './Out'
import * as Targ from './Targ'

export function generate(stmt: Ts.Statement, tab: boolean = true) {
    if (Ts.isVariableStatement(stmt)) {
        if (stmt.modifiers) {
            for (let mod of stmt.modifiers) {
                if (mod.kind == Ts.SyntaxKind.DeclareKeyword) return
            }
        }
        Decl.generate(stmt.declarationList.declarations[0])
    }
    else if (Targ.isMain()) {
        return
    }
    else if (Ts.isDeclarationStatement(stmt)) {
        Decl.generate(stmt)
    }
    else if (Ts.isExpressionStatement(stmt)) {
        if (Ts.isStringLiteral(stmt.expression)) {
            const txt = stmt.getText(Targ.context().ud.sf)
            Out.print("%t%1;\n", txt.slice(1, -1))
            return
        }
        Out.print("%t%1;\n", Expr.make(stmt.expression))
    }
    else if (Ts.isReturnStatement(stmt)) {
        const retval = stmt.expression ? ` ${Expr.make(stmt.expression)}` : ''
        Out.print("%treturn%1;\n", retval)
    }
    else if (Ts.isBreakOrContinueStatement(stmt)) {
        Out.print("%t%1;\n", stmt.getText(Targ.context().ud.sf))
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
    else if (Ts.isForOfStatement(stmt)) {
        let init = ''
        if (stmt.initializer) {
            if (Ts.isVariableDeclarationList(stmt.initializer)) {
                const agg_type = Ast.getTypeExpr(Targ.context().ud.tc, stmt.expression)
                init = Decl.makeVarDecl(stmt.initializer.declarations[0], agg_type)
            }
        }

        let expr = Expr.make(stmt.expression)
        Out.print("%tfor (%1: %2) {%+\n", init, expr)
        generate(stmt.statement)
        Out.print("%-%t}\n")
    }
    else if (Ts.isWhileStatement(stmt)) {
        Out.print("%twhile (%1) {%+\n", Expr.make(stmt.expression))
        generate(stmt.statement)
        Out.print("%-%t}\n")
    }
    else if (Ts.isSwitchStatement(stmt)) {
        Out.print("%tswitch (%1) {%+\n", Expr.make(stmt.expression))
        stmt.caseBlock.clauses.forEach(clause => {
            if (clause.kind == Ts.SyntaxKind.CaseClause) {
                Out.print("%tcase %1:%+\n", Expr.make(clause.expression))
            }
            else {
                Out.print("%tdefault:%+\n")
            }
            clause.statements.forEach(s => generate(s))
            Out.print("%-")
        })
        Out.print("%-%t}\n")
    }
    else {
        Ast.fail('Stmt', stmt)
    }
}
