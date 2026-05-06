import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Targ from './Targ'
import * as Unit from './Unit'

const builtins = new Set<string>([
    'arg_t',
    'bool_t',
    'const_t',
    'frame_t',
    'f32',
    'index_t',
    'i8',
    'i16',
    'i32',
    'i64',
    'opaq_t',
    'ptr_t',
    'ref_t',
    'u8',
    'u16',
    'u32',
    'u64',
    'text_t',
    'vec_t',
    'volatile_t'
])

export const UNKNOWN = '<<UNKNOWN>>'

export function isVoid(type: Ts.TypeNode): boolean {
    return type.kind === Ts.SyntaxKind.VoidKeyword
}

export function make(type: Ts.TypeNode, tdef?: string, sf?: Ts.SourceFile): string {
    let res = ""
    sf = sf ?? Targ.context().ud.sf
    if (Ts.isTypeReferenceNode(type)) {
        let tn = type.typeName.getText(sf)
        if (tn == 'cb_t') {
            res = makeCb(type.typeArguments![0] as Ts.TupleTypeNode, type.typeArguments![1], tdef!)
        }
        else {
            if (builtins.has(tn)) tn = `em.${tn}`
            if (tn == 'eref_t') tn = 'em.ref_t'
            if (tn == '$$') tn = 'em.ref_t'         // TODO: generalize
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
    else if (isVoid(type)) {
        res = 'void'
    }
    else if (type.kind === Ts.SyntaxKind.UnknownKeyword) {
        res = UNKNOWN
    }
    else if (type.kind === Ts.SyntaxKind.LiteralType) {
        return type.getText(sf)
    }
    else {
        console.log(type.getText(sf))
        console.log(type.kind)
        Ast.fail('Type', type)
    }
    return res
}

function makeCb(args: Ts.TupleTypeNode, ret: Ts.TypeNode | undefined, tdef: string): string {
    const rt = ret ? make(ret) : 'void'
    let res = `${rt} (*${tdef})(`
    let sep = ''
    args.elements.forEach(a => {
        const t = Ts.isNamedTupleMember(a) ? a.type : a
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