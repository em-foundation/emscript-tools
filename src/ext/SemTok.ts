import * as Ts from 'typescript'
import * as Vsc from 'vscode'

import * as Ast from '../cli/Ast'

function addTok(doc: Vsc.TextDocument, builder: Vsc.SemanticTokensBuilder, node: Ts.Node, tokType: string) {
    const start = doc.positionAt(node.getStart())
    const end = doc.positionAt(node.getEnd())
    builder.push(new Vsc.Range(start, end), tokType)
}

function isFirst(node: Ts.Identifier, sf: Ts.SourceFile): boolean {
    const parent = node.parent
    if (!Ts.isPropertyAccessExpression(parent)) return true
    if (!parent.getText(sf).startsWith(`${node.text}.`)) return false
    return true
}

export class Provider implements Vsc.DocumentSemanticTokensProvider {
    provideDocumentSemanticTokens(doc: Vsc.TextDocument): Vsc.ProviderResult<Vsc.SemanticTokens> {
        const sf = Ts.createSourceFile(
            doc.fileName,
            doc.getText(),
            Ts.ScriptTarget.Latest,
            /*setParentNodes*/ true
        );
        const builder = new Vsc.SemanticTokensBuilder(legend())
        const unitSet = new Set<string>()
        sf.statements.map((stmt) => {
            if (Ts.isImportDeclaration(stmt)) {
                const modSpecNode = stmt.moduleSpecifier
                if (Ts.isStringLiteral(modSpecNode)) {
                    let modSpec = modSpecNode.text
                    const iuMatch = modSpec.match(/^@(.+)\.em$/)
                    if (iuMatch) {
                        const inMatch = stmt.importClause!.getText(sf).match(/\W*(\w+)$/)
                        unitSet.add(inMatch![1])
                    }
                }
            }
            else if (Ts.isVariableStatement(stmt)) {
                const dtxt = stmt.declarationList.declarations[0].getText(sf)
                const mc = dtxt.match(/^(\w+)\W+\$clone\((\w+)\)$/)
                if (mc) {
                    unitSet.add(mc[1])
                    return
                }
                const md = dtxt.match(/^(\w+)\W+\$delegate\(.*\)$/)
                if (md) {
                    unitSet.add(md[1])
                    return
                }
            }

        })
        const visitNode = (node: Ts.Node): void => {
            if (Ts.isIdentifier(node)) {
                const name = node.text
                let tokType = ''
                if (name === 'em') tokType = 'em-ident'
                else if (name === '$$') tokType = 'em-deref'
                else if (unitSet.has(name) && isFirst(node, sf)) tokType = 'em-unit'
                else if (name.startsWith('$')) tokType = 'em-special'
                else if (name.match(/^em\$(meta|targ|template)$/)) tokType = 'em-domain'
                else if (name.match(/^em\$_[CDIRTU]$/)) tokType = 'em-special'
                else if (name.match(/^em\$(configure|construct|fail|generate|halt|init|onexit|ready|reset|run|startup)/)) tokType = 'em-special'
                else if (name.match(/^fail|halt|printf$/)) tokType = 'em-debug'
                else if (name.match(/^[cet]\$/)) tokType = 'em-deref'
                else if (name.match(/^em\$/)) tokType = 'em-wrong'
                if (tokType) addTok(doc, builder, node, tokType)
            }
            else if (Ts.isElementAccessExpression(node)) {
                const txt = node.expression.getText(sf)
                if (txt != 'em.$') {
                    Ts.forEachChild(node, visitNode);
                    return
                }
                visitNode(node.expression)
                addTok(doc, builder, node.argumentExpression, 'em-debug')
            }
            else if (Ts.isPropertyAccessExpression(node)) {
                const txt = node.getText(sf)
                if (!txt.match(/^em\.(fail|halt|printf|\$reg)/)) {
                    Ts.forEachChild(node, visitNode);
                    return
                }
                addTok(doc, builder, node.expression, 'em-debug')
                addTok(doc, builder, node.name, 'em-debug')
            }
            else {
                Ts.forEachChild(node, visitNode);
            }
        }
        Ts.forEachChild(sf, visitNode)
        return builder.build()
    }
}

export function legend(): Vsc.SemanticTokensLegend {
    return new Vsc.SemanticTokensLegend(['em-debug', 'em-deref', 'em-domain', 'em-ident', 'em-special', 'em-unit', 'em-wrong'], []);
}