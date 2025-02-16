import * as Cmd from './Cmd'
import * as Path from 'path'
import * as SemTok from './SemTok'
import * as Utils from './Utils'
import * as Vsc from 'vscode'

export async function activate(context: Vsc.ExtensionContext) {
    console.log("emscript active")

    await refreshIcons()
    Utils.updateConfig()
    Utils.updateSettings('editor', 'tabCompletion', 'on')
    Utils.updateSettings('workbench', 'tree.indent', 20)
    Utils.updateSettings('workbench', 'colorTheme', 'EM•Script Dark')
    Utils.updateSettings('files', 'associations', {
        "*.em.ts": "typescript",
    })

    Vsc.languages.setLanguageConfiguration('typescript', {
        onEnterRules: [
            { beforeText: /^\s+\|-/, action: { indentAction: Vsc.IndentAction.None, appendText: '|-> ' } },
        ],
    })


    for (let cmd of ["em.build", "em.buildLoad", "em.buildMeta"]) {
        context.subscriptions.push(Vsc.commands.registerCommand(cmd, (uri: Vsc.Uri) => Cmd.build(uri, cmd)))
    }

    context.subscriptions.push(Vsc.commands.registerCommand("em.newComposite", Cmd.newComposite))
    context.subscriptions.push(Vsc.commands.registerCommand("em.newInterface", Cmd.newInterface))
    context.subscriptions.push(Vsc.commands.registerCommand("em.newModule", Cmd.newModule))
    context.subscriptions.push(Vsc.commands.registerCommand("em.newProgram", Cmd.newProgram))
    context.subscriptions.push(Vsc.commands.registerCommand("em.newTemplate", Cmd.newTemplate))

    context.subscriptions.push(Vsc.languages.registerDocumentSemanticTokensProvider(
        { scheme: 'file', pattern: '**/*.em.ts' }, new SemTok.Provider(), SemTok.legend()))

    Vsc.workspace.onDidSaveTextDocument((document) => {
        if (document.fileName.endsWith(".em.ts")) Utils.format(document.fileName)
    })

    context.subscriptions.push(Vsc.commands.registerCommand("em.showVersion", Utils.showVersion))

    let sbi = Vsc.window.createStatusBarItem(Vsc.StatusBarAlignment.Left)
    let vers
    sbi.text = `EM•Script v${Utils.getVers()}`
    sbi.command = "em.showVersion"
    sbi.show()
    context.subscriptions.push(sbi)

    Vsc.window.showInformationMessage(`EM•Script activated [ version ${Utils.getVersFull()} ]`)
}

async function refreshIcons() {
    let conf = Vsc.workspace.getConfiguration('vsicons', Vsc.Uri.file(Utils.rootPath()))
    let pnames = Utils.mkPackageNames()
    let bnames = Utils.mkBucketNames()
    await conf.update('associations.folders', [
        { icon: 'empackage', extensions: pnames, format: 'svg' },
        { icon: 'embucket', extensions: bnames, format: 'svg' },
        { icon: 'emscript', extensions: ['.emscript'], format: 'svg' },
        { icon: 'emwork', extensions: ['workspace'], format: 'svg' },
    ], Vsc.ConfigurationTarget.Workspace)
    await conf.update('associations.files', [
        { icon: 'emunit', extensions: ['.em.ts', '.em-ts'], format: 'svg' },
    ], Vsc.ConfigurationTarget.Workspace)
    await conf.update('customIconFolderPath', Path.join(Vsc.extensions.getExtension('the-em-foundation.emscript')!.extensionPath, 'etc'))
    Vsc.commands.executeCommand('vscode-icons.regenerateIcons')
    Vsc.commands.executeCommand('setContext', 'ext.buckets', bnames)
    Vsc.commands.executeCommand('setContext', 'ext.packages', pnames)
}
