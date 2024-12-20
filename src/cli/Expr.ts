import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Targ from './Targ'

export function make(expr: Ts.Node): string {
    const sf = Targ.context().ud.sf
    if (Ts.isLiteralExpression(expr)) {
        return expr.getText(sf)
    }
    else if (Ts.isIdentifier(expr)) {
        return expr.getText(sf)
    }
    else if (Ts.isBinaryExpression(expr)) {
        const e1 = make(expr.left)
        const e2 = make(expr.right)
        const op = expr.operatorToken.getText(Targ.context().ud.sf)
        return `${e1} ${op} ${e2}`
    }
    else if (Ts.isParenthesizedExpression(expr)) {
        const e = make(expr.expression)
        return `(${e})`
    }
    else {
        Ast.fail('Expr', expr)
        return ''
    }
}