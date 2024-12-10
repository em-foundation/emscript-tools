import * as Fs from "fs";
import * as Ts from "typescript";

// export function exec(upath: string): void {
//     const settings: Ts.FormatCodeSettings = {
//         indentSize: 4,
//         tabSize: 4,
//         newLineCharacter: "\n",
//         convertTabsToSpaces: true,
//         insertSpaceAfterCommaDelimiter: true,
//         insertSpaceAfterSemicolonInForStatements: true,
//         insertSpaceBeforeAndAfterBinaryOperators: true,
//         insertSpaceAfterConstructor: false,
//         insertSpaceAfterKeywordsInControlFlowStatements: true,
//         insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
//         insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: false,
//         insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
//         insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
//         insertSpaceBeforeFunctionParenthesis: false,
//         semicolons: Ts.SemicolonPreference.Remove,
//     };
//     const src = formatUnit(upath, settings)
//     console.log(`----\n${src}\n----`)
//     // Fs.writeFileSync(upath, fmtSrc, "utf8");
// }
// 
// function formatUnit(upath: string, settings: Ts.FormatCodeSettings): string {
//     const src = Fs.readFileSync(upath, "utf8");
//     const languageServiceHost: Ts.LanguageServiceHost = {
//         getScriptFileNames: () => [upath],
//         getScriptVersion: () => "1",
//         getScriptSnapshot: (fileName) => Ts.ScriptSnapshot.fromString(fileName === upath ? upath : ""),
//         getCurrentDirectory: () => process.cwd(),
//         getCompilationSettings: () => ({}),
//         getDefaultLibFileName: (options) => Ts.getDefaultLibFilePath(options),
//         fileExists: Ts.sys.fileExists,
//         readFile: Ts.sys.readFile,
//         readDirectory: Ts.sys.readDirectory,
//     };
//     const languageService = Ts.createLanguageService(languageServiceHost);
//     const edits = languageService.getFormattingEditsForDocument(upath, settings);
//     let formattedContent = src;
//     for (const edit of edits.slice().reverse()) {
//         formattedContent =
//             formattedContent.slice(0, edit.span.start) +
//             edit.newText +
//             formattedContent.slice(edit.span.start + edit.span.length);
//     }
//     return formattedContent;
// }

export function exec(upath: string): void {
    const src = formatFile(upath, formatSettings)
    // console.log(`----\n${src}\n----`)
    Fs.writeFileSync(upath, src, "utf8");
}

// Function to format a file using the TypeScript Language Service
function formatFile(filePath: string, settings: Ts.FormatCodeSettings) {
    // Read the file content
    const fileContent = Fs.readFileSync(filePath, "utf8");

    // Create a TypeScript Language Service Host
    const languageServiceHost: Ts.LanguageServiceHost = {
        getScriptFileNames: () => [filePath],
        getScriptVersion: () => "1",
        getScriptSnapshot: (fileName) =>
            Ts.ScriptSnapshot.fromString(fileName === filePath ? fileContent : ""),
        getCurrentDirectory: () => process.cwd(),
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options) => Ts.getDefaultLibFilePath(options),
        fileExists: Ts.sys.fileExists,
        readFile: Ts.sys.readFile,
        readDirectory: Ts.sys.readDirectory,
    };

    // Create the Language Service
    const languageService = Ts.createLanguageService(languageServiceHost);

    // Get formatting edits for the file
    const edits = languageService.getFormattingEditsForDocument(filePath, settings);

    // Apply edits to the file content
    let formattedContent = fileContent;
    for (const edit of edits.slice().reverse()) {
        formattedContent =
            formattedContent.slice(0, edit.span.start) +
            edit.newText +
            formattedContent.slice(edit.span.start + edit.span.length);
    }

    // Return the formatted content
    return formattedContent;
}

// // Command-line arguments
// const filePath = process.argv[2];
// if (!filePath) {
//     console.error("Usage: node format-ts-file.js <file-path>");
//     process.exit(1);
// }

// Default FormatCodeSettings
const formatSettings: Ts.FormatCodeSettings = {
    indentSize: 4,
    tabSize: 4,
    newLineCharacter: "\n",
    convertTabsToSpaces: true,
    trimTrailingWhitespace: true,
    insertSpaceAfterCommaDelimiter: true,
    insertSpaceAfterSemicolonInForStatements: true,
    insertSpaceBeforeAndAfterBinaryOperators: true,
    insertSpaceAfterConstructor: false,
    insertSpaceAfterKeywordsInControlFlowStatements: true,
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
    insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: false,
    insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
    insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
    insertSpaceBeforeFunctionParenthesis: false,
    semicolons: Ts.SemicolonPreference.Remove,
};

//// Format the file and save it
//try {
//    const resolvedPath = path.resolve(filePath);
//    const formattedContent = formatFile(resolvedPath, formatSettings);
//
//    // Save the formatted file
//    fs.writeFileSync(resolvedPath, formattedContent, "utf8");
//    console.log(`File formatted successfully: ${resolvedPath}`);
//} catch (error) {
//    console.error("Error formatting file:", error);
//}
//