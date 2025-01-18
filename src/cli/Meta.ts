import * as Fs from 'fs'
import * as Path from 'path'
import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Err from './Err'
import * as Session from './Session'
import * as Trans from './Trans'
import * as Unit from './Unit'

let curUpath: string
let curUidList: Array<string>

let $$units = new Map<string, any>()

function call(fn: string, u: any) {
    if (fn in u) {
        // console.log(`call ${u.em$_U.uid}.${fn}`)  // TODO logging
        u[fn]()
    }
    else if (u.em$meta && fn in u.em$meta) {
        // console.log(`call ${u.em$_U.uid}.${fn}`) // TODO logging
        u.em$meta[fn]()
    }
}

export function exec() {
    for (const uid of curUidList) {
        const ud = Unit.units().get(uid)!
        if (ud.kind == 'TEMPLATE') continue
        const upath = `${Session.getBuildDir()}/${uid}.em.js`
        let uobj: any = require(upath)
        $$units.set(uid, uobj)
    }
    const $$uarrBot = Array.from($$units.values())
    const $$uarrTop = Array.from($$units.values()).reverse()
    $$uarrBot.forEach(u => call('em$init', u))
    $$uarrTop.forEach(u => call('em$configure', u))
    $$uarrTop[0].em$_U._used = true // main unit
    $$units.get(`${Session.getDistro().bucket}/BuildC`).em$_U._used = true
    const workSet = new Set<string>()
    $$units.forEach((uobj, uid) => {
        if (uobj.em$_U._used) workSet.add(uid)
    })
    const usedSet = new Set<string>()
    const nextSet = new Set<string>()
    while (workSet.size > 0) {
        workSet.forEach
        nextSet.clear()
        workSet.forEach(uid => {
            if (usedSet.has(uid)) return
            const ud = Unit.units().get(uid)!
            if (ud.kind == 'TEMPLATE') return
            usedSet.add(uid)
            if (ud.kind == 'COMPOSITE') return
            ud.imports.forEach(iid => {
                nextSet.add(iid)
            })
            const uobj = $$units.get(uid)!
            for (const p in uobj) {
                const cobj = uobj[p]
                if (cobj.$$em$config != 'proxy') continue
                if (!cobj.bound) Err.fail(`unbound proxy: ${uid}.${p}`)
                nextSet.add(cobj.prx.em$_U.uid)
            }
            for (const p in uobj.em$decls) {
                const cobj = uobj.em$decls[p]
                if (!cobj || cobj.$$em$config != 'proxy') continue
                if (!cobj.bound) Err.fail(`unbound proxy: ${uid}.${p}`)
                nextSet.add(cobj.prx.em$_U.uid)
            }
        })
        workSet.clear()
        nextSet.forEach(uid => workSet.add(uid))
    }
    $$uarrTop.forEach(u => {
        if (!usedSet.has(u.em$_U.uid)) return
        call('em$construct', u)
        usedSet.add(u.em$_U.uid)
    })
    const cwd = process.cwd()
    process.chdir(Session.getBuildDir())
    $$uarrTop.forEach(u => {
        if (!usedSet.has(u.em$_U.uid)) return
        call('em$generate', u)
    })
    process.chdir(cwd)
    const res = new Map<string, any>()
    curUidList.forEach(uid => {
        if (!usedSet.has(uid)) return
        const ud = Unit.units().get(uid)!
        if (ud.kind == 'MODULE') res.set(uid, $$units.get(uid))
    })
    Session.setUnits(res)
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
                let lines = Array<string>(`// *** GENERATED UNIT CLONED FROM '${tud.id}'\n`)
                lines.push("import em from '@$$emscript'")
                lines.push("export const em$_U = em.declare('MODULE')")
                let found = false
                for (let line of tud.sf.getText(tud.sf).split('\n').slice(2)) {
                    if (line.startsWith('export namespace em$template')) {
                        lines.push('// namespace em$template\n')
                        found = true
                        continue
                    }
                    if (found && line.indexOf('export const em$_U') != -1) continue
                    if (found && line.startsWith('}')) break
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
        const tc = prog.getTypeChecker()
        for (const p of foundList) Unit.create(prog.getSourceFile(p)!, tc)
        workList = expand(expandDoneSet)
    }
    curUidList = tsortUnits()
    transpile(options)
}

function transpile(options: Ts.CompilerOptions) {
    const buildDir = Session.getBuildDir()
    for (const uid of curUidList) {
        const ud = Unit.units().get(uid)!
        Trans.collectAliasInfo(ud.sf)
        const transOut = Ts.transpileModule(ud.sf.getText(ud.sf), {
            compilerOptions: options,
            fileName: ud.sf.fileName,
            transformers: {
                before: [
                    Trans.exportTransformer,
                    Trans.factoryTransformer(ud.cname),
                    Trans.sizeofTransformer(),
                    Trans.structTransformer(ud.cname)
                ]
            },
        })
        Fs.mkdirSync(`${buildDir}/${Path.dirname(uid)}`, { recursive: true })
        Fs.writeFileSync(`${buildDir}/${uid}.em.js.map`, transOut.sourceMapText!, 'utf-8')
        let src = transOut.outputText
        src = src.replaceAll(/__emscript_1\.default\.declare\((.+)\)/g, `__emscript_1.default.declare($1, '${uid}')`)
        src = src.replace('@$$emscript', '../em.lang/emscript')
        src = src.replaceAll(/require\("@(.+)\.em"\)/g, 'require("../$1.em")')
        src = src.replaceAll(/((\w+)) = \w+\.em\$clone\(.*\);/g, `$1 = __importStar(require("../${uid}__$2.em"))`)
        Fs.writeFileSync(`${buildDir}/${uid}.em.js`, src, 'utf-8')
    }
    const emFile = 'em.lang/emscript'
    const emInFile = `./workspace/em.core/${emFile}.ts`
    const emSrc = Fs.readFileSync(emInFile, 'utf-8')
    const emOut = Ts.transpileModule(emSrc, {
        compilerOptions: options,
        fileName: emInFile,
        transformers: {
            before: [
                Trans.exportTransformer
            ]
        },
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
    dfs(Session.mkUid(curUpath))
    return res
}
