import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Targ from './Targ'
import * as Unit from './Unit'

const builtins = new Set<string>([
    'arg_t',
    'bool_t',
    'frame_t',
    'index_t',
    'i8',
    'i16',
    'i32',
    'ptr_t',
    'ref_t',
    'u8',
    'u16',
    'u32',
    'text_t',
    'volatile_t'
])

export const UNKNOWN = '<<UNKNOWN>>'

export function make(type: Ts.TypeNode, tdef?: string): string {
    let res = ""
    if (Ts.isTypeReferenceNode(type)) {
        let tn = type.typeName.getText(Targ.context().ud.sf)
        if (tn == 'cb_t') {
            res = makeCb(type.typeArguments![0] as Ts.TupleTypeNode, tdef!)
        }
        else {
            if (builtins.has(tn)) tn = `em.${tn}`
            res = tn.replaceAll('.', '::') + makeTypeArgs(type.typeArguments)
            if (tdef) res += ` ${tdef}`
        }
    }
    // else if (Ts.isTypeQueryNode(type)) {
    //     console.log(txt)
    //     res = txt.replaceAll('.', '::')
    // }
    else if (Ts.isFunctionTypeNode(type)) {
        // using Comparator = std::function<int(const ref_t<std::string>&, const ref_t<std::string>&)>;
        let ret = make(type.type)
        let td = tdef ? tdef : ''
        res = `${ret} (*${td})${makeFxnParams(type.parameters)}`
    }
    else if (Ts.isTupleTypeNode(type)) {
        res = '()'
    }
    else if (type.kind === Ts.SyntaxKind.VoidKeyword) {
        res = 'void'
    }
    else if (type.kind === Ts.SyntaxKind.UnknownKeyword) {
        res = UNKNOWN
    }
    else {
        Ast.fail('Type', type)
    }
    return res
}

function makeCb(tup: Ts.TupleTypeNode, tdef: string): string {
    let res = `void (*${tdef})(`
    let sep = ''
    tup.elements.forEach(e => {
        let t = Ts.isNamedTupleMember(e) ? e.type : e
        res += `${sep}${make(t)}`
        sep = ', '
    })
    return res + ')'
}

function makeFxnParams(params: Ts.NodeArray<Ts.ParameterDeclaration>): string {
    let res = '('
    let sep = ''
    params.forEach(p => {
        res += `${sep}${make(p.type!)} ${(p.name as Ts.Identifier).text}`
        sep = ', '
    })
    return res + ')'
}

function makeTypeArgs(args: Ts.NodeArray<Ts.TypeNode> | undefined): string {
    if (!args) return ''
    let res = '<'
    let sep = ''
    args.forEach(a => {
        res += `${sep}${make(a)}`
        sep = ', '
    })
    return res + '>'
}

export function makeDefault(ts: string): string {
    console.log(ts)
    return '<<UNKNOWN>>'
}