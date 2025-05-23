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
        private _tsizes: Map<string, string>
    ) { }
    addImport(impName: string, impUid: string) { this._imports.set(impName, impUid) }
    get cname(): string { return this.id.replaceAll(/[./]/g, '_') }
    get imports(): ReadonlyMap<string, string> { return this._imports }
    isMetaOnly(): boolean { return this.kind == 'COMPOSITE' || this.kind == 'TEMPLATE' }
    get tsizes(): ReadonlyMap<string, string> { return this._tsizes }
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

export function create(sf: Ts.SourceFile, tc: Ts.TypeChecker): Desc {
    const uid = Session.mkUid(sf.fileName)
    if (unitTab.has(uid)) return unitTab.get(uid)!
    const sobj = scan(sf)
    // if (sobj.sizes.size > 0) console.log(uid, sobj.sizes)
    const unit = new Desc(uid, sobj.kind, sf, tc, sobj.imps, sobj.sizes)
    unitTab.set(uid, unit)
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
    sizes: Map<string, string>
}

function resolveType(ts: string, imps: Map<string, string>): string | null {
    let m = ts.match(/^(\w+)$/)
    if (m) return m[1]
    m = ts.match(/^(\w+)\</)
    if (m) return `<${m[1]}`
    m = ts.match(/^(\w+)\.(\w+)$/)
    if (!m) return null
    const iid = imps.get(m[1]) ?? '$'
    return `${iid}:${m[2]}`
}

function scan(sf: Ts.SourceFile): ScanResult {
    let res = { kind: 'MODULE', imps: new Map<string, string>, sizes: new Map<string, string> } as ScanResult
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
            const m = stmt.getText(sf).match(/\$declare\(['"](\w+)['"]/)
            if (m) res.kind = m[1] as Kind
            continue
        }
        if (Ts.isClassDeclaration(stmt)) {
            const m = stmt.getText(sf).match(/^class\s+(\w+)\s+extends\s\$(struct|vector)/)
            if (m) {
                res.sizes.set(m[1], `$${m[2]}`)
            }
            continue
        }
        if (Ts.isTypeAliasDeclaration(stmt) && Ts.isIdentifier(stmt.name)) {
            const t = resolveType(stmt.type.getText(sf), res.imps)
            if (t) {
                res.sizes.set(stmt.name.text, t)
            }
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