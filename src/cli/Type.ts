import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Targ from './Targ'
import * as Unit from './Unit'

const builtins = new Set<string>([
    'bool_t',
    'i8',
    'i16',
    'i32',
    'u8',
    'u16',
    'u32',
])

export function make(type: Ts.TypeNode): string {
    const txt = type.getText(Targ.context().ud.sf)
    if (builtins.has(txt)) return `em::${txt}`
    let res = ""
    if (Ts.isTypeReferenceNode(type)) {
        res = txt.replaceAll('.', '::')
    }
    else if (Ts.isTypeQueryNode(type)) {
        res = txt.replaceAll('.', '::')
    }
    else if (type.kind === Ts.SyntaxKind.VoidKeyword) {
        res = 'void'
    }
    else {
        Ast.fail('Type', type)
    }
    return res
}