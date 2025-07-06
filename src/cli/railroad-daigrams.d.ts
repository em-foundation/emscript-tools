declare module '@prantlf/railroad-diagrams' {

    export class Node {
    }

    export class Diagram implements Node {
        constructor(...items: Node[])
        format(paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): this
        toString(): string
        toStandalone(): string
    }

    export class ComplexDiagram implements Node {
        constructor(...items: Node[])
    }

    export class Sequence implements Node {
        constructor(...items: Node[])
    }

    export class Choice implements Node {
        constructor(normalIndex: number, ...items: Node[])
    }

    export class Optional implements Node {
        constructor(item: Node, skip?: 'skip')
    }

    export class ZeroOrMore {
        constructor(item: Node, rep?: any, skip?: any)
    }

    export class OneOrMore implements Node {
        constructor(item: Node, rep?: any)
    }

    export class Stack implements Node {
        constructor(...items: Node[])
    }

    export class HorizontalChoice implements Node {
        constructor(...items: Node[])
    }

    export class VerticalSequence implements Node {
        constructor(...items: Node[])
    }

    export class Group implements Node {
        constructor(item: Node, label?: string)
    }

    export class Terminal implements Node {
        constructor(text: string)
    }

    export class NonTerminal implements Node {
        constructor(text: string, { href: string, title: string } = {})
    }

    export class Comment implements Node {
        constructor(text: string, { href: string, title: string } = {})
    }

    export class Skip implements Node { }

    const defaultExport: {
        Node: typeof Node
        Diagram: typeof Diagram
        ComplexDiagram: typeof ComplexDiagram
        Sequence: typeof Sequence
        Choice: typeof Choice
        Optional: typeof Optional
        ZeroOrMore: typeof ZeroOrMore
        OneOrMore: typeof OneOrMore
        Stack: typeof Stack
        HorizontalChoice: typeof HorizontalChoice
        VerticalSequence: typeof VerticalSequence
        Group: typeof Group
        Terminal: typeof Terminal
        NonTerminal: typeof NonTerminal
        Comment: typeof Comment
        Skip: typeof Skip
    }

    export default defaultExport
}
