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

export async function newComposite(uri: Vsc.Uri) {
    const content = `
import em from '@$$emscript'
export const em$_U = em.$declare('COMPOSITE')

`
    await Utils.newUnit(uri, 'composite', content.trim())
}


export async function newInterface(uri: Vsc.Uri) {
    const content = `
import em from '@$$emscript'
export const em$_U = em.$declare('INTERFACE')

export interface em$meta { }

export interface em$_I {
    em$meta: em$meta
}

`
    await Utils.newUnit(uri, 'interface', content.trim())
}

export async function newModule(uri: Vsc.Uri) {
    const content = `
import em from '@$$emscript'
export const em$_U = em.$declare('MODULE')

export namespace em$meta { }


`
    await Utils.newUnit(uri, 'module', content.trim())
}

export async function newProgram(uri: Vsc.Uri) {
    const content = `
import em from '@$$emscript'
export const em$_U = em.$declare('MODULE')

export namespace em$meta { }

export function em$run() {
    em.halt()
}


`
    await Utils.newUnit(uri, 'module', content.trim())
}

export async function newTemplate(uri: Vsc.Uri) {
    const content = `
import em from '@$$emscript'
export const em$_T = em.$declare('TEMPLATE')

export namespace em$template {
    export const em$_U = em.$declare('MODULE')

    namespace em$meta { }
}

export function em$clone() { return { em$_T, ...em$template } }

`
    await Utils.newUnit(uri, 'template', content.trim())
}

