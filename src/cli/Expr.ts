import * as Ts from 'typescript'

import * as Out from './Out'
import * as Unit from './Unit'

export function generate(expr: Ts.Node, ud: Unit.Desc) {
    Out.addText(expr.getText(ud.sf))
}