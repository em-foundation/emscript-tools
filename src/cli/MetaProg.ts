import * as Fs from 'fs';
import * as Path from 'path';
import * as Ts from 'typescript';

import * as Session from './Session'
import * as Trans from './Trans'


const OUTDIR = './workspace/.emscript/genjs'

let curProg: Ts.Program
let curUpath: string

export function dump(): void {
    // console.log(curProg.getRootFileNames()[0])
}

export function emit(): void {
    const transformers: Ts.CustomTransformers = {
        before: [Trans.imports(curProg)]
    }
    const emitResult = curProg.emit(undefined, undefined, undefined, false, transformers);
}

export function exec(): void {
    const jsPath = Path.resolve(OUTDIR, curUpath).replace(/\\/g, '/').replace(/\.ts$/, '.js');
    try {
        require(jsPath)
    } catch (error) {
        console.error(`*** execution error: ${error}`)
    }

}

export function parse(upath: string): void {
    curUpath = upath
    const cfgHost: Ts.ParseConfigFileHost = {
        ...Ts.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
            console.error(
                Ts.formatDiagnosticsWithColorAndContext([diagnostic], {
                    getCanonicalFileName: (fileName) => fileName,
                    getCurrentDirectory: Ts.sys.getCurrentDirectory,
                    getNewLine: () => Ts.sys.newLine,
                })
            );
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
    const customCompilerHost: Ts.CompilerHost = {
        ...Ts.createCompilerHost({}),
        getSourceFile: (fileName, languageVersion, onError) => {
            if (fileName.endsWith(".em.ts") && Path.isAbsolute(fileName)) {
                // console.log("Reading source file:", fileName);
            }
            return Ts.createCompilerHost({}).getSourceFile(fileName, languageVersion, onError);
        },
    };
    curProg = Ts.createProgram([Path.join(Session.getWorkDir(), upath)], options, customCompilerHost)
}
