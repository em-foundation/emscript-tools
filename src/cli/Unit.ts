import * as Path from 'path'
import * as Ts from 'typescript'

import * as Session from './Session'

let unitTab = new Map<string, Desc>()

export type Kind = 'MODULE' | 'INTERFACE' | 'COMPOSITE' | 'TEMPLATE'

export class Desc {
    $uobj: any = {}
    constructor(
        readonly id: string,
        readonly kind: Kind,
        readonly sf: Ts.SourceFile,
        readonly tc: Ts.TypeChecker,
        private _imports: Map<string, string>,
        readonly _proxies: Set<string>
    ) { }
    addImport(impName: string, impUid: string) { this._imports.set(impName, impUid) }
    get cname(): string { return this.id.replaceAll(/[./]/g, '_') }
    get imports(): ReadonlyMap<string, string> { return this._imports }
    isMetaOnly(): boolean { return this.kind == 'COMPOSITE' || this.kind == 'TEMPLATE' }
    resolveType(ts: string): string | null {
        let m = ts.match(/^(\w+)$/)
        if (m) return m[1]
        m = ts.match(/^(\w+)\</)
        if (m) return `${m[1]}`
        m = ts.match(/^(\w+)\.(\w+)$/)
        if (!m) return null
        const iid = this._imports.get(m[1]) ?? '$'
        return `@${iid}:${m[2]}`
    }
}


/*
function cloneNode<T extends Ts.Node>(node: T): T {
    const transformer: Ts.TransformerFactory<T> = context => rootNode => {
        function visit(node: Ts.Node): Ts.Node {
            return Ts.visitEachChild(node, visit, context)
        }
        return Ts.visitNode(rootNode, visit) as T
    }
    const [cloned] = Ts.transform(node, [transformer]).transformed
    return cloned
}
*/

function addTdefs(ud: Desc) {
    const sf = ud.sf
    for (const stmt of sf.statements) {
        let key: string | undefined
        let val: string | undefined

        if (Ts.isClassDeclaration(stmt) && stmt.name) {
            const extClause = stmt.heritageClauses?.find((clause) => clause.token === Ts.SyntaxKind.ExtendsKeyword)
            const extType = extClause ? extClause.types[0] : undefined
            const extCls = extType && Ts.isExpressionWithTypeArguments(extType) && Ts.isIdentifier(extType.expression)
                ? extType.expression.text : undefined
            if (extCls === '$vector') {
                key = stmt.name.text
                val = `[${ud.resolveType(extType!.typeArguments![0].getText(sf))}`
            }
            else if (extCls === '$struct') {
                key = stmt.name.text
                val = '{'
                let sep = ''
                for (const mbr of stmt.members) {
                    if (Ts.isPropertyDeclaration(mbr) && mbr.type && !Ts.isFunctionTypeNode(mbr.type)) {
                        const mt = mbr.type ? ud.resolveType(mbr.type.getText(sf)) : 'unknown'
                        val += sep + mt
                        sep = ','
                    }
                }
            }
        }
        else if (Ts.isTypeAliasDeclaration(stmt) && stmt.name) {
            const ts = ud.resolveType(stmt.type.getText(sf))
            if (ts) {
                key = stmt.name.text
                val = ts
            }
        }
        if (key) {
            $$tdefs.set(`${ud.id}:${key}`, val!)
        }
    }
}

export function create(sf: Ts.SourceFile, tc: Ts.TypeChecker): Desc {
    const uid = Session.mkUid(sf.fileName)
    if (unitTab.has(uid)) return unitTab.get(uid)!
    const sobj = scanDecls(sf)
    // if (sobj.sizes.size > 0) console.log(uid, sobj.sizes)
    const unit = new Desc(uid, sobj.kind, sf, tc, sobj.imps, sobj.prxs)
    unitTab.set(uid, unit)
    addTdefs(unit)
    return unit
}

function printNode(node: Ts.Node) {
    const printer = Ts.createPrinter();
    const sf = Ts.createSourceFile("$$.ts", "", Ts.ScriptTarget.Latest, true);
    const txt = printer.printNode(Ts.EmitHint.Unspecified, node, sf);
    console.log(txt)
}

function printSf(sf: Ts.SourceFile) {
    const printer = Ts.createPrinter()
    const content = printer.printFile(sf)
    console.log(content)
}

interface ScanResult {
    kind: Kind,
    imps: Map<string, string>
    prxs: Set<string>
}

function scanDecls(sf: Ts.SourceFile): ScanResult {
    let res = { kind: 'MODULE', imps: new Map<string, string>, prxs: new Set<string> } as ScanResult
    const distro = Session.getDistro()
    for (const stmt of sf.statements) {
        if (Ts.isImportDeclaration(stmt)) {
            const modSpecNode = stmt.moduleSpecifier
            if (Ts.isStringLiteral(modSpecNode)) {
                let modSpec = modSpecNode.text
                const iuMatch = modSpec.match(/^@(.+)\.em$/)
                if (iuMatch) {
                    const inMatch = stmt.importClause!.getText(sf).match(/([\w_$]+)$/)
                    const iupath = iuMatch[1].replace('$distro/', `${distro.bucket}/`)
                    res.imps.set(inMatch![1], iupath)
                }
            }
            continue
        }
        if (Ts.isVariableStatement(stmt)) {
            const txt = stmt.getText(sf)
            const ma = txt.match(/\$declare\(['"](\w+)['"]/)
            if (ma) {
                res.kind = ma[1] as Kind
                continue
            }
            const mb = txt.match(/(\w+)\s*\=\s*\$(proxy|delegate)/)
            if (mb) {
                res.prxs.add(mb[1])
            }
            continue
        }
    }
    return res
}

interface TransResult {
    sf: Ts.SourceFile,
    kind: Kind,
    imps: Map<string, string>
}

export function units(): ReadonlyMap<string, Desc> {
    return unitTab
}