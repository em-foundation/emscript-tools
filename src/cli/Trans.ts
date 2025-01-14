import * as Ts from 'typescript'

const primitiveSizes: Record<string, number> = {
    bool_t: 1,
    i8: 1,
    i16: 2,
    i32: 4,
    u8: 1,
    u16: 2,
    u32: 4,
}
const aliasSizes: Record<string, number> = {}

export function collectAliasSizes(node: Ts.Node): void {
    if (Ts.isTypeAliasDeclaration(node) && Ts.isIdentifier(node.name)) {
        const aliasName = node.name.text
        if (node.type) {
            const size = getSizeOfNode(node.type)
            if (!Number.isNaN(size)) {
                aliasSizes[aliasName] = size
            }
        }
    }
    if (Ts.isClassDeclaration(node)) {
        const extendsClause = node.heritageClauses?.find(
            (clause) => clause.token === Ts.SyntaxKind.ExtendsKeyword
        )
        if (extendsClause) {
            const extendsType = extendsClause.types[0]
            if (Ts.isExpressionWithTypeArguments(extendsType) &&
                Ts.isIdentifier(extendsType.expression) &&
                extendsType.expression.text === "$struct") {
                const className = node.name!.text
                let size = 0
                for (const member of node.members) {
                    if (Ts.isPropertyDeclaration(member) && member.type) {
                        size += getSizeOfNode(member.type)
                    }
                }
                aliasSizes[className] = size
            }
        }
    }
    Ts.forEachChild(node, collectAliasSizes)
}

export const exportTransformer: Ts.TransformerFactory<Ts.SourceFile> = () => {
    return (root) => {
        const decls: Ts.PropertyAssignment[] = []
        const updatedStatements = root.statements.map((stmt) => {
            if (Ts.isVariableStatement(stmt)) {
                const isExported = stmt.modifiers?.some(
                    (mod) => mod.kind === Ts.SyntaxKind.ExportKeyword
                )
                if (!isExported) {
                    stmt.declarationList.declarations.forEach((decl) => {
                        if (Ts.isIdentifier(decl.name)) {
                            decls.push(
                                Ts.factory.createPropertyAssignment(
                                    decl.name,
                                    Ts.factory.createIdentifier(decl.name.text)
                                )
                            )
                        }
                    })
                }
            }
            return stmt
        })
        const emDeclsConst = Ts.factory.createVariableStatement(
            [Ts.factory.createModifier(Ts.SyntaxKind.ExportKeyword)],
            Ts.factory.createVariableDeclarationList(
                [
                    Ts.factory.createVariableDeclaration(
                        Ts.factory.createIdentifier("em$decls"),
                        undefined,
                        undefined,
                        Ts.factory.createObjectLiteralExpression(decls, true)
                    ),
                ],
                Ts.NodeFlags.Const
            )
        )
        const emDeclsExport = Ts.factory.createExportDeclaration(
            undefined,
            false,
            Ts.factory.createNamedExports([
                Ts.factory.createExportSpecifier(
                    false, // isTypeOnly
                    undefined, // propertyName (no alias)
                    Ts.factory.createIdentifier("em$decls") // name
                ),
            ]),
            undefined
        )
        return Ts.factory.updateSourceFile(root, [
            ...updatedStatements,
            emDeclsConst,
            emDeclsExport,
        ])
    }
}

function getSizeOfNode(node: Ts.TypeNode): number {
    if (Ts.isTypeReferenceNode(node)) {
        if (Ts.isIdentifier(node.typeName)) {
            const typeName = node.typeName.text
            if (primitiveSizes[typeName] !== undefined) {
                return primitiveSizes[typeName]
            }
            if (aliasSizes[typeName] !== undefined) {
                return aliasSizes[typeName]
            }
        }
    }
    return Number.NaN
}

export function sizeofTransformer(): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isExpressionWithTypeArguments(node) && Ts.isIdentifier(node.expression) && node.expression.text === "$sizeof") {
                const typeArg = node.typeArguments?.[0]
                if (typeArg && Ts.isTypeNode(typeArg)) {
                    const size = getSizeOfNode(typeArg)
                    return Ts.factory.createNumericLiteral(size.toString())
                }
            }
            return Ts.visitEachChild(node, visit, context)
        }
        return Ts.visitNode(sourceFile, visit) as Ts.SourceFile
    }
}

export function structTransformer(): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isClassDeclaration(node)) {
                const extendsClause = node.heritageClauses?.find(
                    (clause) => clause.token === Ts.SyntaxKind.ExtendsKeyword
                )
                if (extendsClause) {
                    const extendsType = extendsClause.types[0]
                    if (Ts.isExpressionWithTypeArguments(extendsType) &&
                        Ts.isIdentifier(extendsType.expression) &&
                        extendsType.expression.text === "$struct") {
                        const className = node.name!.text
                        const makeMethod = Ts.factory.createMethodDeclaration(
                            [Ts.factory.createModifier(Ts.SyntaxKind.StaticKeyword)],
                            undefined,
                            Ts.factory.createIdentifier("$make"),
                            undefined,
                            undefined,
                            [],
                            Ts.factory.createTypeReferenceNode(className, []), // return type
                            Ts.factory.createBlock([
                                Ts.factory.createReturnStatement(
                                    Ts.factory.createNewExpression(
                                        Ts.factory.createThis(),
                                        [],
                                        []
                                    )
                                )
                            ])
                        )
                        return Ts.factory.updateClassDeclaration(
                            node,
                            node.modifiers,
                            node.name,
                            node.typeParameters,
                            undefined,
                            [...node.members, makeMethod]
                        )
                    }
                }
            }
            return Ts.visitEachChild(node, visit, context)
        }

        return Ts.visitNode(sourceFile, visit) as Ts.SourceFile
    }
}
