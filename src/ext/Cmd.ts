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

export async function newModule(uri: Vsc.Uri) {
    const content = `
import em from '@$$em-script'
export const em$_U = em.declare('MODULE')

const em$config = { }

namespace em$meta { }

namespace em$targ { }

export default { em$_U /*, ...em$meta */ /*, ...em$targ */ }
    `
    await Utils.newUnit(uri, 'module', content.trim())
}


