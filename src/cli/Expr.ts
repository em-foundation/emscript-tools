import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Err from './Err'
import * as Config from './Config'
import * as Targ from './Targ'
import * as Type from './Type'

let unescapeJs = require('unescape-js')

export function make(expr: Ts.Expression): string {
    const sf = Targ.context().ud.sf
    const tc = Targ.context().ud.tc
    const txt = expr.getText(sf)
    if (Ts.isNumericLiteral(expr)) {
        return txt.replaceAll("_", "'")
    }
    else if (Ts.isStringLiteral(expr)) {
        const etxt = expr.text
        const sval = JSON.stringify(etxt)
        if (etxt.startsWith('#') && etxt.length == 2) {
            return `'${sval.slice(2, -1)}'`
        }
        else {
            return sval
        }
    }
    else if (Ts.isLiteralExpression(expr)) {
        return txt
    }
    else if (expr.kind === Ts.SyntaxKind.FalseKeyword || expr.kind === Ts.SyntaxKind.TrueKeyword) {
        return txt
    }
    else if (expr.kind === Ts.SyntaxKind.NullKeyword) {
        return 'em::null'
    }
    else if (Ts.isIdentifier(expr)) {
        if (txt.startsWith('$')) return `em::${txt}`
        return txt
    }
    else if (Ts.isPropertyAccessExpression(expr)) {
        const sa = txt.split('.')
        const etxt = expr.expression.getText(sf)
        // const DEBUG = txt.startsWith('str.')
        const DEBUG = false
        if (DEBUG) console.log(txt)
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
        else if (tc.getTypeAtLocation(expr.expression).isClass()) {
            const tn = Ast.getTypeExpr(tc, expr.expression)
            if (DEBUG) console.log(`    class ${tn}: ${etxt}`)
            if (etxt.endsWith('.$$')) {
                const base = (expr.expression as Ts.PropertyAccessExpression).expression
                return `${make(base)}->${expr.name.text}`
            }
            return `${make(expr.expression)}.${expr.name.text}`
        }
        else {
            const tn = Ast.getTypeExpr(tc, expr.expression)
            if (tn == 'any' && sa[1] == '$$') return sa[0]  // em$BoxedVal
            const op = mkSelOp(tn)
            if (op == '::') return sa.join(op)
            if (DEBUG) console.log(`    ${tn}`)
            if (sa.length == 2 && (tn.match(/^(ptr_t|ref_t)/))) {
                return (sa[1] == '$$') ? `(*(${sa[0]}))` : `${sa[0]}.${sa[1]}`
            }
            return `${make(expr.expression)}.${expr.name.text}`
        }
    }
    else if (Ts.isExpressionWithTypeArguments(expr)) {
        const op = expr.expression.getText(sf).replace('$', '')
        const ts = Type.make(expr.typeArguments![0])
        return `${op}(${ts})`
    }
    else if (Ts.isCallExpression(expr)) {
        if (txt.startsWith('$cb')) return make(expr.arguments[0])
        const dbg = mkDbg(expr.expression, txt)
        if (dbg) return `${dbg}${make(expr.arguments[0])})`
        const printf = mkPrintf(expr)
        if (printf) return printf
        const textVal = mkText(expr, txt)
        if (textVal) return textVal
        const makeCall = mkMakeCall(expr, txt)
        if (makeCall) return makeCall
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
    else if (Ts.isTaggedTemplateExpression(expr)) {
        const tag = expr.tag.getText(sf)
        const ts = expr.template.getText(sf).slice(1, -1)
        if (tag.endsWith('c$')) {
            return `'${ts}'`
        }
        if (tag.endsWith('e$')) {
            return ts
        }
        if (tag.endsWith('t$')) {
            const js = JSON.parse(`"${ts}"`)
            return `em::text_t(${JSON.stringify(js)}, ${(js as string).length})`
        }
        return `<< UNKNOWN >>`
    }
    else if (Ts.isElementAccessExpression(expr)) {
        const dbg = mkDbg(expr, txt)
        if (dbg) return dbg
        const e = make(expr.expression)
        const i = make(expr.argumentExpression)
        return `${e}[${i}]`
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
    else if (Ts.isTypeAssertionExpression(expr)) {
        const t = Type.make(expr.type)
        const e = make(expr.expression)
        return t == Type.UNKNOWN ? e : `(${t})(${e})`
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

function mkDbg(expr: Ts.Expression, txt: string): string | null {
    if (!Ts.isElementAccessExpression(expr)) return null
    const sf = Targ.context().ud.sf
    if (!txt.startsWith('em.$')) return null
    if (txt.startsWith('em.$reg')) {
        const m = txt.match(/^em\.(.+)\[/)
        const addr = make(expr.argumentExpression)
        return `*em::${m![1]}(${addr})`
    }
    const dbg = expr.argumentExpression.getText(sf)
    if (dbg.startsWith("'%%>")) return 'em_lang_Console::wr('
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

function mkMakeCall(expr: Ts.CallExpression, txt: string): string | null {
    if (!txt.endsWith('.$make()')) return null
    if (!Ts.isPropertyAccessExpression(expr.expression)) return null
    return `${make(expr.expression.expression)}::$make()`
}

function mkSelOp(tn: string): string {
    let re = /^(frame_t|ptr_t|ref_t|oref_t|text_t)|(em\$(ArrayVal|buffer|frame|ptr|text))/
    return tn.match(re) ? '.' : '::'
}

function mkPrintf(expr: Ts.CallExpression): string | null {
    if (!Ts.isTaggedTemplateExpression(expr.expression)) return null
    const texpr = expr.expression
    const sf = Targ.context().ud.sf
    const tag = texpr.tag.getText(sf)
    if (!tag.endsWith('printf')) return null
    const ts = texpr.template.getText(sf).slice(1, -1)
    const len = (unescapeJs(ts) as string).length
    const fmt = `em::text_t("${ts}", ${len})`
    let res = `em_lang_Console::print(${fmt}`
    expr.arguments.forEach(e => res += ', ' + make(e))
    return res + ')'
}

function mkText(expr: Ts.CallExpression, txt: string): string | null {
    if (!Ts.isPropertyAccessExpression(expr.expression)) return null
    if (txt.startsWith('em.char_t')) {

    }
    if (!txt.startsWith('em.text_t')) return null
    const arg0 = expr.arguments[0]
    if (!Ts.isStringLiteral(arg0)) return null
    const lit = JSON.stringify(arg0.text)
    const len = (unescapeJs(lit) as string).length
    return `em::text_t(${lit}, ${len})`
}

export function mkTextVal(txt: string): string {
    const len = (unescapeJs(txt) as string).length
    return `em::text_t(${JSON.stringify(txt)}, ${len})`
}
