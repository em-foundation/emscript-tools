import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Err from './Err'
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
    else if (expr.kind === Ts.SyntaxKind.FalseKeyword || expr.kind === Ts.SyntaxKind.TrueKeyword) {
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
        const dbg = mkDbg(expr.expression)
        if (dbg) return `${dbg}${make(expr.arguments[0])})`
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
    else if (Ts.isElementAccessExpression(expr)) {
        const dbg = mkDbg(expr)
        if (!dbg) Err.fail(`unknown element access`)
        return dbg!
    }
    else if (Ts.isBinaryExpression(expr)) {
        const e1 = make(expr.left)
        const e2 = make(expr.right)
        const op = expr.operatorToken.getText(Targ.context().ud.sf)
        return `${e1} ${op} ${e2}`
    }
    else if (Ts.isConditionalExpression(expr)) {
        const ec = make(expr.condition)
        const e1 = make(expr.whenTrue)
        const e2 = make(expr.whenFalse)
        return `${ec} ? ${e1} : ${e2}`
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

function mkDbg(expr: Ts.Expression): string | null {
    if (!Ts.isElementAccessExpression(expr)) return null
    const sf = Targ.context().ud.sf
    const txt = expr.expression.getText(sf)
    if (txt != 'em.$') return null
    const dbg = expr.argumentExpression.getText(sf)
    const m = dbg.match(/^'\%\%([a-d])([-+:]?)'$/)
    const id = m![1].charCodeAt(0) - 'a'.charCodeAt(0)
    const op = m![2]
    const fxnMap = new Map<string, string>([
        ['-', 'minus'],
        ['+', 'plus'],
        [':', 'mark'],
        ['', 'pulse'],
    ])
    const suf = op == ':' ? ', ' : ')'
    return `em_lang_Debug::${fxnMap.get(op)}(${id}${suf}`
}