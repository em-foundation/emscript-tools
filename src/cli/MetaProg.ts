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
    UnitMgr.units().forEach((ud, uid) => {
        console.log(`${uid}: ${ud.kind}`)
        //     ud.sf.statements.forEach((stmt) => {
        //         if (Ts.isVariableStatement(stmt)) {
        //             const dtxt = stmt.declarationList.declarations[0].getText(ud.sf)
        //             const m = dtxt.match(/(\w+)\.em\$clone\(.*\)$/)
        //             if (m) console.log(ud.imports.get(m[1]))
        //             //if (dtxt.match(/console.log(`    ${dtxt}`)
        //         }
        //     })
        ud.imports.forEach((uid, imp) => console.log(`    ${imp}: ${uid}`))
    })
}

export function emit(): void {
    // console.log('*** emit'); return
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
        let foundList = new Array<string>
        const customHost: Ts.CompilerHost = {
            ...baseHost,
            getSourceFile: (fileName, languageVersion, onError) => {
                if (fileName.endsWith(".em.ts") && Path.isAbsolute(fileName)) {
                    foundList.unshift(fileName)
                    // console.log(mkUname(fileName))
                }
                return baseHost.getSourceFile(fileName, languageVersion, onError)
            },
        }
        curProg = Ts.createProgram(workList, options, customHost)
        for (const p of foundList) UnitMgr.create(curProg.getSourceFile(p)!)
        workList = []
        // expand(expandDoneSet)
    }
}
