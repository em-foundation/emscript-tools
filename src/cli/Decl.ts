import * as Ts from 'typescript'

import * as Ast from './Ast'
import * as Out from './Out'
import * as Type from './Type'
import * as Unit from './Unit'

export function generate(decl: Ts.Declaration, ud: Unit.Desc) {
    if (Ts.isTypeAliasDeclaration(decl)) {
        Out.print("%ttypedef %1 %2;\n", Type.make(decl.type, ud), (decl.name as Ts.Identifier).text)
    }
    else if (Ts.isVariableDeclaration(decl)) {
        Out.print("%t%1 %2;\n", Type.make(decl.type!, ud), (decl.name as Ts.Identifier).text)
    }
    else {
        Ast.fail('Decl', decl)
    }
}
