import * as Ts from 'typescript'
import * as Vsc from 'vscode'

export class Provider implements Vsc.DocumentSemanticTokensProvider {
    provideDocumentSemanticTokens(doc: Vsc.TextDocument): Vsc.ProviderResult<Vsc.SemanticTokens> {
        const sf = Ts.createSourceFile(
            doc.fileName,
            doc.getText(),
            Ts.ScriptTarget.Latest,
            /*setParentNodes*/ true
        );
        const builder = new Vsc.SemanticTokensBuilder(legend())
        const visitNode = (node: Ts.Node): void => {
            if (Ts.isIdentifier(node)) {
                const name = node.text
                let tokType = ''
                if (name === 'em') tokType = 'em-ident'
                else if (name === 'em$clone') tokType = 'em-special'
                else if (name.match(/^em\$(meta|targ|template)$/)) tokType = 'em-domain'
                else if (name.match(/^em\$_[CTU]$/)) tokType = 'em-special'
                else if (name.match(/^em\$[a-z]/)) tokType = 'em-special'
                if (tokType) {
                    const start = doc.positionAt(node.getStart())
                    const end = doc.positionAt(node.getEnd())
                    builder.push(
                        new Vsc.Range(start, end),
                        tokType
                    )
                }
            }
            Ts.forEachChild(node, visitNode);
        }
        Ts.forEachChild(sf, visitNode)
        return builder.build()
    }
}

export function legend(): Vsc.SemanticTokensLegend {
    return new Vsc.SemanticTokensLegend(['em-ident', 'em-domain', 'em-special'], []);
}