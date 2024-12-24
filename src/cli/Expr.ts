import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Config from './Config'
import * as Targ from './Targ'

export function make(expr: Ts.Expression): string {
    const sf = Targ.context().ud.sf
    if (Ts.isNumericLiteral(expr)) {
        return expr.getText(sf).replaceAll("_", "'")
    }
    else if (Ts.isLiteralExpression(expr)) {
        return expr.getText(sf)
    }
    else if (Ts.isIdentifier(expr)) {
        return expr.getText(sf)
    }
    else if (Ts.isPropertyAccessExpression(expr)) {
        const sa = expr.getText(Targ.context().ud.sf).split('.')
        if (sa[0] == 'em$_R') {
            if (sa[sa.length - 1] == '$$') {
                const mod = sa[1].match(/([A-Za-z]+)/)![1]
                let idx = ''
                if (sa.length == 5) {
                    const e = sa[3].match(/\[(.+)\]/)![1]
                    idx = ` + (${e}) * 4`
                }
                return `*em::$reg32(${sa[1]}_BASE + ${mod}_O_${sa[2]}${idx})`
            }
            else {
                return sa[1]
            }
        }
        else if (Config.getKind(expr.expression) != 'NONE') {
            return sa.join('.')
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