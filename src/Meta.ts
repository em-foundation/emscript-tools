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

const semanticCodes = new Set<number>([
    2304, // Cannot find name
    2307, // Cannot find module
    2339, // Property does not exist
    2345, // Argument type mismatch
    2552, // Cannot find name; did you mean
    2554, // Wrong argument count
    2724, // Module has no exported member; did you mean
])

export interface ParseOptions {
    check?: boolean
}

export interface ParseResult {
    diagnostics: Ts.Diagnostic[]
    errorCount: number
}

function call(fn: string, u: any) {
    if (fn in u) {
        // console.log(`call ${u.$U.uid}.${fn}`)  // TODO logging
        u[fn]()
    }
    else if (u.em$meta && fn in u.em$meta) {
        // console.log(`call ${u.$U.uid}.${fn}`) // TODO logging
        u.em$meta[fn]()
    }
}

export function exec() {
    for (const uid of curUidList) {
        const ud = Unit.units().get(uid)!
        if (ud.kind == 'TEMPLATE') continue
        const upath = `${Session.getBuildDir()}/${uid}.em.js`
        let uobj: any = require(upath)
        ud.$uobj = uobj
        $$units.set(uid, uobj)
        uobj.$$init()
    }
    process.chdir(Session.getWorkDir())
    const $$uarrBot = Array.from($$units.values())
    const $$uarrTop = Array.from($$units.values()).reverse()
    $$uarrBot.forEach(u => call('em$init', u))
    $$uarrTop.forEach(u => call('em$configure', u))
    $$units.get(`${Session.getDistro().bucket}/BuildC`).$U._used = true
    $$units.get(`${Session.mkUid(curUpath)}`).$U._used = true
    const workSet = new Set<string>()
    $$units.forEach((uobj, uid) => {
        if (uobj.$U._used) workSet.add(uid)
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
                nextSet.add(cobj.$$dlg.$U.uid)
            }
            for (const p in uobj.em$decls) {
                const cobj = uobj.em$decls[p]
                if (!cobj || cobj.$$em$config != 'proxy') continue
                if (!cobj.bound) Err.fail(`unbound proxy: ${uid}.${p}`)
                nextSet.add(cobj.$$dlg.$U.uid)
            }
        })
        workSet.clear()
        nextSet.forEach(uid => workSet.add(uid))
    }
    $$uarrTop.forEach(u => {
        if (!usedSet.has(u.$U.uid)) return
        call('em$construct', u)
        usedSet.add(u.$U.uid)
    })
    const cwd = process.cwd()
    process.chdir(Session.getBuildDir())
    $$uarrTop.forEach(u => {
        if (!usedSet.has(u.$U.uid)) return
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
                const m = dtxt.match(/^(\w+)\W+\$clone\((\w+)\)$/)
                if (!m) return
                const xpath = `${Session.getBuildDir()}/${uid}__${m[1]}.em.ts`
                ud.addImport(m[1], `${uid}__${m[1]}`)
                res.push(xpath)
                const tuid = ud.imports.get(m[2])!
                const tud = Unit.units().get(tuid)!
                let lines = Array<string>(`// *** GENERATED UNIT CLONED FROM '${tud.id}'\n`)
                lines.push("import '@$$emscript'")
                lines.push("export const $U = $declare('MODULE')")
                let found = false
                for (let line of tud.sf.getText(tud.sf).split('\n').slice(2)) {
                    if (line.startsWith('export namespace em$template')) {
                        lines.push('// namespace em$template\n')
                        found = true
                        continue
                    }
                    if (found && line.indexOf('export const $U') != -1) continue
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

function mkInitFxn(ud: Unit.Desc): string {
    let res = '\nfunction $$init() {\n'
    for (const stmt of ud.sf.statements) {
        if (!Ts.isVariableStatement(stmt)) continue
        if (stmt.modifiers?.some((mod) => mod.kind === Ts.SyntaxKind.DeclareKeyword)) continue
        const es = stmt.modifiers?.some((mod) => mod.kind === Ts.SyntaxKind.ExportKeyword) ? 'exports.' : ''
        const decl = stmt.declarationList.declarations[0]
        if (!Ts.isIdentifier(decl.name)) continue
        if (decl.initializer) {
            const txt = decl.initializer.getText(ud.sf)
            if (txt.startsWith('$config<')) {
                res += `    ${es}${decl.name.text}._$$init()\n`
            }
            continue
        }
        if (!decl.type) continue
        const ts = ud.resolveType(decl.type.getText(ud.sf)) ?? 'unknown'
        res += `    ${es}${decl.name.text} = $default('${ts}', '${ud.id}')\n`
    }
    res += '}\nexports.$$init = $$init\n'
    return res
}

export function formatDiagnostics(diagnostics: ReadonlyArray<Ts.Diagnostic>): string[] {
    return diagnostics.map(diagnostic => {
        let fileName = '<unknown>'
        let line = 0
        let column = 0
        if (diagnostic.file && diagnostic.start !== undefined) {
            const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
            fileName = Path.relative(process.cwd(), diagnostic.file.fileName).replaceAll(/\\/g, '/')
            line = pos.line + 1
            column = pos.character + 1
        }
        const category = Ts.DiagnosticCategory[diagnostic.category].toLowerCase()
        const code = `TS${diagnostic.code}`
        const message = Ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ').replace(/\s+/g, ' ')
        return `${fileName}:${line}:${column} ${category} ${code} ${message}`
    })
}

function collectDiagnostics(
    program: Ts.Program,
    files: ReadonlyArray<string>,
    topFile: string,
    diagnostics: Ts.Diagnostic[],
    seen: Set<string>
) {
    const topPath = normalizePath(topFile)
    for (const file of files) {
        if (!isEmSourcePath(file)) continue
        const sf = program.getSourceFile(file)
        if (!sf) continue
        addDiagnostics(program.getSyntacticDiagnostics(sf), diagnostics, seen)
        addDiagnostics(
            program.getSemanticDiagnostics(sf).filter(diagnostic =>
                semanticCodes.has(diagnostic.code) ||
                (diagnostic.code == 2322 && normalizePath(sf.fileName) == topPath)
            ),
            diagnostics,
            seen
        )
    }
}

function addDiagnostics(
    incoming: ReadonlyArray<Ts.Diagnostic>,
    diagnostics: Ts.Diagnostic[],
    seen: Set<string>
) {
    for (const diagnostic of incoming) {
        if (!diagnostic.file) continue
        if (!isEmSourcePath(diagnostic.file.fileName)) continue
        const message = flattenMessage(diagnostic)
        if (isIteratorNoise(message)) continue
        const key = [
            diagnostic.file.fileName,
            diagnostic.start ?? -1,
            diagnostic.length ?? -1,
            diagnostic.category,
            diagnostic.code,
            message,
        ].join('|')
        if (seen.has(key)) continue
        seen.add(key)
        diagnostics.push(diagnostic)
    }
}

function isEmSourcePath(path: string): boolean {
    const fileName = normalizePath(path)
    if (!fileName.endsWith('.em.ts')) return false
    if (fileName.includes('/node_modules/')) return false
    if (Path.basename(fileName) == '$REGS.em.ts') return false
    return true
}

function flattenMessage(diagnostic: Ts.Diagnostic): string {
    return Ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
}

function isIteratorNoise(message: string): boolean {
    return message.includes('Iterator') ||
        message.includes('Symbol.iterator') ||
        message.includes("must have a '[Symbol.iterator]'")
}

function normalizePath(path: string): string {
    return path.replaceAll(/\\/g, '/')
}

export function parse(upath: string, opts: ParseOptions = {}): ParseResult {
    curUpath = upath
    const diagnostics = new Array<Ts.Diagnostic>()
    const seenDiagnostics = new Set<string>()
    const dist = Session.getDistro()
    const topFile = Path.join(Session.getWorkDir(), upath)
    let workList = new Array<string>(
        topFile,
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
                }
                return baseHost.getSourceFile(fileName, languageVersion, onError)
            },
        }
        const prog = Ts.createProgram(workList, options, customHost)
        if (opts.check) collectDiagnostics(prog, foundList, topFile, diagnostics, seenDiagnostics)
        const tc = prog.getTypeChecker()
        for (const p of foundList) {
            const sf = prog.getSourceFile(p)
            if (sf) Unit.create(sf, tc)
        }
        const errorCount = diagnostics.length
        if (errorCount > 0) return { diagnostics, errorCount }
        workList = expand(expandDoneSet)
    }
    curUidList = tsortUnits()
    const errorCount = diagnostics.length
    transpile(options)
    return { diagnostics, errorCount }
}

