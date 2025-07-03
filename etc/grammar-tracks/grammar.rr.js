const Fs = require('fs')
const He = require('he')
const Rd = require('@prantlf/railroad-diagrams')

const $ch = (...items) => new Rd.Choice(0, ...items)
const $cf = (text, kind) => new Rd.Comment(text, {title: kind ?? 'x'})
const $cn = (idx, ...items) => new Rd.Choice(idx, ...items)
const $co = (text) => new Rd.Comment(text)
const $cd = (...items) => new Rd.ComplexDiagram(...items)
const $dg = (...items) => new Rd.Diagram(...items)
const $gr = (item, label) => new Rd.Group(item, label)
const $nt = (text, title) => new Rd.NonTerminal(text, {title: title, href: `#${text.trim()}`})
const $om = (item, rep) => new Rd.OneOrMore(item, rep)
const $op = (item) => new Rd.Optional(item, 'skip')
const $sk = () => new Rd.Skip()
const $sq = (...items) => new Rd.Sequence(...items)
const $st = (...items) => new Rd.Stack(...items)
const $tn = (text) => new Rd.Terminal(text)
const $vs = (...items) => new Rd.VerticalSequence(...items)
const $zm = (item, rep, skip) => new Rd.ZeroOrMore(item, rep, skip)

Rd.Options.COMMENT_CHAR_WIDTH = 8
Rd.Options.INTERNAL_ALIGNMENT = 'left'
Rd.Options.AR = 6

const G = new Map()

G.set('CATEGORY', $dg(
    $nt('decl'),
    $nt('expr'),
    $nt('func'),
    $nt('stmt'),
    $nt('type'),
    $nt('unit'),
))

const __DECL__ = null

G.set('decl', $cd($ch(
    $nt('clone-decl    '),
    $nt('config-decl   '),
    $nt('const-decl    '),
    $nt('delegate-decl '),
    $nt('proxy-decl    '),
    $nt('table-decl    '),
    $nt('type-decl     '),
    $nt('var-decl      '),
)))

G.set('clone-decl', $cd(
    $op($cf('export', 'k')),
    $cf('const', 'b'),
    $tn('name'),
    $cf('= $clone(', 'r'),
    $tn('template-name'),
    $cf(')'),
))

G.set('config-decl', $cd(
    $op($cf('export', 'k')),
    $cf('const', 'b'),
    $tn('name'),
    $cf('= $config<', 'r'),
    $nt('type'),
    $cf('>('),
    $op($nt('expr')),
    $cf(')'),
))

G.set('const-decl', $cd(
    $op($cf('export', 'k')),
    $cf('const', 'b'),
    $tn('name'),
    $op($sq($cf(':'), $nt('type'))),
    $cf('= '),
    $nt('expr'),
))

G.set('delegate-decl', $cd(
    $op($cf('export', 'k')),
    $cf('const', 'b'),
    $tn('name'),
    $cf('= $delegate(', 'r'),
    $tn('unit-name'),
    $cf('.'),
    $tn('delegate-name'),
    $cf(')'),
))

G.set('proxy-decl', $cd(
    $op($cf('export', 'k')),
    $cf('const', 'b'),
    $tn('name'),
    $cf('= $proxy<', 'r'),
    $tn('interface-name'),
    $cf('.$I>()', 'r'),
))

G.set('table-decl', $cd(
    $cn(1, $cf('const', 'b'), $cf('var  ', 'b')),
    $tn('name'),
    $cf('= $table<', 'r'),
    $nt('type'),
    $cf('>()'),
))

G.set('type-decl', $cd(
    $op($cf('export', 'k')),
    $ch(
        $nt('alias-type-decl '),
        $nt('array-type-decl '), 
        $nt('enum-type-decl  '),   
        $nt('struct-type-decl'),
)))

G.set('var-decl', $cd(
    $cf('var', 'b'),
    $tn('name'),
    $op($sq($cf(':'), $nt('type'))),
    $op($sq($cf('= '), $nt('expr'))),
))

G.set('alias-type-decl', $cd(
    $op($cf('export', 'k')),
    $cf('type', 'b'),
    $tn('name'),
    $cf('= '),
    $nt('type'),
))

G.set('array-type-decl', $cd(
    $op($cf('export', 'k')),
    $cf('class', 'b'),
    $tn('name'),
    $cf('extends $arrayof<', 'br'),
    $nt('type'),
    $cf('> { $len =', 'r'),
    $nt('expr'),
    $cf('}'),
))

G.set('enum-type-decl', $cd(
    $op($cf('export', 'k')),
    $cf('enum', 'b'),
    $tn('name'),
    $cf('{'),
    $om($sq($tn('enum-val-name')), $sq($co('*'), $cf(','))),
    $cf('}'),
))

