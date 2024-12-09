import * as Path from 'path'
import * as Ts from 'typescript'

let unitTab = new Map<string, UnitDesc>()

export type UnitKind = 'MODULE' | 'INTERFACE' | 'COMPOSITE' | 'TEMPLATE'

class UnitDesc {
    private impTab = new Map<string, string>
    constructor(readonly id: string, readonly kind: UnitKind, readonly sf: Ts.SourceFile) { }
    addImport(impName: string, impUnit: string) { this.impTab.set(impName, impUnit) }
    get imports(): ReadonlyMap<string, string> { return this.impTab }
}

export function create(sf: Ts.SourceFile): UnitDesc {
    const m = sf.getText(sf).match(/em\.declare.*\(['"](\w+)['"]\)/)
    const uk = (m ? m[1] : 'MODULE') as UnitKind
    const impTab = new Map<string, string>()
    const unit = new UnitDesc(mkUid(sf.fileName), uk, sf)
    sf.statements.map(stmt => {
        if (Ts.isImportDeclaration(stmt)) {
            const iuMatch = stmt.moduleSpecifier.getText(sf).match(/^['"]@(.+)\.em['"]$/)
            if (!iuMatch) return
            const inMatch = stmt.importClause!.getText(sf).match(/\W*(\w+)$/)
            unit.addImport(inMatch![1], iuMatch[1])
        }
    })
    unitTab.set(unit.id, unit)
    return unit
}

function mkUid(upath: string): string {
    return `${Path.basename(Path.dirname(upath))}/${Path.basename(upath, '.em.ts')}`
}

export function units(): ReadonlyMap<string, UnitDesc> {
    return unitTab
}