function transpile(options: Ts.CompilerOptions) {
    const buildDir = Session.getBuildDir()
    for (const uid of curUidList) {
        const ud = Unit.units().get(uid)!
        const transOut = Ts.transpileModule(ud.sf.getText(ud.sf), {
            compilerOptions: options,
            fileName: ud.sf.fileName,
            transformers: {
                before: [
                    Trans.callbackTransformer(ud.cname),
                    Trans.configTransformer(),
                    Trans.declareTransformer(uid),
                    Trans.enumTransformer(ud.cname),
                    Trans.exportTransformer,
                    Trans.factoryTransformer(ud.cname),
                    Trans.frameTransformer(),
                    Trans.implementsTransformer(),
                    Trans.vecTypeTransformer(ud),
                    Trans.tdefsTransformer(ud),
                    Trans.structTransformer(ud),
                    Trans.tableTransformer(ud),
                    Trans.typeopTransformer(ud, '$config'),
                    Trans.typeopTransformer(ud, '$sizeof'),
                    Trans.typeopTransformer(ud, '$table'),
                    Trans.vectorTransformer(ud),
                    Trans.typeopTransformer(ud, '$default'), // prior transformers generate $default nodes
                ]
            },
        })
        Fs.mkdirSync(`${buildDir}/${Path.dirname(uid)}`, { recursive: true })
        Fs.writeFileSync(`${buildDir}/${uid}.em.js.map`, transOut.sourceMapText!, 'utf-8')
        let src = transOut.outputText
        src = src.replaceAll(/\$declare\((.+)\)/g, `__$$declare('${uid}', $1)`)
        src = src.replace('@$$emscript', '../em.lang/emscript')
        src = src.replace('@$distro/', `../${Session.getDistro().bucket}/`)
        src = src.replaceAll(/require\("@(.+)\.em"\)/g, 'require("../$1.em")')
        src = src.replaceAll(/require\("@(.+)\.em"\)/g, 'require("../$1.em")')
        src = src.replaceAll(/((\w+)) = \$clone\((\w+)\);/g, `$1 = __importStar(require("../${uid}__$2.em"))`)
        src += mkInitFxn(ud)
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
        const u = units.get(uid)
        if (u) {
            u.imports.forEach(imp => {
                dfs(imp)
            })
            res.push(uid)
        } else Err.fail(`no unit named '${uid}'`)
    }
    dfs(`${Session.getDistro().bucket}/BuildC`)
    dfs(Session.mkUid(curUpath))
    return res
}
