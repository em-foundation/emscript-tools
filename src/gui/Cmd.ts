import * as Utils from './Utils'
import * as Vsc from 'vscode'

export function build(uri: Vsc.Uri, opts: string[] = []) {
    if (Utils.isUnitFile(uri)) {
        let upath = Utils.mkUpath(uri)
        Utils.build(upath)
    }
    else {
        Vsc.window.showErrorMessage('not a unit')
    }
}


