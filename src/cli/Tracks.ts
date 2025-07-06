import Fs from 'fs'
import He from 'he'
import Path from 'path'
import Rd from '@prantlf/railroad-diagrams'

type RN = typeof Rd.Node

const $ch = (...items: RN[]) => new Rd.Choice(0, ...items)
const $cf = (text: string, kind: any) => new Rd.Comment(text, { title: kind ?? 'x' })
const $cn = (idx: number, ...items: RN[]) => new Rd.Choice(idx, ...items)
const $co = (text: string) => new Rd.Comment(text)
const $cd = (...items: RN[]) => new Rd.ComplexDiagram(...items)
const $dg = (...items: RN[]) => new Rd.Diagram(...items)
const $gr = (item: RN, label?: string) => new Rd.Group(item, label)
const $hc = (...items: RN[]) => new Rd.HorizontalChoice(...items)
const $nt = (text: string, title: string) => new Rd.NonTerminal(text, { title: title, href: `#${text.trim()}` })
const $om = (item: RN, rep?: any) => new Rd.OneOrMore(item, rep)
const $op = (item: RN) => new Rd.Optional(item, 'skip')
const $sk = () => new Rd.Skip()
const $sq = (...items: RN[]) => new Rd.Sequence(...items)
const $st = (...items: RN[]) => new Rd.Stack(...items)
const $tn = (text: string) => new Rd.Terminal(text)
const $vs = (...items: RN[]) => new Rd.VerticalSequence(...items)
const $zm = (item: RN, rep?: any, skip?: any) => new Rd.ZeroOrMore(item, rep, skip)

export function generate() {
    console.log(Rd)
}
