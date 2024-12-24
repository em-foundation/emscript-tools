import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Config from './Config'
import * as Expr from './Expr'
import * as Out from './Out'
import * as Stmt from './Stmt'
import * as Targ from './Targ'
import * as Type from './Type'

export function generate(decl: Ts.Declaration) {
    const isHdr = Targ.context().gen == 'HEADER'
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
            case 'PARAM':
                Config.genParam(decl, dn)
                return
            case 'PROXY':
                return
        }
        const cs = ((decl.parent.flags & Ts.NodeFlags.Const) == 0) ? '' : 'static const '
        const ts = decl.type ? Type.make(decl.type) : 'auto'
        const init = decl.initializer ? ` = ${Expr.make(decl.initializer)}` : ''
        Out.print("%t%1%2 %3%4;\n", cs, ts, dn, init)
    }
    else if (Ts.isParameter(decl)) {
        const pn = (decl.name as Ts.Identifier).text
        const ts = decl.type ? Type.make(decl.type) : 'auto'
        const init = decl.initializer && isHdr ? ` = ${Expr.make(decl.initializer)}` : ''
        Out.print("%1 %2%3", ts, pn, init)
    }
    else if (Ts.isFunctionDeclaration(decl)) {
        const isHdr = (Targ.context().gen == 'HEADER')
        const es = isHdr ? 'extern ' : ''
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
        if (isHdr) {
            Out.addText(';\n')
            return
        }
        Out.print(' {\n%+')
        if (decl.body) {
            decl.body.statements.forEach(stmt => Stmt.generate(stmt))
        }
        Out.print('%-%t}\n')
    }
    else {
        Ast.fail('Decl', decl)
    }
}

function mkDelegate(decl: Ts.VariableDeclaration): string {
    return ''
}

export function makeVarDecl(decl: Ts.VariableDeclaration): string {
    const dn = (decl.name as Ts.Identifier).text
    const ts = decl.type ? Type.make(decl.type) : 'auto'
    const init = Expr.make(decl.initializer!)
    return `${ts} ${dn} = ${init}`
}
