import * as Ts from 'typescript'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

import * as Session from './Session'

export type SemTokType =
    | 'em-debug'
    | 'em-deref'
    | 'em-domain'
    | 'em-ident'
    | 'em-special'
    | 'em-unit'
    | 'em-wrong'

export type SemTok = {
    start: number
    length: number
    type: SemTokType
}

export type SemTokFile = {
    version: 1
    srcRel: string
    srcMtimeMs: number
    srcSize: number
    tokTypes: SemTokType[]
    tokens: number[] // [start, length, typeIndex]...
}

function addTok(out: SemTok[], node: Ts.Node, tokType: SemTokType) {
    const start = node.getStart()
    const end = node.getEnd()
    const length = end - start
    if (length <= 0) return
    out.push({ start, length, type: tokType })
}

function isFirst(node: Ts.Identifier, sf: Ts.SourceFile): boolean {
    const parent = node.parent
    if (!Ts.isPropertyAccessExpression(parent)) return true
    if (!parent.getText(sf).startsWith(`${node.text}.`)) return false
    return true
}

function addComments(text: string, out: SemTok[]) {
    const re = /^\/\/\>.+$/gm
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, length: m[0].length, type: 'em-domain' })
    }
}

function collectUnitSet(sf: Ts.SourceFile): Set<string> {
    const unitSet = new Set<string>()

    for (const stmt of sf.statements) {
        if (Ts.isImportDeclaration(stmt)) {
            const modSpecNode = stmt.moduleSpecifier
            if (Ts.isStringLiteral(modSpecNode)) {
                const modSpec = modSpecNode.text
                const iuMatch = modSpec.match(/^@(.+)\.em$/)
                if (iuMatch) {
                    const inMatch = stmt.importClause?.getText(sf).match(/\W*(\w+)$/)
                    if (inMatch) unitSet.add(inMatch[1])
                }
            }
            continue
        }

        if (Ts.isVariableStatement(stmt)) {
            const decl0 = stmt.declarationList.declarations[0]
            if (!decl0) continue
            const dtxt = decl0.getText(sf)

            const mc = dtxt.match(/^(\w+)\W+\$clone\((\w+)\)$/)
            if (mc) {
                unitSet.add(mc[1])
                continue
            }

            const md = dtxt.match(/^(\w+)\W+\$delegate\(.*\)$/)
            if (md) {
                unitSet.add(md[1])
                continue
            }
        }
    }

    return unitSet
}

function scanToks(fileName: string, text: string): { tokTypes: SemTokType[]; tokens: SemTok[] } {
    const sf = Ts.createSourceFile(fileName, text, Ts.ScriptTarget.Latest, /*setParentNodes*/ true)

    const tokens: SemTok[] = []
    addComments(text, tokens)

    const unitSet = collectUnitSet(sf)

    const visitNode = (node: Ts.Node): void => {
        if (Ts.isIdentifier(node)) {
            const name = node.text
            let tokType: SemTokType | '' = ''

            if (name === 'em') tokType = 'em-ident'
            else if (name === '$$') tokType = 'em-deref'
            else if (name.match(/^\$bkpt|fail|halt|printf$/)) tokType = 'em-debug'
            else if (unitSet.has(name) && isFirst(node, sf)) tokType = 'em-unit'
            else if (name.startsWith('$$')) tokType = 'em-domain'
            else if (name.startsWith('$')) tokType = 'em-special'
            else if (name.match(/^em\$(meta|targ|template)$/)) tokType = 'em-domain'
            else if (name.match(/^em\$_[CDIRTU]$/)) tokType = 'em-special'
            else if (name.match(/^em\$(configure|construct|fail|generate|halt|init|onexit|ready|reset|run|startup)/))
                tokType = 'em-special'
            else if (name.match(/^[cet]\$/)) tokType = 'em-deref'
            else if (name.match(/^em\$/)) tokType = 'em-wrong'

            if (tokType) addTok(tokens, node, tokType)
            return
        }

        if (Ts.isElementAccessExpression(node)) {
            const txt = node.expression.getText(sf)
            if (txt === '$' || txt === 'em.$') {
                addTok(tokens, node, 'em-debug')
                return
            }
            Ts.forEachChild(node, visitNode)
            return
        }

        if (Ts.isPropertyAccessExpression(node)) {
            const txt = node.getText(sf)
            if (txt.match(/^em\.(\$bkpt|fail|halt|printf|\$reg)/)) {
                addTok(tokens, node.expression, 'em-debug')
                addTok(tokens, node.name, 'em-debug')
                return
            }
            if (txt.match(/^em\.(declare|\$declare)/)) {
                addTok(tokens, node, 'em-ident')
                return
            }
            Ts.forEachChild(node, visitNode)
            return
        }

        Ts.forEachChild(node, visitNode)
    }

    Ts.forEachChild(sf, visitNode)

    // stable sort: start, then longer first (helps overlap cases)
    tokens.sort((a, b) => (a.start - b.start) || (b.length - a.length))

    const tokTypes: SemTokType[] = [
        'em-debug',
        'em-deref',
        'em-domain',
        'em-ident',
        'em-special',
        'em-unit',
        'em-wrong',
    ]

    return { tokTypes, tokens }
}

function mkOutName(srcRel: string): string {
    // package/bucket/Unit.em.ts -> package-bucket-Unit.json
    const p = srcRel.replace(/\\/g, '/')
    const noExt = p.replace(/\.em\.ts$/, '')
    const parts = noExt.split('/')
    return `${parts.join('-')}.json`
}

export function generate(upath: string) {
    const rootDir = Session.getRootDir()
    const outDirRel = '.semtok'
    const srcAbs = Path.join(rootDir, 'workspace', upath)

    const text = Fs.readFileSync(srcAbs, 'utf8')
    const stat = Fs.statSync(srcAbs)

    const { tokTypes, tokens } = scanToks(srcAbs, text)

    const typeToIndex = new Map<SemTokType, number>()
    tokTypes.forEach((t, i) => typeToIndex.set(t, i))

    const packed: number[] = []
    for (const t of tokens) {
        const ti = typeToIndex.get(t.type)
        if (ti === undefined) continue
        packed.push(t.start, t.length, ti)
    }

    const out: SemTokFile = {
        version: 1,
        srcRel: upath,
        srcMtimeMs: stat.mtimeMs,
        srcSize: stat.size,
        tokTypes,
        tokens: packed,
    }

    const outDirAbs = Path.join(rootDir, '.semtok')
    Fs.mkdirSync(outDirAbs, { recursive: true })

    const outName = mkOutName(upath)
    const outAbs = Path.join(outDirAbs, outName)

    Fs.writeFileSync(outAbs, JSON.stringify(out, null, 4) + '\n', 'utf8')
}
