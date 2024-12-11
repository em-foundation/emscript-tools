import * as Fs from 'fs'
import * as Path from 'path'
import * as Ts from 'typescript'

import * as Session from './Session'
import * as Trans from './Trans'
import * as UnitMgr from './UnitMgr'

const CLONE_DIR = './workspace/.emscript/clone'
const GENJS_DIR = './workspace/.emscript/genjs'
const BUILD_DIR = './workspace/.emscript'

let curProg: Ts.Program
let curUpath: string

export function dump(): void {
    // UnitMgr.units().forEach((ud, uid) => {
    //     console.log(`${uid}: ${ud.kind}`)
    //     //     ud.sf.statements.forEach((stmt) => {
    //     //         if (Ts.isVariableStatement(stmt)) {
    //     //             const dtxt = stmt.declarationList.declarations[0].getText(ud.sf)
    //     //             const m = dtxt.match(/(\w+)\.em\$clone\(.*\)$/)
    //     //             if (m) console.log(ud.imports.get(m[1]))
    //     //             //if (dtxt.match(/console.log(`    ${dtxt}`)
    //     //         }
    //     //     })
    //     ud.imports.forEach((uid, imp) => console.log(`    ${imp}: ${uid}`))
    // })
}

export function emit(): void {
    const transformers: Ts.CustomTransformers = {
        before: [
            // Trans.importStmt(curProg),
            // Trans.unitSpec(),
        ]
    }
    const writeFile: Ts.WriteFileCallback = (fileName, data, writeByteOrderMark, onError, sourceFiles) => {
        // console.log(`writing '${fileName}'`)
        Fs.mkdirSync(Path.dirname(fileName), { recursive: true })
        Fs.writeFileSync(fileName, data, 'utf-8')
        // if (sourceFiles && sourceFiles.length > 0) {
        //     const sourceFile = sourceFiles[0].fileName;
        //     console.log(`writeFile: ${sourceFile}`)
        //     return
        // 
        //     // Compute relative path from 'src' directory
        //     const srcDir = Path.resolve("src");
        //     const outDir = Path.resolve("out");
        // 
        //     const relativePath = Path.relative(srcDir, sourceFile); // e.g., 'dir1/dir2/File.ts'
        // 
        //     // Remove the first directory (e.g., 'dir1/')
        //     const newRelativePath = Path.join(Path.dirname(relativePath).split(Path.sep).slice(1).join(Path.sep), Path.basename(relativePath));
        // 
        //     // Construct the new output path
        //     const outputPath = Path.join(outDir, newRelativePath.replace(/\.ts$/, ".js"));
        // 
        //     // Ensure the output directory exists
        //     const fs = require("fs");
        //     fs.mkdirSync(Path.dirname(outputPath), { recursive: true });
        // 
        //     // Write the transformed file to the new path
        //     fs.writeFileSync(outputPath, data, { encoding: writeByteOrderMark ? "utf8-bom" : "utf8" });
        // } else {
        //     console.error("Unable to determine source file for emission");
        // }
    }
    const emitResult = curProg.emit(undefined, writeFile, undefined, false, transformers)
}

export function exec(): void {
    return
    // const jsPath = Path.resolve(BUILD_DIR, `${UnitMgr.mkUid(curUpath)}.em.js`)
    console.log(`curUpath = ${curUpath}`)
    const jsPath = Path.resolve(BUILD_DIR, curUpath).replace(/\\/g, '/').replace(/\.ts$/, '.js')

    try {
        require(jsPath)
    } catch (error) {
        console.error(`*** execution error: ${error}`)
    }
}

function expand(doneSet: Set<string>) {
    UnitMgr.units().forEach((ud, uid) => {
        if (doneSet.has(uid)) return
        ud.sf.statements.forEach((stmt) => {
            if (Ts.isVariableStatement(stmt)) {
                const dtxt = stmt.declarationList.declarations[0].getText(ud.sf)
                const m = dtxt.match(/^(\w+)\W+(\w+)\.em\$clone\(.*\)$/)
                if (!m) return
                const xpath = `${CLONE_DIR}/${uid}__${m[1]}.em.ts`
                const tuid = ud.imports.get(m[2])!
                const tud = UnitMgr.units().get(tuid)!
                console.log(`generating ${xpath} using ${tud.id}`)
                let lines = Array<string>(`// *** GENERATED UNIT CLONED FROM '${tud.id}'\n`)
                for (let line of tud.sf.getText(tud.sf).split('\n')) {
                    if (line.indexOf('em$_T = em.declare') != -1) continue
                    if (line.indexOf('export function em$clone') != -1) {
                        lines.push('export default { ...em$template.em$clone }')
                        continue
                    }
                    lines.push(line)
                }
                Fs.mkdirSync(Path.dirname(xpath), { recursive: true })
                Fs.writeFileSync(xpath, lines.join('\n'), 'utf-8')
            }
        })
    })
}

