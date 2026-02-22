import Fs from 'fs'
import He from 'he'
import Path from 'path'

import {
    Choice, Comment, ComplexDiagram, Diagram, Group, HorizontalChoice, NonTerminal, Node,
    Options, OneOrMore, Optional, Skip, Sequence, Stack, Terminal, VerticalSequence, ZeroOrMore
} from '@prantlf/railroad-diagrams'

const $ch = (...items: Node[]) => new Choice(0, ...items)
const $cf = (text: string, kind?: string) => new Comment(text, { title: kind ?? 'x' })
const $cn = (idx: number, ...items: Node[]) => new Choice(idx, ...items)
const $co = (text: string) => new Comment(text)
const $cd = (...items: Node[]) => new ComplexDiagram(...items)
const $dg = (...items: Node[]) => new Diagram(...items)
const $gr = (item: Node, label?: string) => new Group(item, label)
const $hc = (...items: Node[]) => new HorizontalChoice(...items)
const $nt = (text: string, title?: string) => new NonTerminal(text, { title: title, href: `#${text.trim()}` })
const $om = (item: Node, rep?: any) => new OneOrMore(item, rep)
const $op = (item: Node) => new Optional(item, 'skip')
const $sk = () => new Skip()
const $sq = (...items: Node[]) => new Sequence(...items)
const $st = (...items: Node[]) => new Stack(...items)
const $tn = (text: string) => new Terminal(text)
const $vs = (...items: Node[]) => new VerticalSequence(...items)
const $zm = (item: Node, rep?: any, skip?: any) => new ZeroOrMore(item, rep, skip)

Options.COMMENT_CHAR_WIDTH = 8
Options.INTERNAL_ALIGNMENT = 'left'
Options.AR = 6

const G = new Map<string, Diagram>()

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
        $nt('enum-type-decl  '),
        $nt('struct-type-decl'),
        $nt('vector-type-decl '),
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

G.set('vector-type-decl', $cd(
    $op($cf('export', 'k')),
    $cf('class', 'b'),
    $tn('name'),
    $cf('extends $vector<', 'br'),
    $nt('type'),
    $cf('> { $len =', 'r'),
    $nt('expr'),
    $cf('}'),
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
    $sq($tn('declared-name'), $co('scoped symbol')),
    $sq($nt('literal-value'), $co('42, true, ...')),
    $sq($cf('('), $nt('expr'), $cf(')')),
    $sq($nt('binary-expr  '), $co('e1 OP e2')),
    $sq($nt('call-expr    '), $co('e (...ei)')),
    $sq($nt('cast-expr    '), $co('<T> e')),
    $sq($nt('cond-expr    '), $co('e1 ? e2 : e3')),
    $sq($nt('selector-expr'), $co('e . s')),
    $sq($nt('unary-expr   '), $co('OP e, e OP')),
)))

G.set('literal-value', $cd($ch(
    $sq($tn('decimal-num'), $co('42, -7, 0')),
    $sq($tn('hex-num    '), $co('0x24, 0xDEAD_beef')),
    $sq($tn('binary-num '), $co('0b1101')),
    $sq($tn('octal-num  '), $co('0o755')),
    $sq($hc($cf('true', 'b'), $cf('false', 'b')), $co('boolean')),
    $sq($cf('$null', 'r'), $co('reference')),
    $sq($cf('$c`', 'r'), $tn('text'), $cf('`'), $co('char')),
    $sq($cf('$t`', 'r'), $tn('text'), $cf('`'), $co('string')),
    $sq($cf('$e`', 'r'), $tn('text'), $cf('`'), $co('C/C++ expr')),
)))

G.set('binary-expr', $cd(
    $nt('expr'),
    $ch(
        $hc($cf('+'), $cf('-'), $cf('*'), $cf('/'), $cf('%')),
        $hc($cf('=='), $cf('!='), $cf('>'), $cf('>='), $cf('<'), $cf('<=')),
        $hc($cf('&'), $cf('|'), $cf('^ '), $cf('<<'), $cf('>>')),
        $hc($cf('='), $cf('&&'), $cf('||')),
        $hc($cf('=+'), $cf('=-'), $cf('=*'), $cf('=/'), $cf('=%')),
        $hc($cf('=&'), $cf('=|'), $cf('=^'), $cf('=<<'), $cf('=>>')),
    ),
    $nt('expr'),
))

