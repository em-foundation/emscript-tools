import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Unit from './Unit'

const sufMap = new Map<string, string>([
    ['Function', '#f'],
    ['Method', '#f'],
    ['TypeAlias', '#t']
])

const types = new Set<string>([
    'arg_t',
    'bool_t',
    'i8',
    'i16',
    'i32',
    'text_t',
    'u8',
    'u16',
    'u32',
])

export function exec(ud: Unit.Desc, verbose?: boolean): string {
    const unitSet = findUnits(ud.sf)
    const inSrc = ud.sf.getText(ud.sf)
    let outSrc = ''
    let idx = 0
    const visit = (node: Ts.Node): void => {
        if (Ts.isIdentifier(node)) {
            const id = node.text
            const sym = ud.tc.getSymbolAtLocation(node)
            if (sym && !types.has(id) && !id.match(/^(em)?\$/)) {
                let suf: string | undefined
                if (unitSet.has(id) && isFirst(node, ud.sf)) {
                    suf = '#u'
                }
                else {
                    const kind = Ts.SymbolFlags[sym.flags]
                    if (verbose) console.log(node.text, kind)
                    suf = sufMap.get(kind)
                }
                if (suf) {
                    // console.log(`${id}${suf}`, node.getStart(), node.getWidth())
                    const end = node.getStart() + node.getWidth()
                    outSrc += inSrc.slice(idx, end)
                    outSrc += suf
                    idx = end
                }
            }
        }
        Ts.forEachChild(node, visit)
    }
    visit(ud.sf)
    if (idx < inSrc.length) outSrc += inSrc.slice(idx)
    return outSrc
}

function findUnits(sf: Ts.SourceFile): Set<string> {
    const unitSet = new Set<string>()
    sf.statements.map((stmt) => {
        if (Ts.isImportDeclaration(stmt)) {
            const modSpecNode = stmt.moduleSpecifier
            if (Ts.isStringLiteral(modSpecNode)) {
                let modSpec = modSpecNode.text
                const iuMatch = modSpec.match(/^@(.+)\.em$/)
                if (iuMatch) {
                    const inMatch = stmt.importClause!.getText(sf).match(/\W*(\w+)$/)
                    unitSet.add(inMatch![1])
                }
            }
        }
        else if (Ts.isVariableStatement(stmt)) {
            const dtxt = stmt.declarationList.declarations[0].getText(sf)
            const m = dtxt.match(/^(\w+)\W+(\w+)\.\$clone\(.*\)$/)
            if (!m) return
            unitSet.add(m[1])
        }

    })
    return unitSet
}

function isFirst(node: Ts.Identifier, sf: Ts.SourceFile): boolean {
    const parent = node.parent
    if (!Ts.isPropertyAccessExpression(parent)) return true
    if (!parent.getText(sf).startsWith(`${node.text}.`)) return false
    return true
}