function mkStmtNode(frag: string): Ts.Statement {
    const sf = Ts.createSourceFile('$$.ts', frag, Ts.ScriptTarget.Latest, true)
    return sf.statements[0]
}

export function parse(upath: string): void {
    curUpath = upath
    let workList = new Array<string>(Path.join(Session.getWorkDir(), upath))
    let expandDoneSet = new Set<string>
    while (workList.length > 0) {
        let foundList = new Array<string>
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
            outDir: BUILD_DIR,
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
        for (const p of foundList) UnitMgr.create(curProg.getSourceFile(p)!)
        // for (const p of foundList) {
        //     let sf = curProg.getSourceFile(p)!
        //     let res = Ts.transform(sf, [
        //         transUnitSpec
        //     ])
        //     UnitMgr.create(res.transformed[0])
        // }
        workList = []
        expand(expandDoneSet)
    }
}

// function transUnitSpec(context: Ts.TransformationContext) {
//     return (sf: Ts.SourceFile): Ts.SourceFile => {
//         const visitor: Ts.Visitor = (node) => {
//             if (Ts.isImportDeclaration(node)) {
//                 let mod = node.moduleSpecifier.getText(sf).replace('@EM-SCRIPT', '../em.lang/em-script')
//                 mod = mod.replace(/['"]@(.+)\.em['"]$/, "'../$1.em'")
//                 return Ts.factory.updateImportDeclaration(
//                     node,
//                     node.modifiers,
//                     node.importClause,
//                     Ts.factory.createStringLiteral(mod),
//                     node.attributes
//                 )
//             }
//             return node
//         };
//         const updatedStatements: Ts.Statement[] = sf.statements.map(stmt =>
//             Ts.visitNode(stmt, visitor) as Ts.Statement
//         );
//         return Ts.factory.updateSourceFile(sf, updatedStatements);
//     };
// }

// function expand(
//     entryFiles: string[],
//     options: Ts.CompilerOptions,
//     templateReader: (templateName: string) => string
// ): Map<string, Ts.SourceFile> {
//     const allFiles = new Map<string, Ts.SourceFile>()
//     const pendingFiles = new Set(entryFiles)
//     let newFilesGenerated = false
//     do {
//         newFilesGenerated = false
//         const host = Ts.createCompilerHost(options)
//         const program = Ts.createProgram(
//             [...pendingFiles, ...Array.from(allFiles.keys())],
//             options,
//             {
//                 ...host,
//                 getSourceFile: (fileName, languageVersion) => {
//                     if (allFiles.has(fileName)) {
//                         return allFiles.get(fileName)
//                     }
//                     return host.getSourceFile(fileName, languageVersion)
//                 },
//             }
//         )
//         for (const sourceFile of program.getSourceFiles()) {
//             if (!sourceFile.fileName.endsWith('.ts')) continue // Skip non-TS files
//             if (allFiles.has(sourceFile.fileName)) continue // Already processed
//             const transformer: Ts.TransformerFactory<Ts.SourceFile> = (context) => (sourceFile) => {
//                 const visitor: Ts.Visitor = (node) => {
//                     if (
//                         Ts.isVariableDeclaration(node) &&
//                         node.initializer &&
//                         Ts.isCallExpression(node.initializer) &&
//                         Ts.isPropertyAccessExpression(node.initializer.expression) &&
//                         node.initializer.expression.name.text === '$clone'
//                     ) {
//                         const variableName = node.name.getText()
//                         const templateModule = node.initializer.expression.expression.getText()
//                         const newFileName = `./${variableName}.ts`
//                         if (!allFiles.has(newFileName)) {
//                             const templateContent = templateReader(templateModule)
//                             const newSourceFile = Ts.createSourceFile(
//                                 newFileName,
//                                 templateContent,
//                                 Ts.ScriptTarget.Latest
//                             )
//                             allFiles.set(newFileName, newSourceFile)
//                             pendingFiles.add(newFileName)
//                             newFilesGenerated = true
//                         }
//                         return Ts.factory.createVariableDeclaration(
//                             node.name,
//                             undefined,
//                             undefined,
//                             Ts.factory.createCallExpression(
//                                 Ts.factory.createIdentifier('require'),
//                                 undefined,
//                                 [Ts.factory.createStringLiteral(newFileName)]
//                             )
//                         )
//                     }
//                     return Ts.visitEachChild(node, visitor, context)
//                 }
//                 const transformedSourceFile = Ts.visitNode(sourceFile, visitor) as Ts.SourceFile
//                 allFiles.set(sourceFile.fileName, transformedSourceFile)
//                 return transformedSourceFile
//             }
//             const result = Ts.transform(sourceFile, [transformer])
//             const transformedSourceFile = result.transformed[0] as Ts.SourceFile
//             allFiles.set(sourceFile.fileName, transformedSourceFile)
//             result.dispose()
//         }
//         pendingFiles.clear()
//     } while (newFilesGenerated)
//     return allFiles
// }
