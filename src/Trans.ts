import * as Ast from './Ast'

import * as Ts from 'typescript'

import * as Type from './Type'
import * as Unit from './Unit'

const primitiveSizes: Record<string, number> = {
    bool_t: 1,
    f32: 4,
    i8: 1,
    i16: 2,
    i32: 4,
    i64: 8,
    opaq_t: 4,
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

export function configTransformer(): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        const updatedStatements = sourceFile.statements.map(stmt => {
            if (!Ts.isVariableStatement(stmt)) return stmt
            const declList = stmt.declarationList
            const decl = declList.declarations[0]
            const init = decl.initializer
            if (init && Ts.isCallExpression(init) && Ts.isIdentifier(init.expression) && init.expression.text === '$config') {
                const acc = declList.flags & Ts.NodeFlags.Const ? 'ro' : 'rw'
                const valArg = init.arguments.length > 0 ? init.arguments[0] : Ts.factory.createIdentifier('undefined')
                const newInit = Ts.factory.updateCallExpression(
                    init,
                    init.expression,
                    init.typeArguments,
                    [valArg, Ts.factory.createStringLiteral(acc)]
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

export function declareTransformer(uid: string): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isCallExpression(node) && node.expression.getText(sourceFile) == '$declare') {
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

export function enumTransformer(cname: string): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        const updatedStatements = sourceFile.statements.flatMap((stmt): Ts.Statement[] => {
            if (!Ts.isEnumDeclaration(stmt)) return [stmt]
            const enumName = stmt.name.text
            const isExported = stmt.modifiers?.some(
                (mod) => mod.kind === Ts.SyntaxKind.ExportKeyword
            ) ?? false
            const members = stmt.members.map((member) => {
                if (member.initializer) {
                    throw new Error(`enum ${enumName}: initializers are not supported`)
                }
                const name = member.name
                if (Ts.isIdentifier(name) || Ts.isStringLiteral(name)) {
                    return Ts.factory.createStringLiteral(name.text)
                }
                throw new Error(`enum ${enumName}: unsupported member name`)
            })
            const constDecl = Ts.factory.createVariableStatement(
                undefined,
                Ts.factory.createVariableDeclarationList(
                    [
                        Ts.factory.createVariableDeclaration(
                            enumName,
                            undefined,
                            undefined,
                            Ts.factory.createCallExpression(
                                Ts.factory.createIdentifier('$enum'),
                                undefined,
                                [
                                    Ts.factory.createStringLiteral(`${cname}::${enumName}`),
                                    Ts.factory.createArrayLiteralExpression(members, false),
                                ]
                            )
                        ),
                    ],
                    Ts.NodeFlags.Const
                )
            )
            const typeDecl = Ts.factory.createTypeAliasDeclaration(
                isExported ? [Ts.factory.createModifier(Ts.SyntaxKind.ExportKeyword)] : undefined,
                enumName,
                undefined,
                Ts.factory.createTypeReferenceNode(
                    'enum_t',
                    [
                        Ts.factory.createTypeQueryNode(
                            Ts.factory.createIdentifier(enumName)
                        ),
                    ]
                )
            )
            const exportDecl = Ts.factory.createExportDeclaration(
                undefined,
                false,
                Ts.factory.createNamedExports([
                    Ts.factory.createExportSpecifier(
                        false,
                        undefined,
                        Ts.factory.createIdentifier(enumName)
                    ),
                ]),
                undefined
            )
            return isExported
                ? [constDecl, typeDecl, exportDecl]
                : [constDecl, typeDecl]
        })
        return Ts.factory.updateSourceFile(sourceFile, updatedStatements)
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
        function typeText(type: Ts.TypeNode): string {
            if (Ts.isTypeReferenceNode(type) && Ts.isIdentifier(type.typeName)) return type.typeName.text
            return type.getText(sourceFile)
        }

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
                            Ts.factory.createTypeReferenceNode(className, []),
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
                                const ts = ud.resolveType(typeText(member.type)) ?? 'unknown'
                                const defaultVal = Ts.factory.createCallExpression(
                                    Ts.factory.createIdentifier('$default'),
                                    [member.type],
                                    undefined
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

export function tableTransformer(ud: Unit.Desc): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        const updatedStatements = sourceFile.statements.map(stmt => {
            if (!Ts.isVariableStatement(stmt)) return stmt
            const declList = stmt.declarationList
            const decl = declList.declarations[0]
            const init = decl.initializer
            if (init && Ts.isCallExpression(init) && Ts.isIdentifier(init.expression) && init.expression.text === '$table') {
                const acc = declList.flags & Ts.NodeFlags.Const ? 'ro' : 'rw'
                // let dname = ((node.parent as Ts.VariableDeclaration).name as Ts.Identifier).text

                const cname = `${ud.cname}::${(decl.name as Ts.Identifier).text}`
                const valArg = init.arguments.length > 0
                    ? init.arguments[0]
                    : Ts.factory.createArrayLiteralExpression([], false)
                const newInit = Ts.factory.updateCallExpression(
                    init,
                    init.expression,
                    init.typeArguments,
                    [valArg, Ts.factory.createStringLiteral(acc), Ts.factory.createStringLiteral(cname)]
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

export function tdefsTransformer(ud: Unit.Desc): Ts.TransformerFactory<Ts.SourceFile> {
    return () => (sf) => {
        ud.addTdefs(sf)
        return sf
    }
}

export function typeopTransformer(ud: Unit.Desc, op: string): Ts.TransformerFactory<Ts.SourceFile> {
    return (context) => (sourceFile) => {
        function typeText(type: Ts.TypeNode): string {
            if (Ts.isTypeReferenceNode(type) && Ts.isIdentifier(type.typeName)) return type.typeName.text
            return type.getText(sourceFile)
        }

        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isCallExpression(node) && Ts.isIdentifier(node.expression) && node.expression.text === op) {
                const ts = ud.resolveType(typeText(node.typeArguments![0])) ?? 'unknown'
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
        function typeText(type: Ts.TypeNode): string {
            if (Ts.isTypeReferenceNode(type) && Ts.isIdentifier(type.typeName)) return type.typeName.text
            return type.getText(sourceFile)
        }

        function visit(node: Ts.Node): Ts.Node {
            if (Ts.isClassDeclaration(node)) {
                const extendsClause = node.heritageClauses?.find(
                    (clause) => clause.token === Ts.SyntaxKind.ExtendsKeyword
                )
                if (extendsClause) {
                    const extendsType = extendsClause.types[0]
                    if (Ts.isExpressionWithTypeArguments(extendsType) &&
                        Ts.isIdentifier(extendsType.expression) &&
                        extendsType.expression.text === '$vector') {
                        const ts = ud.resolveType(typeText(extendsType.typeArguments![0])) ?? 'unknown'
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

export function vecTypeTransformer(ud: Unit.Desc): Ts.TransformerFactory<Ts.SourceFile> {
    return () => {
        function isStructClass(cls: Ts.ClassDeclaration): boolean {
            const clause = cls.heritageClauses?.find((hc) => hc.token === Ts.SyntaxKind.ExtendsKeyword)
            const type = clause?.types[0]
            return !!type && Ts.isIdentifier(type.expression) && type.expression.text === '$struct'
        }

        function parseVecType(type: Ts.TypeNode): { elem: Ts.TypeNode, len: string } | null {
            if (!Ts.isTypeReferenceNode(type) || !Ts.isIdentifier(type.typeName)) return null
            if (type.typeName.text !== 'vec_t' || type.typeArguments?.length !== 2) return null
            return { elem: type.typeArguments[0], len: type.typeArguments[1].getText() }
        }

        function makeVecClass(sv: Unit.SynthVec): Ts.ClassDeclaration {
            return Ts.factory.createClassDeclaration(
                undefined,
                Ts.factory.createIdentifier(sv.name),
                undefined,
                [
                    Ts.factory.createHeritageClause(Ts.SyntaxKind.ExtendsKeyword, [
                        Ts.factory.createExpressionWithTypeArguments(Ts.factory.createIdentifier('$vector'), [sv.type]),
                    ]),
                ],
                [
                    Ts.factory.createPropertyDeclaration(
                        undefined,
                        '$len',
                        undefined,
                        undefined,
                        Ts.factory.createNumericLiteral(sv.len)
                    ),
                ]
            )
        }

        return (sf) => {
            const statements = sf.statements.flatMap((stmt): Ts.Statement[] => {
                if (!Ts.isClassDeclaration(stmt) || !stmt.name || !isStructClass(stmt)) return [stmt]
                const generated: Ts.ClassDeclaration[] = []
                const sname = stmt.name.text
                const members = stmt.members.map((mem) => {
                    if (!Ts.isPropertyDeclaration(mem) || !mem.type || !Ts.isIdentifier(mem.name)) return mem
                    const vt = parseVecType(mem.type)
                    if (!vt) return mem
                    const vname = `${sname}__${mem.name.text}__vec`
                    const sv = ud.addSynthVec(vname, vt.elem, vt.len)
                    generated.push(makeVecClass(sv))
                    return Ts.factory.updatePropertyDeclaration(
                        mem,
                        mem.modifiers,
                        mem.name,
                        mem.questionToken,
                        Ts.factory.createTypeReferenceNode(vname),
                        mem.initializer
                    )
                })
                const updated = Ts.factory.updateClassDeclaration(
                    stmt,
                    stmt.modifiers,
                    stmt.name,
                    stmt.typeParameters,
                    stmt.heritageClauses,
                    members
                )
                return [...generated, updated]
            })
            return Ts.factory.updateSourceFile(sf, statements)
        }
    }
}

function withMod(mods: Ts.NodeArray<Ts.ModifierLike> | undefined, kind: Ts.ModifierSyntaxKind): Ts.NodeArray<Ts.ModifierLike> {
    return mods?.some(m => m.kind === kind) ? mods
        : Ts.factory.createNodeArray([Ts.factory.createModifier(kind), ...(mods ?? [])])
}