import * as Path from "path"
import * as Ts from "typescript"

export function imports(program: Ts.Program): Ts.TransformerFactory<Ts.SourceFile> {
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
