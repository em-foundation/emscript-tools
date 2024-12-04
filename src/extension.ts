import * as Vsc from 'vscode'

export async function activate(context: Vsc.ExtensionContext) {
    console.log("em-script active")
    Vsc.window.showInformationMessage("EM•Script activated");
}