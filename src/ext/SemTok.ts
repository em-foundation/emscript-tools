import * as Vsc from 'vscode'

export class Provider implements Vsc.DocumentSemanticTokensProvider {
    provideDocumentSemanticTokens(doc: Vsc.TextDocument): Vsc.ProviderResult<Vsc.SemanticTokens> {
        console.log('*** SemTok')
        const builder = new Vsc.SemanticTokensBuilder(legend());
        const pattern = /\b(em|em\$\w*)\b/g;
        for (let line = 0; line < doc.lineCount; line++) {
            const lineText = doc.lineAt(line).text;
            let match;
            while ((match = pattern.exec(lineText)) !== null) {
                const start = match.index;
                const length = match[0].length;
                builder.push(
                    new Vsc.Range(line, start, line, start + length),
                    'em-token'
                );
            }
        }
        return builder.build();
    }
}

export function legend(): Vsc.SemanticTokensLegend {
    return new Vsc.SemanticTokensLegend(['em-token'], []);
}