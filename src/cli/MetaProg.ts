import * as Fs from 'fs'
import * as Path from 'path'
import * as Ts from 'typescript'

import * as Session from './Session'
import * as Trans from './Trans'
import * as UnitMgr from './UnitMgr'

const CLONE_DIR = './workspace/.emscript/.clone'
const BUILD_DIR = './workspace/.emscript'

let curProg: Ts.Program
let curUpath: string

export function dump(): void {
    console.log('*** dump'); return
    UnitMgr.units().forEach((ud, uid) => {
        console.log(`${uid}: ${ud.kind} ${ud.sf.fileName}`)
        //     ud.sf.statements.forEach((stmt) => {
        //         if (Ts.isVariableStatement(stmt)) {
        //             const dtxt = stmt.declarationList.declarations[0].getText(ud.sf)
        //             const m = dtxt.match(/(\w+)\.em\$clone\(.*\)$/)
        //             if (m) console.log(ud.imports.get(m[1]))
        //             //if (dtxt.match(/console.log(`    ${dtxt}`)
        //         }
        //     })
        // ud.imports.forEach((uid, imp) => console.log(`    ${imp}: ${uid}`))
    })
}

export function emit(): void {
    console.log('*** emit'); return
    const writeFile: Ts.WriteFileCallback = (fileName, content, writeByteOrderMark, onError, sourceFiles) => {
        const outfile = `${Path.basename(Path.dirname(fileName))}/${Path.basename(fileName)}`
        const outpath = Path.resolve(BUILD_DIR, outfile)
        // console.log(`writing '${outpath}'`)
        Fs.mkdirSync(Path.dirname(outpath), { recursive: true })
        if (outfile.endsWith('.js') && outfile != 'em.lang/em-script.js') {
            const uid = outfile.replace(/\.js$/, '')
            content = content.replaceAll(/_EM_SCRIPT_1\.default\.declare\((.+)\)/g, `_EM_SCRIPT_1.default.declare($1, '${uid}')`)
            content = content.replace('@EM-SCRIPT', '../em.lang/em-script')
            content = content.replaceAll(/require\("@(.+)\.em"\)/g, 'require("../$1.em")')
        }
        Fs.writeFileSync(outpath, content, 'utf-8')
    }
    const emitResult = curProg.emit(undefined, writeFile, undefined, false)
}

export function exec(): void {
    // console.log('*** exec'); return
    const jsPath = Path.resolve(BUILD_DIR, `${UnitMgr.mkUid(curUpath)}.em.js`)
    try {
        require(jsPath)
    } catch (error) {
        console.error(`*** execution error: ${error}`)
    }
}

function expand(doneSet: Set<string>): Array<string> {
    let res = new Array<string>
    UnitMgr.units().forEach((ud, uid) => {
        if (doneSet.has(uid)) return
        doneSet.add(uid)
        ud.sf.statements.forEach((stmt) => {
            if (Ts.isVariableStatement(stmt)) {
                const dtxt = stmt.declarationList.declarations[0].getText(ud.sf)
                const m = dtxt.match(/^(\w+)\W+(\w+)\.em\$clone\(.*\)$/)
                if (!m) return
                const xpath = `${BUILD_DIR}/${uid}__${m[1]}.em.ts`
                res.push(xpath)
                const tuid = ud.imports.get(m[2])!
                const tud = UnitMgr.units().get(tuid)!
                // console.log(`generating ${xpath} using ${tud.id}`)
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
    return res
}

export function parse(upath: string): void {
    curUpath = upath
    let workList = new Array<string>(Path.join(Session.getWorkDir(), upath))
    let expandDoneSet = new Set<string>
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
    while (workList.length > 0) {
        let foundList = new Array<string>(...workList)
        const customHost: Ts.CompilerHost = {
            ...baseHost,
            getSourceFile: (fileName, languageVersion, onError) => {
                if (fileName.endsWith(".em.ts") && Path.isAbsolute(fileName)) {
                    foundList.push(fileName)
                    // console.log(`found: ${UnitMgr.mkUid(fileName)}`)
                }
                return baseHost.getSourceFile(fileName, languageVersion, onError)
            },
        }
        const prog = Ts.createProgram(workList, options, customHost)
        // console.log(prog.getRootFileNames())
        for (const p of foundList) UnitMgr.create(prog.getSourceFile(p)!)
        workList = expand(expandDoneSet)
        // console.log(workList)
    }
    transpile(options)
}

function transpile(options: Ts.CompilerOptions) {
    UnitMgr.units().forEach((ud, uid) => {
        // console.log(`transpile: ${uid}`)
        const transOut = Ts.transpileModule(ud.sf.getText(ud.sf), {
            compilerOptions: options,
            fileName: ud.sf.fileName
        })
        Fs.mkdirSync(`${BUILD_DIR}/${Path.dirname(uid)}`, { recursive: true })
        Fs.writeFileSync(`${BUILD_DIR}/${uid}.em.js.map`, transOut.sourceMapText!, 'utf-8')
        let content = transOut.outputText
        content = content.replaceAll(/_EM_SCRIPT_1\.default\.declare\((.+)\)/g, `_EM_SCRIPT_1.default.declare($1, '${uid}')`)
        content = content.replace('@EM-SCRIPT', '../em.lang/em-script')
        content = content.replaceAll(/require\("@(.+)\.em"\)/g, 'require("../$1.em")')
        Fs.writeFileSync(`${BUILD_DIR}/${uid}.em.js`, content, 'utf-8')
    })
    const emFile = 'em.lang/em-script'
    const emInFile = `./workspace/em.core/${emFile}.ts`
    const emSrc = Fs.readFileSync(emInFile, 'utf-8')
    const emOut = Ts.transpileModule(emSrc, {
        compilerOptions: options,
        fileName: emInFile
    })
    Fs.mkdirSync(`${BUILD_DIR}/${Path.dirname(emFile)}`, { recursive: true })
    Fs.writeFileSync(`${BUILD_DIR}/${emFile}.js.map`, emOut.sourceMapText!, 'utf-8')
    Fs.writeFileSync(`${BUILD_DIR}/${emFile}.js`, emOut.outputText, 'utf-8')
}
