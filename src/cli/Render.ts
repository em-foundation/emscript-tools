import * as Ts from 'typescript'

import * as Unit from './Unit'

export function exec(ud: Unit.Desc) {
    console.log(ud.sf.getText(ud.sf))
}