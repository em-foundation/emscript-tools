import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Expr from './Expr'
import * as Out from './Out'
import * as Stmt from './Stmt'
import * as Targ from './Targ'
import * as Type from './Type'

export function generate(decl: Ts.Declaration) {
    const isHdr = Targ.context().gen == 'HEADER'
    if (Ts.isTypeAliasDeclaration(decl)) {
        Out.print("%ttypedef %1 %2;\n", Type.make(decl.type), (decl.name as Ts.Identifier).text)
    }
    else if (Ts.isVariableDeclaration(decl)) {
        const cs = ((decl.parent.flags & Ts.NodeFlags.Const) == 0) ? '' : isHdr ? 'static const ' : 'const '
        const dn = (decl.name as Ts.Identifier).text
        const ts = decl.type ? Type.make(decl.type) : 'auto'
        const init = decl.initializer ? ` = ${Expr.make(decl.initializer)}` : ''
        Out.print("%t%1%2 %3%4;\n", cs, ts, dn, init)
    }
    else if (Ts.isFunctionDeclaration(decl)) {
        const isHdr = (Targ.context().gen == 'HEADER')
        const es = isHdr ? 'extern ' : ''
        const ts = (decl.type) ? Type.make(decl.type) : 'void'
        const name = decl.name!.text
        Out.print("%t%1%2 %3(", es, ts, name)
        decl.parameters.forEach(par => generate(par))
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
