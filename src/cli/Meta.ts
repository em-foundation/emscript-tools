import * as Fs from 'fs'
import * as Path from 'path'
import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Session from './Session'
import * as Unit from './Unit'

let curUpath: string
let curUidList: Array<string>

let $$units = new Map<string, any>()
let $$used = new Set<string>()

export function exec(): Map<string, any> {
    for (const uid of curUidList) {
        const ud = Unit.units().get(uid)!
        if (ud.kind == 'TEMPLATE') continue
        const upath = `${Session.getBuildDir()}/${uid}.em.js`
        let uobj: any = require(upath)
        if (ud.kind == 'MODULE') uobj = uobj.default
        $$units.set(uid, uobj)
    }
    findUsed().forEach(uid => {
        $$units.get(uid).em$_U._used = true
    })
    const $$uarrBot = Array.from($$units.values())
    const $$uarrTop = Array.from($$units.values()).reverse()
    $$uarrBot.forEach(u => { if ('em$init' in u) u.em$init() })
    $$uarrTop.forEach(u => { if ('em$configure' in u) u.em$configure() })
    $$uarrTop.forEach(u => {
        if (!u.em$_U._used) return
        if ('em$construct' in u) u.em$construct()
        $$used.add(u.em$_U.uid)
    })
    $$used.forEach(uid => {
        const uobj = $$units.get(uid)!
        for (const p in uobj.em$_C) {
            const cobj = uobj.em$_C[p]
            if (cobj.$$em$config != 'proxy') return
            if (!cobj.bound) return // TODO: error message
            cobj.prx.em$_U._used = true
            // CALL em$construct
            $$used.add(cobj.prx.em$_U.uid)
        }
    })
    const cwd = process.cwd()
    process.chdir(Session.getBuildDir())
    $$uarrTop.forEach(u => {
        if (!u.em$_U._used) return
        if ('em$generate' in u) u.em$generate()
    })
    process.chdir(cwd)
    // console.log($$used)
    const res = new Map<string, any>()
    Array.from($$used.values()).reverse().forEach(uid => {
        const ud = Unit.units().get(uid)!
        if (ud.kind == 'MODULE') res.set(uid, $$units.get(uid))
    })
    return res
}

function expand(doneSet: Set<string>): Array<string> {
    let res = new Array<string>
    Unit.units().forEach((ud, uid) => {
        if (doneSet.has(uid)) return
        doneSet.add(uid)
        ud.sf.statements.forEach((stmt) => {
            if (Ts.isVariableStatement(stmt)) {
                const dtxt = stmt.declarationList.declarations[0].getText(ud.sf)
                const m = dtxt.match(/^(\w+)\W+(\w+)\.em\$clone\(.*\)$/)
                if (!m) return
                const xpath = `${Session.getBuildDir()}/${uid}__${m[1]}.em.ts`
                ud.addImport(m[1], `${uid}__${m[1]}`)
                res.push(xpath)
                const tuid = ud.imports.get(m[2])!
                const tud = Unit.units().get(tuid)!
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

function findUsed(): Set<string> {
    const used = new Set<string>()
    function dfs(uid: string) {
        if (used.has(uid)) return
        const ud = Unit.units().get(uid)!
        if (ud.kind == 'TEMPLATE') return
        used.add(uid)
        ud.imports.forEach(imp => {
            dfs(imp)
        })
    }
    dfs(`${Session.getDistro().bucket}/BuildC`)
    dfs(Unit.mkUid(curUpath))
    return used
}

export function parse(upath: string): void {
    curUpath = upath
    const dist = Session.getDistro()
    let workList = new Array<string>(
        Path.join(Session.getWorkDir(), upath),
        Path.join(Session.getWorkDir(), dist.package, dist.bucket, 'BuildC.em.ts'),
    )
    const expandDoneSet = new Set<string>
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
        outDir: Session.getBuildDir(),
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
                    // console.log(`found: ${Unit.mkUid(fileName)}`)
                }
                return baseHost.getSourceFile(fileName, languageVersion, onError)
            },
        }
        const prog = Ts.createProgram(workList, options, customHost)
        // console.log(prog.getRootFileNames())
        const tc = prog.getTypeChecker()
        for (const p of foundList) Unit.create(prog.getSourceFile(p)!, tc)
        workList = expand(expandDoneSet)
        // console.log(workList)
    }
    curUidList = tsortUnits()
    transpile(options)
}

function transpile(options: Ts.CompilerOptions) {
    const buildDir = Session.getBuildDir()
    for (const uid of curUidList) {
        const ud = Unit.units().get(uid)!
        const transOut = Ts.transpileModule(ud.sf.getText(ud.sf), {
            compilerOptions: options,
            fileName: ud.sf.fileName
        })
        Fs.mkdirSync(`${buildDir}/${Path.dirname(uid)}`, { recursive: true })
        Fs.writeFileSync(`${buildDir}/${uid}.em.js.map`, transOut.sourceMapText!, 'utf-8')
        let src = transOut.outputText
        src = src.replaceAll(/__emscript_1\.default\.declare\((.+)\)/g, `__emscript_1.default.declare($1, '${uid}')`)
        src = src.replace('@$$emscript', '../em.lang/emscript')
        src = src.replaceAll(/require\("@(.+)\.em"\)/g, 'require("../$1.em")')
        src = src.replaceAll(/((\w+)) = \w+\.em\$clone\(.*\);/g, `$1 = __importStar(require("../${uid}__$2.em")).default`)
        Fs.writeFileSync(`${buildDir}/${uid}.em.js`, src, 'utf-8')
    }
    const emFile = 'em.lang/emscript'
    const emInFile = `./workspace/em.core/${emFile}.ts`
    const emSrc = Fs.readFileSync(emInFile, 'utf-8')
    const emOut = Ts.transpileModule(emSrc, {
        compilerOptions: options,
        fileName: emInFile
    })
    Fs.mkdirSync(`${buildDir}/${Path.dirname(emFile)}`, { recursive: true })
    Fs.writeFileSync(`${buildDir}/${emFile}.js.map`, emOut.sourceMapText!, 'utf-8')
    Fs.writeFileSync(`${buildDir}/${emFile}.js`, emOut.outputText, 'utf-8')
}

function tsortUnits(): Array<string> {
    const units = Unit.units()
    const res = new Array<string>
    const visited = new Set<string>
    function dfs(uid: string) {
        if (visited.has(uid)) return
        visited.add(uid)
        units.get(uid)!.imports.forEach(imp => {
            dfs(imp)
        })
        res.push(uid)
    }
    dfs(`${Session.getDistro().bucket}/BuildC`)
    dfs(Unit.mkUid(curUpath))
    // const sf = units.get(Unit.mkUid(curUpath))!.sf
    // const em$targ = Ast.findNamespace(sf, 'em$targ')
    // em$targ!.forEachChild(node => console.log(Ts.SyntaxKind[node.kind]))
    return res
}