G.set('call-expr', $cd(
    $nt('expr'),
    $cf('('),
    $zm($nt('expr'), $sq($co('*'), $cf(','))),
    $cf(')'),
))

G.set('cast-expr', $cd(
    $cf('<'),
    $nt('type'),
    $cf('>'),
    $nt('expr'),
))

G.set('cond-expr', $cd(
    $nt('expr'),
    $cf('?'),
    $nt('expr'),
    $cf(':'),
    $nt('expr'),
))

G.set('selector-expr', $cd(
    $nt('expr'),
    $cf('.'),
    $ch(
        $tn('field-name'),
        $tn('method-name'),
        $sq($cf('$ intrinsic', 'rR'), $co('meta+target :: $len, $make, $ref, ...')),
        $sq($cf('$$ intrinsic', 'xX'), $co('meta-only :: $$add, $$val, ...')),
        $sq($cf('$$'), $co('target-only :: pointer dereference')),
    )
))

G.set('unary-expr', $cd($ch(
    $sq($hc($cf('+'), $cf('-'), $cf('!'), $cf('~'), $cf('++'), $cf('--')), $nt('expr')),
    $sq($nt('expr'), $hc($cf('++'), $cf('--')))
)))

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
    $cf('f32   ', 't'),
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
        $sq($nt('module-unit   '), $co('// meta+target implementation')),
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

const TARG_IMPL = $zm($ch($nt('decl'), $nt('func')), $co('*'))
const TARG_IMPL2 = $zm($nt('func'), $co('*'))
const TARG_SPEC = $zm($nt('method-decl'), $co('*'))

G.set('module-unit', $cd($vs(
    $cf(`import '@$$emscript'`, 'ks'),
    $gr($sq($cf(`export const $U = $declare('MODULE'`, 'kbrrs'), $op($sq($cf(`,`), $tn('interface-name'))), $cf(`)`))),
    $sk(),
    $nt('unit imports '),
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

G.set('unit-features', $cd(UNIT_FEATURES))

G.set('interface-unit', $cd($vs(
    $cf(`import '@$$emscript'`, 'ks'),
    $cf(`export const $U = $declare('INTERFACE')`, 'kbrrs'),
    $sk(),
    $nt('unit imports '),
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

G.set('unit-exports', $cd(UNIT_EXPORTS))

G.set('template-unit', $cd($vs(
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

const _generate_ = null

export function generate(out_dir: string) {

    const css_txt = Fs.readFileSync(Path.join(__dirname, 'grammar.css'), 'utf-8')

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>EM•Script Grammar</title>
    <link rel="stylesheet" href="./grammar.css">
    <script>
        history.scrollRestoration = 'manual'
        window.scrollTo(0, 0)
    </script>
    <style>
${css_txt.replace(/\/\*[\s\S]*?\*\//g, '')}
    </style>
</head>
<body>
<div align="center">
`
    console.log('grammar productions ...')
    for (const [name, diag] of G) {
        console.log(`    ${name}`)
        const svg = fixup(diag.format(15).toString())
        html += `<div id="${name}" class="diagramHeader">${name}</div>\n`
        html += `<div class="diagramFrame">${svg}</div>\n`
    }
    html += `
</div>
</body>
</html>
`
    const out_file = Path.join(out_dir, 'grammar.html')
    console.log(`\nwriting ${out_file}`)
    Fs.writeFileSync(out_file, html)
}

function fixup(svg: string) {
    const re = /^(<text\b[^>]*class=)"comment">(.*?)<\/text>\s*<title>([a-zA-Z]*)<\/title>/gm
    return svg.replaceAll(re, (_, m1, m2, m3) => `${m1}"code-frag">${span(m2, m3)}</text>`)
}

function span(frag: string, mask: string) {
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
