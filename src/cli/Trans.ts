import * as Path from "path"
import * as Ts from "typescript"

export function importStmt2(program: Ts.Program): Ts.TransformerFactory<Ts.SourceFile> {
    const compilerOptions = program.getCompilerOptions()
    return (context) => {
        const { factory } = context
        return (sourceFile) => {
            const visitor: Ts.Visitor = (node) => {
                if (Ts.isImportDeclaration(node)) {
                    const moduleSpecifier = node.moduleSpecifier
                    if (Ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text.startsWith("@")) {
                        const resolvedModule = Ts.resolveModuleName(
                            moduleSpecifier.text,
                            sourceFile.fileName,
                            compilerOptions,
                            Ts.sys
                        ).resolvedModule
                        if (resolvedModule) {
                            const resolvedPath = Path.relative(
                                Path.dirname(sourceFile.fileName),
                                resolvedModule.resolvedFileName
                            )
                            const normalizedPath = resolvedPath.replace(/\\/g, "/").replace(/\.ts$/, '.js')
                            return factory.updateImportDeclaration(
                                node,
                                node.modifiers, // Import modifiers (if any)
                                node.importClause, // Import clause (e.g., what is being imported)
                                factory.createStringLiteral(
                                    normalizedPath.startsWith(".")
                                        ? normalizedPath
                                        : `./${normalizedPath}`
                                ),
                                undefined
                            )
                        }
                    }
                }
                return Ts.visitEachChild(node, visitor, context)
            }
            const updatedSourceFile = Ts.visitEachChild(sourceFile, visitor, context)
            return updatedSourceFile as Ts.SourceFile // Ensure we return a SourceFile
        }
    }
}

export function importStmt(): Ts.TransformerFactory<Ts.SourceFile> {
    return (context: Ts.TransformationContext) => {
        const visit: Ts.Visitor = (node) => {
            if (Ts.isCallExpression(node)) {
                const expression = node.expression
                if (
                    Ts.isPropertyAccessExpression(expression) &&
                    expression.name.text === "declare" &&
                    expression.expression.getText() === "em"
                ) {
                    const args = node.arguments
                    if (args.length === 1) {
                        return Ts.factory.updateCallExpression(
                            node,                      // Original call node
                            node.expression,           // Keep the same expression (`em.declare`)
                            node.typeArguments,        // Preserve type arguments
                            [
                                args[0],               // Original first argument
                                Ts.factory.createStringLiteral(currentFileName), // Add file name as second argument
                            ]
                        )
                    }
                }
            }
            return Ts.visitEachChild(node, visit, context)
        }
        let currentFileName: string
        return (sourceFile) => {
            currentFileName = sourceFile.fileName // Capture the file name
            return Ts.visitEachChild(sourceFile, visit, context) // Process the SourceFile
        }
    }
}

export function unitSpec(sf: Ts.SourceFile): Ts.TransformerFactory<Ts.SourceFile> {
    return (context: Ts.TransformationContext) => {
        const visit: Ts.Visitor = (node) => {
            if (Ts.isCallExpression(node)) {
                const expression = node.expression
                if (
                    Ts.isPropertyAccessExpression(expression) &&
                    expression.name.text === "declare" &&
                    expression.expression.getText(sf) === "em"
                ) {
                    const args = node.arguments
                    if (args.length === 1) {
                        return Ts.factory.updateCallExpression(
                            node,                      // Original call node
                            node.expression,           // Keep the same expression (`em.declare`)
                            node.typeArguments,        // Preserve type arguments
                            [
                                args[0],               // Original first argument
                                Ts.factory.createStringLiteral(currentFileName), // Add file name as second argument
                            ]
                        )
                    }
                }
            }
            return Ts.visitEachChild(node, visit, context)
        }
        let currentFileName: string
        return (sourceFile) => {
            currentFileName = sourceFile.fileName // Capture the file name
            return Ts.visitEachChild(sourceFile, visit, context) // Process the SourceFile
        }
    }
}
