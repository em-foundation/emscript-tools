import * as Ts from 'typescript'

export function fail(kind: string, node: Ts.Node) {
    console.log(`*** unknown ${kind}`)
    printTree(node)
    process.exit(1)
}

export function findNamespace(sf: Ts.SourceFile, name: string): Ts.ModuleBlock | null {
    for (let stmt of sf.statements) {
        if (Ts.isModuleDeclaration(stmt) && stmt.name.text == name) {
            if (stmt.body) return stmt.body as Ts.ModuleBlock
        }
    }
    return null
}

export function getTypeExpr(tc: Ts.TypeChecker, node: Ts.Node): string {
    return tc.typeToString(tc.getTypeAtLocation(node));
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

export function printTypedTree(node: Ts.Node, tc: Ts.TypeChecker, indent: string = ''): void {
    const kindName = Ts.SyntaxKind[node.kind]
    let typeInfo = ''
    if (Ts.isExpression(node) || Ts.isTypeNode(node) || Ts.isIdentifier(node)) {
        const type = tc.getTypeAtLocation(node)
        if (type) {
            const typeString = tc.typeToString(type)
            typeInfo += ` [type: ${typeString}]`
        }
    }
    if (Ts.isIdentifier(node)) {
        const symbol = tc.getSymbolAtLocation(node)
        if (symbol) {
            typeInfo += ` [symbol: ${symbol.name}]`
        }
    }
    console.log(`${indent}${kindName}: ${node.getText()}${typeInfo}`)
    Ts.forEachChild(node, (childNode) =>
        printTypedTree(childNode, tc, indent + '  ')
    )
}

