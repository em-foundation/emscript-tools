import * as Fs from 'fs';
import * as Path from 'path';
import * as Ts from 'typescript';

// Base directories
const tsConfigPath = 'tsconfig.json';

function loadTsConfig(configPath: string): Ts.ParsedCommandLine {
    // Read and parse the tsconfig.json file
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

function main() {
    try {


        // Load tsconfig.json
        const tsConfig = loadTsConfig(tsConfigPath);

        // Extract files and options
        const { options } = tsConfig;

        const args = process.argv.slice(2); // Get command-line arguments
        if (args.length !== 1) {
            console.error('Please provide a TypeScript source file as an argument.');
            process.exit(1);
        }

        const tsFilePath = args[0];

        // Create a program using the parsed options
        const program = Ts.createProgram([tsFilePath], options, createCustomCompilerHost(options));

        // Emit files
        const emitResult = program.emit();

        // Report diagnostics
        const allDiagnostics = Ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        if (allDiagnostics.length > 0) {
            allDiagnostics.forEach((diagnostic) => {
                const { line, character } = diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start!);
                const message = Ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                console.error(`${diagnostic.file!.fileName} (${line + 1},${character + 1}): ${message}`);
            });
        } else {
            console.log('Compilation completed without errors.');
        }
    } catch (error) {
        console.error('Error during compilation:', error);
    }
}

main();
