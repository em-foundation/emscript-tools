import * as Path from 'path'
import * as Ts from 'typescript'

import * as Session from './Session'

let unitTab = new Map<string, Desc>()

export type Kind = 'MODULE' | 'INTERFACE' | 'COMPOSITE' | 'TEMPLATE'

export class Desc {
    constructor(
        readonly id: string,
        readonly kind: Kind,
        readonly sf: Ts.SourceFile,
        readonly tc: Ts.TypeChecker,
        private _imports: Map<string, string>
    ) { }
    addImport(impName: string, impUid: string) { this._imports.set(impName, impUid) }
    get cname(): string { return this.id.replaceAll(/[./]/g, '_') }
    get imports(): ReadonlyMap<string, string> { return this._imports }
}

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

export function create(sf: Ts.SourceFile, tc: Ts.TypeChecker): Desc {
    const uid = Session.mkUid(sf.fileName)
    if (unitTab.has(uid)) return unitTab.get(uid)!
    const sobj = scan(sf)
    const unit = new Desc(uid, sobj.kind, sf, tc, sobj.imps)
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
}

function scan(sf: Ts.SourceFile): ScanResult {
    let res = { kind: 'MODULE', imps: new Map<string, string> } as ScanResult
    sf.statements.map((stmt) => {
        if (Ts.isImportDeclaration(stmt)) {
            const modSpecNode = stmt.moduleSpecifier
            if (Ts.isStringLiteral(modSpecNode)) {
                let modSpec = modSpecNode.text
                const iuMatch = modSpec.match(/^@(.+)\.em$/)
                if (iuMatch) {
                    const inMatch = stmt.importClause!.getText(sf).match(/([\w_$]+)$/)
                    res.imps.set(inMatch![1], iuMatch[1])
                }
            }
        }
        else if (Ts.isVariableStatement(stmt)) {
            const m = stmt.getText(sf).match(/em\.declare\(['"](\w+)['"]/)
            if (m) res.kind = m[1] as Kind
        }
    })
    return res
}

interface TransResult {
    sf: Ts.SourceFile,
    kind: Kind,
    imps: Map<string, string>
}

function transform(sf: Ts.SourceFile): TransResult {
    let res = { kind: 'MODULE', imps: new Map<string, string> } as TransResult
    const transformer = (context: Ts.TransformationContext) => {
        return (sf: Ts.SourceFile): Ts.SourceFile => {
            const visitor: Ts.Visitor = (node) => {
                if (Ts.isImportDeclaration(node)) {
                    const modSpecNode = node.moduleSpecifier
                    if (Ts.isStringLiteral(modSpecNode)) {
                        let modSpec = modSpecNode.text.replace('@$$emscript', '../em.lang/emscript')
                        const iuMatch = modSpec.match(/^@(.+)\.em$/)
                        if (iuMatch) {
                            modSpec = modSpec.replace('@', '../')
                            const inMatch = node.importClause!.getText(sf).match(/\W*(\w+)$/)
                            res.imps.set(inMatch![1], iuMatch[1])
                        }
                        const updNode = Ts.factory.updateImportDeclaration(
                            node,
                            node.modifiers,
                            node.importClause,
                            Ts.factory.createStringLiteral(modSpec),
                            node.attributes
                        )
                        return updNode
                    }
                }
                if (Ts.isVariableStatement(node)) {
                    const m = node.getText(sf).match(/em\.declare\(['"](\w+)['"]/)
                    if (m) {
                        res.kind = m[1] as Kind
                        const orig = node.declarationList.declarations[0]
                        const varDecl = Ts.factory.createVariableDeclaration(
                            orig.name,
                            undefined,
                            undefined,
                            Ts.factory.createCallExpression(
                                Ts.factory.createPropertyAccessExpression(
                                    Ts.factory.createIdentifier("em"),
                                    "declare"
                                ),
                                undefined,
                                [
                                    Ts.factory.createStringLiteral(res.kind),
                                    Ts.factory.createStringLiteral(sf.fileName)
                                ]
                            )
                        );
                        const varDeclList = Ts.factory.createVariableDeclarationList(
                            [varDecl],
                            Ts.NodeFlags.Const
                        );
                        const varStmt = Ts.factory.createVariableStatement(
                            node.modifiers,
                            varDeclList
                        );
                        return varStmt
                    }
                }
                return node
            }
            const updatedStatements: Ts.Statement[] = sf.statements.map(stmt =>
                Ts.visitNode(stmt, visitor) as Ts.Statement
            )
            return Ts.factory.updateSourceFile(sf, updatedStatements)
        }
    }
    res.sf = Ts.transform(sf, [transformer]).transformed[0]
    return res
}

export function units(): ReadonlyMap<string, Desc> {
    return unitTab
}