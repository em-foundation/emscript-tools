import * as Fs from 'fs';
import * as Path from 'path';
import * as Ts from 'typescript';

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

export function parse(upath: string): void {
    const options: Ts.CompilerOptions = {
        module: Ts.ModuleKind.CommonJS,
        target: Ts.ScriptTarget.ESNext,
        strict: true,
        esModuleInterop: true,
        outDir: 'out', // Output directory
        paths: {
            "@EM-SCRIPT": [
                "./em.core/em.lang/em-script"
            ],
            "@bob.test/*": [
                "./bob.pkg/bob.test/*"
            ],
            "@em.hal/*": [
                "./em.core/em.hal/*"
            ],
            "@em.lang/*": [
                "./em.core/em.lang/*"
            ],
            "@em.mcu/*": [
                "./em.core/em.mcu/*"
            ],
            "@em.utils/*": [
                "./em.core/em.utils/*"
            ],
            "@ti.distro.cc23xx/*": [
                "./ti.cc23xx/ti.distro.cc23xx/*"
            ],
            "@ti.mcu.cc23xx/*": [
                "./ti.cc23xx/ti.mcu.cc23xx/*"
            ]
        },

    };
    const customCompilerHost: Ts.CompilerHost = {
        ...Ts.createCompilerHost({}),
        getSourceFile: (fileName, languageVersion, onError) => {
            if (fileName.endsWith(".em.ts") && Path.isAbsolute(fileName)) {
                console.log("Reading source file:", fileName);
            }
            return Ts.createCompilerHost({}).getSourceFile(fileName, languageVersion, onError);
        },
    };
    curProg = Ts.createProgram([upath], options, customCompilerHost);
}

export function dump(): void {
}