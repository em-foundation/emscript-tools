import * as Path from 'path'
import * as Utils from './Utils'
import * as Vsc from 'vscode'

export async function activate(context: Vsc.ExtensionContext) {
    console.log("em-script active")
    await refreshIcons()
    Utils.updateConfig()
    Vsc.window.showInformationMessage("EM•Script activated")
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
        { icon: 'emunit', extensions: ['.em.ts'], format: 'svg' },
    ], Vsc.ConfigurationTarget.Workspace)
    await conf.update('customIconFolderPath', Path.join(Vsc.extensions.getExtension('the-em-foundation.em-script')!.extensionPath, 'etc'))
    Vsc.commands.executeCommand('vscode-icons.regenerateIcons')
}
