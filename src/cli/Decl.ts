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
        Out.print("%ttypedef %1 %2;\n", Type.make(decl.type), (decl.name as Ts.Identifier).text)
    }
    else if (Ts.isVariableDeclaration(decl)) {
        const txt = decl.getText(Targ.context().ud.sf)
        if (txt.indexOf('em$clone') != -1) return
        const dn = (decl.name as Ts.Identifier).text
        if (dn == 'em$_U') return
        switch (Config.getKind(decl.name)) {
            case 'ARRAY_P':
                Config.genArrayProto(decl, dn)
                return
            case 'ARRAY_V':
                Config.genArrayVal(decl, dn)
                return
            case 'FACTORY':
                Config.genFactory(decl, dn)
                return
            case 'PARAM':
                Config.genParam(decl, dn)
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
        const es = Targ.isHdr() ? 'extern ' : ''
        const ts = (decl.type) ? Type.make(decl.type) : 'void'
        const name = decl.name!.text
        Out.print("%t%1%2 %3(", es, ts, name)
        let sep = ''
        decl.parameters.forEach(par => {
            Out.addText(sep)
            generate(par)
            sep = ', '
        })
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
    else if (Ts.isClassDeclaration(decl) && decl.heritageClauses) {
        // console.log(decl.heritageClauses[0].getText(Targ.context().ud.sf))
        const name = decl.name!.text
        Out.print("%tstruct %1 {\n%+", name)
        Out.print("%tstatic %1 $make() { return %1(); }\n", name)
        decl.members.forEach(e => generate(e))
        Out.print("%-%t};\n")
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

export function makeVarDecl(decl: Ts.VariableDeclaration, agg_type: string = ''): string {
    const dn = (decl.name as Ts.Identifier).text
    const ts = decl.type ? Type.make(decl.type) : 'auto'
    const init = decl.initializer ? ` = ${Expr.make(decl.initializer)}` : ''
    const ref = agg_type.startsWith('em$ArrayVal') ? '&' : ''
    return `${ts}${ref} ${dn}${init}`
}
