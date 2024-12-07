import * as Fs from 'fs';
import * as Path from 'path';
import * as Ts from 'typescript';

const OUTDIR = './workspace/.emscript/genjs'

let curProg: Ts.Program

/*
function createCustomCompilerHost(options: Ts.CompilerOptions): Ts.CompilerHost {
    const defaultHost = Ts.createCompilerHost(options);

    return {
        ...defaultHost,

        // Override file writing to output in `outDir`
        writeFile: (fileName, content) => {
            const outPath = Path.relative(options.rootDir!, fileName);
            Fs.mkdirSync(Path.dirname(outPath), { recursive: true });
            Fs.writeFileSync(outPath, content);
            console.log(`Emitted: ${outPath}`);
        },

        // Keep other behaviors unchanged
    };
}
*/

/*
function loadTsConfig(configPath: string): Ts.ParsedCommandLine {
    const configFile = Ts.readConfigFile(configPath, Ts.sys.readFile);
    if (configFile.error) {
        const message = Ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
        throw new Error(`Error reading tsconfig.json: ${message}`);
    }

    const parsedConfig = Ts.parseJsonConfigFileContent(
        configFile.config,
        Ts.sys,
        Path.dirname(configPath)
    );

    if (parsedConfig.errors.length > 0) {
        const messages = parsedConfig.errors.map((err) =>
            Ts.flattenDiagnosticMessageText(err.messageText, '\n')
        ).join('\n');
        throw new Error(`Error parsing tsconfig.json: ${messages}`);
    }

    return parsedConfig;
}
*/

export function dump(): void {
    // console.log(curProg.getRootFileNames()[0])
}

export function emit(): void {
    const emitResult = curProg.emit();
    // exec()
}

export function exec(): void {
    const tsFile = curProg.getRootFileNames()[0]
    const jsPath = Path.resolve(OUTDIR, Path.basename(tsFile).replace(/\.ts$/, '.js'));
    try {
        require(jsPath)
    } catch (error) {
        console.error(`*** execution error: ${error}`)
    }

}

export function parse(upath: string): void {
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
    };
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
    curProg = Ts.createProgram([upath], options, customCompilerHost);
}
