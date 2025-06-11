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

export function tableTransformer(): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        const updatedStatements = sourceFile.statements.map(stmt => {
            if (!Ts.isVariableStatement(stmt)) return stmt
            const declList = stmt.declarationList
            const decl = declList.declarations[0]
            const init = decl.initializer
            if (init && Ts.isCallExpression(init) && Ts.isIdentifier(init.expression) && init.expression.text === '$table') {
                const acc = declList.flags & Ts.NodeFlags.Const ? 'ro' : 'rw'
                const newInit = Ts.factory.updateCallExpression(
                    init,
                    init.expression,
                    init.typeArguments,
                    [Ts.factory.createStringLiteral(acc)]
                )
                const newDecl = Ts.factory.updateVariableDeclaration(
                    decl,
                    decl.name,
                    decl.exclamationToken,
                    decl.type,
                    newInit
                )
                const newDeclList = Ts.factory.updateVariableDeclarationList(declList, [newDecl])
                return Ts.factory.updateVariableStatement(stmt, stmt.modifiers, newDeclList)
            }
            return stmt
        })
        return Ts.factory.updateSourceFile(sourceFile, updatedStatements)
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
                        const metaData = Ts.factory.createPropertyDeclaration(
                            [Ts.factory.createModifier(Ts.SyntaxKind.StaticKeyword)],
                            'em$metaData',
                            undefined,
                            undefined,
                            Ts.factory.createStringLiteral(ud.cname)
                        )
                        return Ts.factory.updateClassDeclaration(
                            node,
                            withMod(node.modifiers, Ts.SyntaxKind.ExportKeyword),
                            node.name,
                            node.typeParameters,
                            node.heritageClauses,
                            [...node.members, rttProp, metaData]
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