import * as Ts from 'typescript'

import * as Out from './Out'
import * as Unit from './Unit'

export function make(expr: Ts.Node, ud: Unit.Desc): string {
    return expr.getText(ud.sf)
}