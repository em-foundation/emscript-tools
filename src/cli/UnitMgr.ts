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

export function create(sf: Ts.SourceFile): UnitDesc {
    const tobj = transform(sf)
    // const updSf = Ts.transform(sf, [transformer]).transformed[0]
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

export function mkUid(upath: string): string {
    return `${Path.basename(Path.dirname(upath))}/${Path.basename(upath, '.em.ts')}`
}

function printSf(sf: Ts.SourceFile) {
    const printer = Ts.createPrinter();
    const content = printer.printFile(sf);
    console.log(content);
}

const transformer = (context: Ts.TransformationContext) => {
    return (sf: Ts.SourceFile): Ts.SourceFile => {
        const visitor: Ts.Visitor = (node) => {
            if (Ts.isImportDeclaration(node)) {
                const modSpecNode = node.moduleSpecifier
                if (Ts.isStringLiteral(modSpecNode)) {
                    let modSpec = modSpecNode.text.replace(/(['"](@EM-SCRIPT)['"])'/, '../em.lang/em-script')
                    console.log(`modSpec: ${modSpec}`)
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
            return node
        };
        const updatedStatements: Ts.Statement[] = sf.statements.map(stmt =>
            Ts.visitNode(stmt, visitor) as Ts.Statement
        );
        return Ts.factory.updateSourceFile(sf, updatedStatements);
    };
}


function transform(sf: Ts.SourceFile): TransResult {
    let res = { kind: 'MODULE', imps: new Map<string, string> } as TransResult
    const transformer = (context: Ts.TransformationContext) => {
        return (sf: Ts.SourceFile): Ts.SourceFile => {
            const visitor: Ts.Visitor = (node) => {
                if (Ts.isImportDeclaration(node)) {
                    const modSpecNode = node.moduleSpecifier
                    if (Ts.isStringLiteral(modSpecNode)) {
                        let modSpec = modSpecNode.text.replace(/@EM-SCRIPT/, '../em.lang/em-script')
                        console.log(`modSpec: ${modSpec}`)
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
                return node
            };
            const updatedStatements: Ts.Statement[] = sf.statements.map(stmt =>
                Ts.visitNode(stmt, visitor) as Ts.Statement
            );
            return Ts.factory.updateSourceFile(sf, updatedStatements);
        };
    }
    res.sf = Ts.transform(sf, [transformer]).transformed[0]
    printSf(res.sf)
    return res
}

export function units(): ReadonlyMap<string, UnitDesc> {
    return unitTab
}