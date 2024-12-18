import * as Ts from 'typescript'

export function findNamespace(sf: Ts.SourceFile, name: string): Ts.ModuleBlock | null {
    for (let stmt of sf.statements) {
        if (Ts.isModuleDeclaration(stmt) && stmt.name.text == name) {
            if (stmt.body) return stmt.body as Ts.ModuleBlock
        }
    }
    return null
}

export function printChildren(node: Ts.Node, indent: string = '  '): void {
    node.forEachChild(child => console.log(`${indent}${Ts.SyntaxKind[child.kind]}`))
}

export function printTree(node: Ts.Node | null, indent: string = ''): void {
    if (node) {
        console.log(`${indent}${Ts.SyntaxKind[node.kind]}${node.kind === Ts.SyntaxKind.Identifier ? ': ' + (node as Ts.Identifier).text : ''}`)
        Ts.forEachChild(node, (childNode) => {
            printTree(childNode, indent + '    ')
        })
    }
    else {
        console.log(`${indent}<null>`)
    }
}
