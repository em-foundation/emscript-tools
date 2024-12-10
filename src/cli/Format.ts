import * as Fs from "fs"
import * as Ts from "typescript"

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
}

export function exec(upath: string): void {
    const src = formatUnit(upath, formatSettings).trim()
    Fs.writeFileSync(upath, src, "utf8")
}

function formatUnit(upath: string, settings: Ts.FormatCodeSettings) {
    const src = Fs.readFileSync(upath, "utf8")
    const languageServiceHost: Ts.LanguageServiceHost = {
        getScriptFileNames: () => [upath],
        getScriptVersion: () => "1",
        getScriptSnapshot: (fileName) => Ts.ScriptSnapshot.fromString(fileName === upath ? src : ""),
        getCurrentDirectory: () => process.cwd(),
        getCompilationSettings: () => ({}),
        getDefaultLibFileName: (options) => Ts.getDefaultLibFilePath(options),
        fileExists: Ts.sys.fileExists,
        readFile: Ts.sys.readFile,
        readDirectory: Ts.sys.readDirectory,
    }
    const languageService = Ts.createLanguageService(languageServiceHost)
    const edits = languageService.getFormattingEditsForDocument(upath, settings)
    let formattedContent = src
    for (const edit of edits.slice().reverse()) {
        formattedContent =
            formattedContent.slice(0, edit.span.start) +
            edit.newText +
            formattedContent.slice(edit.span.start + edit.span.length)
    }
    return formattedContent
}
