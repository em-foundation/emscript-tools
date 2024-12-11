import * as Path from 'path'
import * as Ts from 'typescript'

let unitTab = new Map<string, UnitDesc>()

export type UnitKind = 'MODULE' | 'INTERFACE' | 'COMPOSITE' | 'TEMPLATE'

class UnitDesc {
    constructor(
        readonly id: string,
        readonly kind: UnitKind,
        readonly sf: Ts.SourceFile,
        readonly imports: Map<string, string>
    ) { }
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

export function create(sf: Ts.SourceFile): UnitDesc {
    const tobj = transform(sf)
    printSf(tobj.sf)
    const unit = new UnitDesc(mkUid(sf.fileName), tobj.kind, tobj.sf, tobj.imps)
    // sf.statements.map(stmt => {
    //     if (Ts.isImportDeclaration(stmt)) {
    //         const iuMatch = stmt.moduleSpecifier.getText(sf).match(/^['"]@(.+)\.em['"]$/)
    //         if (!iuMatch) return
    //         const inMatch = stmt.importClause!.getText(sf).match(/\W*(\w+)$/)
    //         unit.addImport(inMatch![1], iuMatch[1])
    //     }
    // })
    unitTab.set(unit.id, unit)
    return unit
}

interface TransResult {
    sf: Ts.SourceFile,
    kind: UnitKind,
    imps: Map<string, string>
}

function mkStmtNode(frag: string): Ts.Statement {
    const sf = Ts.createSourceFile('$$.ts', frag, Ts.ScriptTarget.Latest, true);

    // Print original and clone of the source file to debug
    printNode(sf);  // Debug: original SourceFile text
    const sfClone = cloneNode(sf);  // Clone the SourceFile
    printNode(sfClone);  // Debug: cloned SourceFile text

    // Extract and print the statement after cloning
    const stmt = sfClone.statements[0];
    if (Ts.isVariableStatement(stmt)) {
        const varStmt = Ts.factory.createVariableStatement(stmt.modifiers, stmt.declarationList);
        printNode(varStmt);  // Debug: the recreated VariableStatement
    }

    // Return a clean clone of the statement
    return cloneNode(stmt);
}


function mkStmtNode2(frag: string): Ts.Statement {
    const sf = Ts.createSourceFile('$$.ts', frag, Ts.ScriptTarget.Latest, true)
    printNode(sf)
    const sfClone = cloneNode(sf)
    printNode(sfClone)
    const stmt = sfClone.statements[0]
    if (Ts.isVariableStatement(stmt)) {
        const varStmt = Ts.factory.createVariableStatement(stmt.modifiers, stmt.declarationList)
        printNode(varStmt)
    }
    return cloneNode(stmt)
}

export function mkUid(upath: string): string {
    return `${Path.basename(Path.dirname(upath))}/${Path.basename(upath, '.em.ts')}`
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

function transform(sf: Ts.SourceFile): TransResult {
    let res = { kind: 'MODULE', imps: new Map<string, string> } as TransResult
    const transformer = (context: Ts.TransformationContext) => {
        return (sf: Ts.SourceFile): Ts.SourceFile => {
            const visitor: Ts.Visitor = (node) => {
                if (Ts.isImportDeclaration(node)) {
                    const modSpecNode = node.moduleSpecifier
                    if (Ts.isStringLiteral(modSpecNode)) {
                        let modSpec = modSpecNode.text.replace('@EM-SCRIPT', '../em.lang/em-script')
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
                        res.kind = m[1] as UnitKind
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


                        // const frag = node.getText(sf).replace(/\)$/, `, '${sf.fileName}')`)
                        // const stmt = mkStmtNode(frag) as Ts.VariableStatement
                        // return Ts.factory.createVariableStatement(stmt.modifiers, stmt.declarationList)
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
    // printSf(res.sf)
    return res
}

export function units(): ReadonlyMap<string, UnitDesc> {
    return unitTab
}