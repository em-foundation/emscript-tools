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
    else if (Ts.isPropertyAccessExpression(expr)) {
        const sa = expr.getText(Targ.context().ud.sf).split('.')
        if (sa[0] == 'em$_R') {
            if (sa.length == 4 && sa[3] == '$$') {
                const mn = sa[1].match(/([A-Za-z]+)/)![1]
                return `*em::$reg32(${sa[1]}_BASE + ${mn}_O_${sa[2]})`
            }
            else {
                return sa[1]
            }
        }
        else {
            return sa.join('::')
        }
    }
    else if (Ts.isCallExpression(expr)) {
        let res = make(expr.expression) + '('
        let sep = ''
        expr.arguments.forEach(arg => {
            res += sep
            res += make(arg)
            sep = ', '
        })
        res += ')'
        return res
    }
    else if (Ts.isBinaryExpression(expr)) {
        const e1 = make(expr.left)
        const e2 = make(expr.right)
        const op = expr.operatorToken.getText(Targ.context().ud.sf)
        return `${e1} ${op} ${e2}`
    }
    else if (Ts.isPostfixUnaryExpression(expr)) {
        const e = make(expr.operand)
        const op = Ts.tokenToString(expr.operator)
        return `${e}${op}`
    }
    else if (Ts.isPrefixUnaryExpression(expr)) {
        const e = make(expr.operand)
        const op = Ts.tokenToString(expr.operator)
        return `${op}${e}`
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