G.set('struct-type-decl', $cd(
    $op($cf('export', 'k')),
    $cf('class', 'b'),
    $tn('name'),
    $cf('extends $struct {', 'br'),
    $om($nt('field-decl'), $co('*')),
    $cf('}'),
    $op($nt('struct-methods')),
))

G.set('field-decl', $cd(
    $tn('name'),
    $cf(':'),
    $nt('type'),
))

G.set('struct-methods', $cd(
    $op($cf('export', 'k')),
    $cf('interface', 'b'),
    $tn('struct-type-name'),
    $cf('{'),
    $om($nt('method-decl'), $co('*')),
    $cf('}'),
))

G.set('method-decl', $cd(
    $tn('name'),
    $cf('('),
    $op($nt('func-args')),
    $cf(')'),
    $cf(':'),
    $nt('type'),
))

const __EXPR__ = null

G.set('expr', $cd($ch(
    $sq($tn('constant    '), $co('123, true, ...')),
    $sq($tn('name        '), $co('scoped symbol')),
    $sq($cf('('), $nt('expr'), $cf(')')),
    $sq($nt('binary-expr '), $co('e1 OP e2')),
    $sq($nt('call-expr   '), $co('e (...ei)')),
    $sq($nt('cast-expr   '), $co('<T> e')),
    $sq($nt('cond-expr   '), $co('e1 ? e2 : e3')),
    $sq($nt('deref-expr  '), $co('e . $$')),
    $sq($nt('member-expr '), $co('e . n')),
    $sq($nt('prefix-expr '), $co('OP e')),
    $sq($nt('postfix-expr'), $co('e OP')),
)))

G.set('binary-expr', $cd(
    $nt('expr'),
    $ch(
        $cf('+ '),
        $cf('- '),
        $cf('* '),
        $cf('/ '),
        $cf('% '),
        $cf('=='),
        $cf('!='),
        $cf('> '),
        $cf('>='),
        $cf('< '),
        $cf('<='),
        $cf('& '),
        $cf('| '),
        $cf('^ '),
        $cf('= '),
        $cf('=+'),
        $cf('=*'),
        $cf('=/'),
        $cf('=%'),
        $cf('=&'),
        $cf('=|'),
        $cf('=^'),
    ),
    $nt('expr'),
))

G.set('cond-expr', $cd(
    $nt('expr'),
    $cf('?'),
    $nt('expr'),
    $cf(':'),
    $nt('expr'),
))

const __FUNC__ = null

G.set('func', $cd($ch(
    $sq(
        $op($cf('export', 'k')),
        $cf('function', 'b'),
        $tn('name'),
        $cf('('),
        $op($nt('func-args')),
        $cf(')'),
        $nt('func-body')
    ),
    $nt('method-func'),
)))

G.set('func-args', $cd($om(
    $sq(
        $tn('arg-name'),
        $cf(':'),
        $nt('type'),
        $op($sq($cf('='), $nt('expr')))
    ), $sq($co('*'), $cf(','))),
))

G.set('func-body', $cd(
    $cf('{'),
    $zm($nt('stmt'), $co('*')),
    $cf('}'),
))

G.set('method-func', $cd(
    $tn('struct-name'),
    $cf('.prototype.', 'n'),
    $tn('method-name'),
    $cf('= function(', 'b'),
    $nt('func-args'),
    $cf(')'),
    $nt('func-body')
))

const __STMT__ = null

G.set('stmt', $cd($ch(
    $nt('expr          '),
    $nt('block-stmt    '),
    $nt('for-of-stmt   '),
    $nt('if-else-stmt  '),
    $nt('local-var-stmt'),
    $nt('loop-jump-stmt'),
    $nt('return-stmt   '),
    $nt('switch-stmt   '),
    $nt('while-stmt    '),
)))

G.set('block-stmt', $cd(
    $cf('{'),
    $zm($nt('stmt'), $co('*')),
    $cf('}'),
))

G.set('local-var-stmt', $cd($ch(
    $sq(
        $cf('const', 'b'),
        $tn('name'),
        $op($sq($cf(':'), $nt('type'))),
        $cf('='),
        $nt('expr')
    ),
    $sq(
        $cf('let  ', 'b'),
        $tn('name'),
        $op($sq($cf(':'), $nt('type'))),
        $op($sq($cf('='), $nt('expr'))),
    ),
)))

G.set('if-else-stmt', $cd(
    $cf('if (', 'k'),
    $nt('expr'),
    $cf(')'),
    $nt('stmt'),
    $op($sq($cf('else', 'k'), $nt('stmt')))
))

