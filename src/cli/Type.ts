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
    'ptr_t',
    'u8',
    'u16',
    'u32',
    'text_t',
    'volatile_t'
])

export function make(type: Ts.TypeNode): string {
    let res = ""
    if (Ts.isTypeReferenceNode(type)) {
        let tn = type.typeName.getText(Targ.context().ud.sf)
        if (builtins.has(tn)) tn = `em.${tn}`
        res = tn.replaceAll('.', '::') + makeArgs(type.typeArguments)
    }
    // else if (Ts.isTypeQueryNode(type)) {
    //     console.log(txt)
    //     res = txt.replaceAll('.', '::')
    // }
    else if (type.kind === Ts.SyntaxKind.VoidKeyword) {
        res = 'void'
    }
    else {
        Ast.fail('Type', type)
    }
    return res
}

function makeArgs(args: Ts.NodeArray<Ts.TypeNode> | undefined): string {
    if (!args) return ''
    let res = '<'
    let sep = ''
    args.forEach(a => {
        res += `${sep}${make(a)}`
        sep = ', '
    })
    return res + '>'

}