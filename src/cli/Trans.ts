import * as Ast from './Ast'

import * as Ts from 'typescript'

import * as Type from './Type'
import * as Unit from './Unit'

const primitiveSizes: Record<string, number> = {
    bool_t: 1,
    i8: 1,
    i16: 2,
    i32: 4,
    i64: 8,
    ptr_t: 4,
    ref_t: 4,
    u8: 1,
    u16: 2,
    u32: 4,
    u64: 8,
}
const aliasSizes: Record<string, number> = {}
const aliasTypes: Record<string, Ts.TypeNode> = {}

export function callbackTransformer(cname: string): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isCallExpression(node) && Ts.isIdentifier(node.expression) && node.expression.text === "$cb") {
                return Ts.factory.updateCallExpression(
                    node,
                    node.expression,
                    node.typeArguments,
                    [...node.arguments, Ts.factory.createStringLiteral(cname)]
                )
            }
            return Ts.visitEachChild(node, visit, context)
        }
        return Ts.visitNode(sourceFile, visit) as Ts.SourceFile
    }
}

export function collectAliasInfo(node: Ts.Node): void {
    if (Ts.isTypeAliasDeclaration(node) && Ts.isIdentifier(node.name)) {
        const aliasName = node.name.text
        if (node.type) {
            aliasTypes[aliasName] = node.type
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
    Ts.forEachChild(node, collectAliasInfo)
}

export function declareTransformer(uid: string): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isCallExpression(node) && node.expression.getText(sourceFile) == 'em.$declare') {
                return Ts.factory.updateCallExpression(
                    node,
                    node.expression,
                    node.typeArguments,
                    [node.arguments[0]]
                )
            }
            return Ts.visitEachChild(node, visit, context)
        }
        return Ts.visitNode(sourceFile, visit) as Ts.SourceFile
    }
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

export function factoryTransformer(cname: string): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isCallExpression(node) && Ts.isIdentifier(node.expression) && node.expression.text == '$factory') {
                let dname = ((node.parent as Ts.VariableDeclaration).name as Ts.Identifier).text
                return Ts.factory.updateCallExpression(
                    node,
                    node.expression,
                    node.typeArguments,
                    [...node.arguments, Ts.factory.createStringLiteral(`${cname}::${dname}`)]
                )
            }

            return Ts.visitEachChild(node, visit, context)
        }

        return Ts.visitNode(sourceFile, visit) as Ts.SourceFile
    }
}

export function frameTransformer(): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isCallExpression(node) && Ts.isIdentifier(node.expression) && node.expression.text === "$frame") {
                const ts = Type.make(node.typeArguments![0], undefined, sourceFile)
                return Ts.factory.updateCallExpression(
                    node,
                    node.expression,
                    node.typeArguments,
                    [...node.arguments, Ts.factory.createStringLiteral(ts)]
                )
            }
            return Ts.visitEachChild(node, visit, context)
        }
        return Ts.visitNode(sourceFile, visit) as Ts.SourceFile
    }
}

export function implementsTransformer(): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        const updatedStatements = sourceFile.statements.filter(stmt =>
            !(Ts.isExpressionStatement(stmt) && stmt.getText(sourceFile).startsWith('$implements'))
        )
        return Ts.factory.updateSourceFile(sourceFile, updatedStatements)
    }
}