G.set('for-of-stmt', $cd(
    $cf('for (const', 'k'),
    $tn('name'),
    $cf('of', 'k'),
    $nt('expr'),
    $cf(')'),
    $nt('stmt'),
))

G.set('loop-jump-stmt', $cd($ch(
    $cf('break   ', 'k'),
    $cf('continue', 'k'),
)))

G.set('return-stmt', $cd(
    $cf('return', 'k'),
    $op($nt('expr')),
))

G.set('switch-stmt', $cd(
    $cf('if (', 'k'),
    $nt('expr'),
    $zm($nt(`switch-case`), $co('*')),
    $op($nt(`switch-default`)),
    $cf(') {'),
))

G.set('switch-case', $cd(
    $cf('case', 'k'),
    $nt('expr'),
    $cf(':'),
    $zm($nt(`stmt`), $co('*')),
))

G.set('switch-default', $cd(
    $cf('default :', 'k'),
    $zm($nt(`stmt`), $co('*')),
))

G.set('while-stmt', $cd(
    $cf('while (', 'k'),
    $nt('expr'),
    $cf(')'),
    $nt('stmt')
))

const __TYPE__ = null

G.set('type', $cd($ch(
    $nt('basic-type    '),
    $nt('callback-type '),
    $nt('declared-type '),
    $nt('frame-type    '),
    $nt('pointer-type  '),
    $nt('reference-type'),
    $nt('volatile-type '),
)))

G.set('basic-type', $dg($ch(
    $cf('arg_t ', 't'),
    $cf('bool_t', 't'),
    $cf('i8    ', 't'),
    $cf('i16   ', 't'),
    $cf('i32   ', 't'),
    $cf('i64   ', 't'),
    $cf('text_t', 't'),
    $cf('u8    ', 't'),
    $cf('u16   ', 't'),
    $cf('u32   ', 't'),
    $cf('u64   ', 't'),
    $cf('void  ', 't'),
)))

G.set('callback-type', $cd(
    $cf('cb_t<[', 't'),
    $op($nt('type')),
    $cf(']>')
))

G.set('declared-type', $cd(
    $op($sq($tn('unit-name'), $cf('.'))),
    $tn('type-decl-name')
))

G.set('frame-type', $cd(
    $cf('frame_t<', 't'),
    $nt('type'),
    $cf('>')
))

G.set('pointer-type', $cd(
    $cf('ptr_t<', 't'),
    $nt('type'),
    $cf('>')
))

G.set('reference-type', $cd(
    $cf('$$<'),
    $nt('type'),
    $cf('>')
))

G.set('volatile-type', $cd(
    $cf('volatile_t<', 't'),
    $nt('type'),
    $cf('>')
))

const __UNIT__ = null

G.set('unit', $cd(
    $cn(2,
        $sq($nt('composite-unit'), $co('// meta-only implementation')),
        $sq($nt('interface-unit'), $co('// abstract specification')),
        $sq($nt('module-unit   '), $co('// meta|target implementation')),
        $sq($nt('template-unit '), $co('// build-time unit synthesis')),
    )
))

const UNIT_IMPORTS = $zm($sq(
    $cf('import * as', 'kk'),
    $tn('name'),
    $cf('from', 'k'),
    $nt('unit-path'),
    ), $co('*')
)
const UNIT_EXPORTS = $op($sq(
    $cf('export {', 'k'),
    $om($sq($tn('unit-name')), $sq($co('*'), $cf(','))),
    $cf('}')
))
const UNIT_FEATURES = $zm($nt('decl'), $co('*'))

const META_IMPL = $zm($ch(
    $nt('decl'),
    $nt('func'),
    $co('other typescript code')
), $co('*'))
const META_IMPL2 = $zm($ch(
    $nt('func'),
    $co('other typescript code')
), $co('*'))
const META_IMPL3 = $zm($ch(
    $nt('func'),
    $co('other typescript code')
), $co('*'))
const META_SPEC = $zm($nt('method-decl'), $co('*'))

const TARG_IMPL = $zm($nt('func'), $co('*'))
const TARG_IMPL2 = $zm($nt('func'), $co('*'))
const TARG_SPEC = $zm($nt('method-decl'), $co('*'))

G.set('module-unit', $cd($vs(
    $cf(`import '@$$emscript'`, 'ks'),
    $cf(`export const $U = $declare('MODULE')`, 'kbrrs'),
    $sk(),
    $nt('unit imports '),
    $nt('unit exports '),
    $nt('unit features'),
    $sk(),
    $co('meta implementation'),
    $cf('export namespace em$meta {', 'kb'),
    $gr(META_IMPL),
    $cf('}'),
    $sk(),
    $co('target implementation'),
    $cf('//>> ---- em$targ ---- <<//'),
    $gr(TARG_IMPL),
)))

