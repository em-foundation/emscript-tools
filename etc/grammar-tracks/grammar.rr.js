const Fs = require('fs')
const He = require('he')
const Rd = require('@prantlf/railroad-diagrams')

const $ch = (...items) => new Rd.Choice(0, ...items)
const $cf = (text, kind) => new Rd.Comment(text, {title: kind ?? 'x'})
const $cn = (idx, ...items) => new Rd.Choice(idx, ...items)
const $co = (text) => new Rd.Comment(text)
const $cd = (...items) => new Rd.ComplexDiagram(...items)
const $dg = (...items) => new Rd.Diagram(...items)
const $nt = (text, title) => new Rd.NonTerminal(text, {title: title, href: `#${text.trim()}`})
const $om = (item, rep) => new Rd.OneOrMore(item, rep)
const $op = (item, skip) => new Rd.Optional(item, skip)
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
    $nt('stmt'),
    $nt('type'),
    $nt('unit'),
))

const __DECL__ = null

G.set('decl', $cd($ch(
    $nt('config-decl'),
    $nt('const-decl '),
    $nt('proxy-decl '),
    $nt('table-decl '),
    $nt('type-decl  '),
    $nt('var-decl   '),
)))

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
    $op($om($sq($tn('arg-name'), $cf(':'), $nt('type')), $sq($co('*'), $cf(',')))),
    $cf(')'),
    $cf(':'),
    $nt('type'),
))

const __TYPE__ = null

G.set('type', $cd($ch(
    $nt('basic-type    '),
    $nt('callback-type '),
    $nt('enum-type     '),
    $nt('frame-type    '),
    $nt('ptr-type      '),
    $nt('ref-type      '),
    $nt('volatile-type '),
    $tn('type-decl-name'),
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

G.set('frame-type', $cd(
    $cf('frame_t<', 't'),
    $nt('type'),
    $cf('>')
))

G.set('ptr-type', $cd(
    $cf('ptr_t<', 't'),
    $nt('type'),
    $cf('>')
))

G.set('ref-type', $cd(
    $cf('ref_t<', 't'),
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
        $nt('composite-unit'),
        $nt('interface-unit'),
        $nt('module-unit   '),
        $nt('template-unit '),
    )
))

G.set('module-unit', $cd($vs(
    $cf(`import em from '@$$emscript'`, 'knks'),
    $cf(`export const $U = em.$declare('MODULE')`, 'kbrnrs'),
    $nt('import-list '),
    $nt('feature-decl-list'),
    $nt('meta-code        '),
    $nt('target-code      '),
)))

G.set('import-list', $cd($zm($ch(
    $cf('import * as'),
    $co('other TypeScript import statements')
))))

let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>EM•Script Grammar</title>
    <link rel="stylesheet" href="grammar.css">
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

Fs.writeFileSync('grammar.html', html)

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
