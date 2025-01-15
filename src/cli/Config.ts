import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Err from './Err'
import * as Expr from './Expr'
import * as Out from './Out'
import * as Session from './Session'
import * as Targ from './Targ'
import * as Type from './Type'

export type Kind = 'NONE' | 'ARRAY_P' | 'ARRAY_V' | 'FACTORY' | 'PARAM' | 'PROXY' | 'TABLE'

export function genArrayProto(decl: Ts.VariableDeclaration, dn: string) {
    if (!Targ.isHdr()) return
    const cobj = getObj(dn)
    const len = cobj.$len
    const ts = cobj.$base.$cname
    Out.addText(`
    struct ${dn} {
        static constexpr em::u16 $len = ${len};
        static ${dn} $make() { return ${dn}(); }
        ${ts} items[${len}] = {0};
        ${ts} &operator[](em::u16 index) { return items[index]; }
        const ${ts} &operator[](em::u16 index) const { return items[index]; }
        em::frame_t<${ts}> $frame(em::i16 beg, em::u16 len = 0) { return em::frame_t<${ts}>::create(items, ${len}, beg, len); }
        operator em::frame_t<${ts}>() { return $frame(0, 0); }
        operator em::index_t<${ts}>() { return em::index_t<${ts}>(&items[0]); }
        em::ptr_t<${ts}> $ptr() { return em::ptr_t<${ts}>(&items[0]); }
        struct Iter {
            ${ts} *ptr_;
            Iter(${ts} *ptr) : ptr_(ptr) {}
            ${ts} &operator*() { return *ptr_; }
            Iter &operator++() { ++ptr_; return *this; }
            bool operator==(const Iter &other) const { return ptr_ == other.ptr_; }
            bool operator!=(const Iter &other) const { return ptr_ != other.ptr_; }
        };
        Iter begin() { return Iter(&items[0]); }
        Iter end() { return Iter(&items[5]); }
    };
`)
}

export function genArrayVal(decl: Ts.VariableDeclaration, dn: string) {
    if (!Targ.isHdr()) return
    Ast.printTree(decl)
    Out.print("%t// %1\n", dn)
}

export function genFactory(decl: Ts.VariableDeclaration, dn: string) {
    const cobj = getObj(dn)
    const es = Targ.isHdr() ? 'extern ' : ''
    const len = cobj.elems.length
    const tname = `${cobj.proto.constructor?.em$metaData}::${cobj.proto.constructor?.name}`
    const ts = `em::factory<${tname}, ${len}>`
    Out.print("%t%1%2 %3", es, ts, dn)
    if (Targ.isMain()) {
        Out.print(" = {%+\n")
        for (let i = 0; i < len; i++) {
            Out.print("%t")
            printVal(cobj.elems[i])
            Out.print(",\n")
        }
        Out.print("%-%t}")
    }
    Out.print(";\n")
}

export function genParam(decl: Ts.VariableDeclaration, dn: string) {
    const cobj = getObj(dn)
    const call = decl.initializer! as Ts.CallExpression
    const cs = Targ.isHdr() ? 'extern const ' : 'const '
    const ts = `em::param<${Type.make(call.typeArguments![0])}>`
    const init = Targ.isMain() ? ` = ${String(cobj.val)}` : ''
    Out.print("%t%1%2 %3%4;\n", cs, ts, dn, init)
}

export function genTable(decl: Ts.VariableDeclaration, dn: string) {
    const cobj = getObj(dn)
    const acc = cobj.access
    const es = Targ.isHdr() ? 'extern ' : ''
    const cs = acc == 'ro' ? 'const ' : ''
    const len = cobj.elems.length
    const call = decl.initializer! as Ts.CallExpression
    const ts = `em::table_${acc}<${Type.make(call.typeArguments![0])}, ${len}>`
    Out.print("%t%1%2%3 %4", es, cs, ts, dn)
    if (Targ.isMain()) {
        Out.print(" = {%+\n")
        for (let i = 0; i < len; i++) {
            Out.print("%t")
            printVal(cobj.elems[i])
            Out.print(",\n")
        }
        Out.print("%-%t}")
    }
    Out.print(";\n")
}

export function getKind(node: Ts.Node): Kind {
    const te = Ast.getTypeExpr(Targ.context().ud.tc, node)
    if (te.startsWith('em$ArrayProto')) return 'ARRAY_P'
    // if (te.startsWith('em$ArrayVal')) return 'ARRAY_V'
    if (te.startsWith('factory_t<')) return 'FACTORY'
    if (te.startsWith('em$param_t')) return 'PARAM'
    if (te.startsWith('em$proxy_t')) return 'PROXY'
    if (te.startsWith('table_t<')) return 'TABLE'
    return 'NONE'
}

function getObj(name: string): any {
    const $$units = Session.getUnits()
    const uobj = $$units.get(Targ.context().ud.id)!
    let cobj = uobj[name]
    if (!cobj) cobj = uobj.em$decls[name]
    if (!cobj) Err.fail(`no object corresponding to '${name}'`)
    return cobj
}

function printVal(val: any) {
    if (typeof val === 'number') {
        Out.print("%1", val)
    }
    else if (typeof val === 'object' && val?.constructor?.name === 'em$text_t') {
        Out.print("%1", Expr.mkTextVal(val.str))
    }
    else if (typeof val === 'object' && val.constructor?.em$metaData) {
        Out.print("%1::%2({\n%+", val.constructor?.em$metaData, val.constructor?.name)
        for (let p in val) {
            Out.print("%t.%1 = ", p)
            printVal(val[p])
            Out.print(",\n")
        }
        Out.print("%-%t})")
    }
    else {
        Out.print("<<UNKNOWN VALUE>>")
    }
}