G.set('unit-imports', $cd(UNIT_IMPORTS))

G.set('unit-path', $cd(
    $cf(`'@`),
    $tn('bundle-name'),
    $cf('/'),
    $tn('unit-name'),
    $cf(`.em.ts'`)
))

G.set('unit-exports', $cd(UNIT_EXPORTS))

G.set('unit-features', $cd(UNIT_FEATURES))

G.set('composite-unit', $cd($vs(
    $cf(`import '@$$emscript'`, 'ks'),
    $cf(`export const $U = $declare('COMPOSITE')`, 'kbrrs'),
    $sk(),
    $nt('unit imports '),
    $nt('unit exports '),
    $nt('unit features'),
    $sk(),
    $co('meta implementation'),
    $gr(META_IMPL2),
)))

G.set('interface-unit', $cd($vs(
    $cf(`import '@$$emscript'`, 'ks'),
    $cf(`export const $U = $declare('INTERFACE')`, 'kbrrs'),
    $sk(),
    $nt('unit imports '),
    $nt('unit exports '),
    $nt('unit features'),
    $sk(),
    $co('meta specification'),
    $cf('export interface em$meta {', 'kb'),
    $gr(META_SPEC),
    $cf('}'),
    $sk(),
    $co('target specification'),
    $cf('export interface $I {', 'kbr'),
    $cf('    em$meta: em$meta'),
    $gr(TARG_SPEC),
    $cf('}'),
)))

.set('template-unit', $cd($vs(
    $cf(`import '@$$emscript'`, 'ks'),
    $cf(`export const $T = $declare('TEMPLATE')`, 'kbrrs'),
    $sk(),
    $nt('unit imports '),
    $sk(),
    $cf('export namespace em$template {', 'kb'),
    $cf(`export const $U = $declare('MODULE')`, 'kbrrs'),
    $sk(),
    $nt('unit features'),
    $sk(),
    $co('meta implementation'),
    $cf('export namespace em$meta {', 'kb'),
    $gr(META_IMPL3),
    $cf('}'),
    $sk(),
    $co('target implementation'),
    $cf('//>> ---- em$targ ---- <<//'),
    $gr(TARG_IMPL2),
    $cf('}'),
    $sk(),
    $co('stock $clone implementation'),
    $cf('export function $clone() {', 'kbr'),
    $cf('    return { $T, ...em$template }', 'kr'),
    $cf('}'),
)))



const _main_ = null

if (!Fs.existsSync('diagrams')) Fs.mkdirSync('diagrams')

let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>EM•Script Grammar</title>
    <link rel="stylesheet" href="../grammar.css">
    <script>
        history.scrollRestoration = 'manual'
        window.scrollTo(0, 0)
    </script>
</head>
<body>
<div align="center">
`
for (const [name, diag] of G) {
    console.log(name)
    const svg = fixup(diag.format(15).toString())
    Fs.writeFileSync(`diagrams/${name}.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`)
    html += `<div id="${name}" class="diagramHeader">${name}</div>\n`
    html += `<div class="diagramFrame">${svg}</div>\n`
}

html += `
</div>
</body>
</html>
`

Fs.writeFileSync('diagrams/index.html', html)

function fixup(svg) {
    const re = /^(<text\b[^>]*class=)"comment">(.*?)<\/text>\s*<title>([a-z]*)<\/title>/gm
    return svg.replaceAll(re, (_, m1, m2, m3) => `${m1}"code-frag">${span(m2, m3)}</text>`)
}

function span(frag, mask) {
    const cs = He.decode(frag)
    const re = /(.*?)([\w$]+|'[^']*')/gs
    let result = ''
    let lastIndex = 0
    let i = 0
    let match
    while ((match = re.exec(cs)) !== null) {
        const [_, prefix, ident] = match
        const start = match.index
        const end = re.lastIndex
        // Append everything from lastIndex to current match start (non-matching text)
        if (start > lastIndex) {
            result += He.encode(cs.slice(lastIndex, start))
        }
        // Append prefix (non-id chars) encoded
        result += He.encode(prefix)
        // Append ident wrapped in span
        const cls = mask[i++] || ''
        result += `<tspan class="${cls}">${He.encode(ident)}</tspan>`
        lastIndex = end
    }
    // Append trailing text
    if (lastIndex < cs.length) {
        result += He.encode(cs.slice(lastIndex))
    }

    return result
}


// function span(frag, cls) {
//     const re = /^(.*?)((\w|\$)+)(.*)$/
//     const m = cs.match(re)
//     if (!m) return frag
//     const pre = He.encode(m[1])
//     const id = m[2]
//     const suf = He.encode(m[4])
//     return `${pre}<tspan class="${cls}">${id}</tspan>${suf}`
// }
