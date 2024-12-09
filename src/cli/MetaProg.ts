import * as Fs from 'fs'
import * as Path from 'path'
import * as Ts from 'typescript'

import * as Session from './Session'
import * as Trans from './Trans'
import * as UnitMgr from './UnitMgr'

const OUTDIR = './workspace/.emscript/genjs'

let curProg: Ts.Program
let curUpath: string

export function dump(): void {
    UnitMgr.units().forEach((ud, uid) => {
        console.log(`${uid}: ${ud.kind}`)
        ud.imports.forEach((uid, imp) => console.log(`    ${imp}: ${uid}`))
    })
}

export function emit(): void {
    const transformers: Ts.CustomTransformers = {
        before: [
            Trans.importStmt(curProg),
            Trans.unitSpec(curProg),
        ]
    }
    const emitResult = curProg.emit(undefined, undefined, undefined, false, transformers)
}

export function exec(): void {
    const jsPath = Path.resolve(OUTDIR, curUpath).replace(/\\/g, '/').replace(/\.ts$/, '.js')
    try {
        require(jsPath)
    } catch (error) {
        console.error(`*** execution error: ${error}`)
    }
}

export function parse(upath: string): void {
    curUpath = upath
    let foundList = new Array<string>
    let workList = new Array<string>(Path.join(Session.getWorkDir(), upath))
    const cfgHost: Ts.ParseConfigFileHost = {
        ...Ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
            console.error(
                Ts.formatDiagnosticsWithColorAndContext([diagnostic], {
                    getCanonicalFileName: (fileName) => fileName,
                    getCurrentDirectory: Ts.sys.getCurrentDirectory,
                    getNewLine: () => Ts.sys.newLine,
                })
            )
        },
    }
    const cfg = Ts.getParsedCommandLineOfConfigFile('./tsconfig.json', {}, cfgHost)
    const options: Ts.CompilerOptions = {
        module: Ts.ModuleKind.CommonJS,
        target: Ts.ScriptTarget.ESNext,
        strict: true,
        esModuleInterop: true,
        sourceMap: true,
        outDir: OUTDIR,
        paths: cfg!.options.paths!
    }
    const baseHost = Ts.createCompilerHost({})
    const customHost: Ts.CompilerHost = {
        ...baseHost,
        getSourceFile: (fileName, languageVersion, onError) => {
            if (fileName.endsWith(".em.ts") && Path.isAbsolute(fileName)) {
                foundList.push(fileName)
                // console.log(mkUname(fileName))
            }
            return baseHost.getSourceFile(fileName, languageVersion, onError)
        },
    }
    curProg = Ts.createProgram(workList, options, customHost)
    for (const p of foundList) {
        let sf = curProg.getSourceFile(p)!
        UnitMgr.create(sf)
    }
}

function expand(
    entryFiles: string[],
    options: Ts.CompilerOptions,
    templateReader: (templateName: string) => string
): Map<string, Ts.SourceFile> {
    const allFiles = new Map<string, Ts.SourceFile>()
    const pendingFiles = new Set(entryFiles)
    let newFilesGenerated = false
    do {
        newFilesGenerated = false
        const host = Ts.createCompilerHost(options)
        const program = Ts.createProgram(
            [...pendingFiles, ...Array.from(allFiles.keys())],
            options,
            {
                ...host,
                getSourceFile: (fileName, languageVersion) => {
                    if (allFiles.has(fileName)) {
                        return allFiles.get(fileName)
                    }
                    return host.getSourceFile(fileName, languageVersion)
                },
            }
        )
        for (const sourceFile of program.getSourceFiles()) {
            if (!sourceFile.fileName.endsWith('.ts')) continue // Skip non-TS files
            if (allFiles.has(sourceFile.fileName)) continue // Already processed
            const transformer: Ts.TransformerFactory<Ts.SourceFile> = (context) => (sourceFile) => {
                const visitor: Ts.Visitor = (node) => {
                    if (
                        Ts.isVariableDeclaration(node) &&
                        node.initializer &&
                        Ts.isCallExpression(node.initializer) &&
                        Ts.isPropertyAccessExpression(node.initializer.expression) &&
                        node.initializer.expression.name.text === '$clone'
                    ) {
                        const variableName = node.name.getText()
                        const templateModule = node.initializer.expression.expression.getText()
                        const newFileName = `./${variableName}.ts`
                        if (!allFiles.has(newFileName)) {
                            const templateContent = templateReader(templateModule)
                            const newSourceFile = Ts.createSourceFile(
                                newFileName,
                                templateContent,
                                Ts.ScriptTarget.Latest
                            )
                            allFiles.set(newFileName, newSourceFile)
                            pendingFiles.add(newFileName)
                            newFilesGenerated = true
                        }
                        return Ts.factory.createVariableDeclaration(
                            node.name,
                            undefined,
                            undefined,
                            Ts.factory.createCallExpression(
                                Ts.factory.createIdentifier('require'),
                                undefined,
                                [Ts.factory.createStringLiteral(newFileName)]
                            )
                        )
                    }
                    return Ts.visitEachChild(node, visitor, context)
                }
                const transformedSourceFile = Ts.visitNode(sourceFile, visitor) as Ts.SourceFile
                allFiles.set(sourceFile.fileName, transformedSourceFile)
                return transformedSourceFile
            }
            const result = Ts.transform(sourceFile, [transformer])
            const transformedSourceFile = result.transformed[0] as Ts.SourceFile
            allFiles.set(sourceFile.fileName, transformedSourceFile)
            result.dispose()
        }
        pendingFiles.clear()
    } while (newFilesGenerated)
    return allFiles
}
