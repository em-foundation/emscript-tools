import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Config from './Config'
import * as Expr from './Expr'
import * as Out from './Out'
import * as Stmt from './Stmt'
import * as Targ from './Targ'
import * as Type from './Type'

export function generate(decl: Ts.Declaration) {
    if (Targ.isMain() && !Ts.isVariableDeclaration(decl)) return
    if (Ts.isImportDeclaration(decl) || Ts.isModuleDeclaration(decl) || Ts.isInterfaceDeclaration(decl)) {
        // handled elsewhere
    }
    else if (Ts.isTypeAliasDeclaration(decl)) {
        Out.print("%ttypedef %1;\n", Type.make(decl.type, (decl.name as Ts.Identifier).text))
    }
    else if (Ts.isVariableDeclaration(decl)) {
        const txt = decl.getText(Targ.context().ud.sf)
        if (txt.indexOf('$clone') != -1) return
        if (txt.indexOf('$delegate') != -1) return
        const dn = (decl.name as Ts.Identifier).text
        if (dn == '$U') return
        switch (Config.getKind(decl.name)) {
            case 'CONFIG':
                Config.genConfig(decl, dn)
                return
            case 'PROXY':
                return
            case 'TABLE':
                Config.genTable(decl, dn)
                return
        }
        if (Targ.isMain()) return
        const cs = ((decl.parent.flags & Ts.NodeFlags.Const) == 0) ? '' : 'const '
        const ts = decl.type ? Type.make(decl.type) : 'auto'
        const init = decl.initializer ? ` = ${Expr.make(decl.initializer)}` : ''
        Out.print("%t%1%2 %3%4;\n", cs, ts, dn, init)
    }
    else if (Ts.isParameter(decl)) {
        const pn = (decl.name as Ts.Identifier).text
        const ts = decl.type ? Type.make(decl.type) : 'auto'
        const init = decl.initializer && Targ.isHdr() ? ` = ${Expr.make(decl.initializer)}` : ''
        Out.print("%1 %2%3", ts, pn, init)
    }
    else if (Ts.isFunctionDeclaration(decl)) {
        const name = decl.name!.text
        const es = name.endsWith('$$') ? 'extern "C" ' : Targ.isHdr() ? 'static ' : ''
        const ts = (decl.type) ? Type.make(decl.type) : 'void'
        Out.print("%t%1%2 %3(", es, ts, name)
        genParameters([...decl.parameters])
        Out.addText(')')
        if (Targ.isHdr()) {
            Out.addText(';\n')
            return
        }
        Out.print(' {\n%+')
        if (decl.body) {
            decl.body.statements.forEach(stmt => Stmt.generate(stmt))
        }
        Out.print('%-%t}\n')
    }
    else if (Ts.isEnumDeclaration(decl)) {
        Out.print("%tenum %1: em::u8 {\n%+%t", decl.name!.text)
        decl.members.forEach(e => Out.addText(`${e.getText(Targ.context().ud.sf)}, `))
        Out.print("\n%-%t};\n")
    }
    else if (Ts.isClassDeclaration(decl)) {
        if (isVectorDecl(decl)) {
            genVector(decl, decl.heritageClauses![0])
        }
    }
    else if (Ts.isPropertyDeclaration(decl)) {
        const pn = (decl.name as Ts.Identifier).text
        const ts = Type.make(decl.type!)
        const init = decl.initializer ? ` = ${Expr.make(decl.initializer)}` : ''
        Out.print("%t%1 %2%3;\n", ts, pn, init)
    }
    else {
        Ast.fail('Decl', decl)
    }
}

export function genParameters(params: Array<Ts.ParameterDeclaration>) {
    let sep = ''
    params.forEach(par => {
        Out.addText(sep)
        generate(par)
        sep = ', '
    })
}

function genHeritage(decl: Ts.ClassDeclaration, ext: Ts.HeritageClause) {
    const m = ext.getText(Targ.context().ud.sf).match(/^extends (\$\w+)/)
    if (m) {
        switch (m[1]) {
            case '$vector':
                genVector(decl, ext)
                break
        }
    }
}

function genVector(decl: Ts.ClassDeclaration, ext: Ts.HeritageClause) {
    const ns = decl.name!.text
    const et = Type.make(ext.types[0].typeArguments![0])
    let ls = '0'
    for (const e of decl.members) {
        if (Ts.isPropertyDeclaration(e) && e.name.getText(Targ.context().ud.sf) == '$len') {
            ls = Expr.make(e.initializer!)
            break
        }
    }
    Out.print("%ttypedef em::vec_t<%1, %2> %3;\n", et, ls, ns)
}

export function isAggDecl(node: Ts.ClassDeclaration, kind: string): boolean {
    if (!node.heritageClauses) return false
    return node.heritageClauses[0].getText(Targ.context().ud.sf).startsWith(`extends $${kind}`)
}

export function isStructDecl(node: Ts.ClassDeclaration): boolean {
    return isAggDecl(node, 'struct')
}

export function isVectorDecl(node: Ts.ClassDeclaration): boolean {
    return isAggDecl(node, 'vector')
}

export function makeVarDecl(decl: Ts.VariableDeclaration, rs: string): string {
    const dn = (decl.name as Ts.Identifier).text
    const ts = decl.type ? Type.make(decl.type) : 'auto'
    const init = decl.initializer ? ` = ${Expr.make(decl.initializer)}` : ''
    return `${ts}${rs} ${dn}${init}`
}