function getDefaultValueForType(type: Ts.TypeNode | undefined): Ts.Expression | undefined {
    if (type) {
        if (Ts.isTypeReferenceNode(type)) {
            const typeName = type.typeName.getText()
            if (typeName === 'bool_t') {
                return Ts.factory.createFalse()
            }
            if (['arg_t', 'i8', 'i16', 'i32', 'u8', 'u16', 'u32'].includes(typeName)) {
                return Ts.factory.createNumericLiteral('0')
            }
            if (Ts.isIdentifier(type.typeName)) {
                const tname = type.typeName.text
                if (tname === 'frame_t') {
                    return Ts.factory.createCallExpression(
                        Ts.factory.createIdentifier('$frame'),
                        undefined,
                        undefined,
                    )
                }
                if (tname === 'ref_t') {
                    return Ts.factory.createCallExpression(
                        Ts.factory.createIdentifier('$ref'),
                        undefined,
                        undefined,
                    )
                }
                if (tname === 'cb_t') {
                    return Ts.factory.createCallExpression(
                        Ts.factory.createIdentifier('$cb$null'),
                        undefined,
                        undefined,
                    )
                }
                return Ts.factory.createCallExpression(
                    Ts.factory.createPropertyAccessExpression(
                        Ts.factory.createIdentifier(tname),
                        Ts.factory.createIdentifier("$make")
                    ),
                    [],
                    []
                )
            }
        }
    }
    return undefined
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

function resolveTypeAlias(type: Ts.TypeNode | undefined): Ts.TypeNode | undefined {
    if (type && Ts.isTypeReferenceNode(type)) {
        const aliasName = type.typeName.getText()
        if (aliasTypes[aliasName]) {
            return aliasTypes[aliasName]
        }
    }
    return type
}


export function structTransformer(ud: Unit.Desc): Ts.TransformerFactory<Ts.SourceFile> {
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
                        const metaData = Ts.factory.createPropertyDeclaration(
                            [Ts.factory.createModifier(Ts.SyntaxKind.StaticKeyword)],
                            'em$metaData',
                            undefined,
                            undefined,
                            Ts.factory.createStringLiteral(ud.cname)
                        )
                        const updatedMembers = node.members.map((member) => {
                            if (Ts.isPropertyDeclaration(member) && member.type && !member.initializer) {
                                const ts = ud.resolveType(member.type.getText(sourceFile)) ?? 'unknown'
                                const defaultVal = Ts.factory.createCallExpression(
                                    Ts.factory.createIdentifier('$default'),
                                    [member.type],
                                    undefined
                                    // [Ts.factory.createStringLiteral(ts), Ts.factory.createStringLiteral(ud.id)]
                                )
                                return Ts.factory.updatePropertyDeclaration(
                                    member,
                                    member.modifiers,
                                    member.name,
                                    member.questionToken,
                                    member.type,
                                    defaultVal
                                )
                            }
                            return member
                        })
                        return Ts.factory.updateClassDeclaration(
                            node,
                            withMod(node.modifiers, Ts.SyntaxKind.ExportKeyword),
                            node.name,
                            node.typeParameters,
                            undefined,
                            [...updatedMembers, makeMethod, metaData]
                        )
                    }
                }
            }
            return Ts.visitEachChild(node, visit, context)
        }

        return Ts.visitNode(sourceFile, visit) as Ts.SourceFile
    }
}

export function typeopTransformer(ud: Unit.Desc, op: string): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isCallExpression(node) && Ts.isIdentifier(node.expression) && node.expression.text === op) {
                const ts = ud.resolveType(node.typeArguments![0].getText(sourceFile)) ?? 'unknown'
                return Ts.factory.updateCallExpression(
                    node,
                    node.expression,
                    node.typeArguments,
                    [...node.arguments, Ts.factory.createStringLiteral(ts), Ts.factory.createStringLiteral(ud.id)]
                )
            }
            return Ts.visitEachChild(node, visit, context)
        }
        return Ts.visitNode(sourceFile, visit) as Ts.SourceFile
    }
}

export function vectorTransformer(ud: Unit.Desc): Ts.TransformerFactory<Ts.SourceFile> {
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
                        extendsType.expression.text === "$vector") {
                        const ts = ud.resolveType(extendsClause.types[0].typeArguments![0].getText(sourceFile)) ?? 'unknown'
                        const rttProp = Ts.factory.createPropertyDeclaration(
                            [],
                            '_elem_rtt',
                            undefined,
                            undefined,
                            Ts.factory.createStringLiteral(`${ts}|${ud.id}`)
                        )
                        return Ts.factory.updateClassDeclaration(
                            node,
                            withMod(node.modifiers, Ts.SyntaxKind.ExportKeyword),
                            node.name,
                            node.typeParameters,
                            node.heritageClauses,
                            [...node.members, rttProp]
                        )
                    }
                }
            }
            return Ts.visitEachChild(node, visit, context)
        }

        return Ts.visitNode(sourceFile, visit) as Ts.SourceFile
    }
}

function withMod(mods: Ts.NodeArray<Ts.ModifierLike> | undefined, kind: Ts.ModifierSyntaxKind): Ts.NodeArray<Ts.ModifierLike> {
    return mods?.some(m => m.kind === kind) ? mods
        : Ts.factory.createNodeArray([Ts.factory.createModifier(kind), ...(mods ?? [])])
}