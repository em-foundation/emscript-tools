declare module '@prantlf/railroad-diagrams' {

    export let Options = {
        DEBUG: false,
        VS: 8,
        AR: 10,
        DIAGRAM_CLASS: 'railroad-diagram',
        STROKE_ODD_PIXEL_LENGTH: true,
        INTERNAL_ALIGNMENT: 'center',
        CHAR_WIDTH: 8.5,
        COMMENT_CHAR_WIDTH: 7,
    };

    export class Node {
    }

    export class Diagram extends Node {
        constructor(...items: Node[])
        format(paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): this
        toString(): string
        toStandalone(): string
    }

    export class ComplexDiagram extends Diagram {
        constructor(...items: Node[])
    }

    export class Sequence extends Node {
        constructor(...items: Node[])
    }

    export class Choice extends Node {
        constructor(normalIndex: number, ...items: Node[])
    }

    export class Optional extends Node {
        constructor(item: Node, skip?: 'skip')
    }

    export class ZeroOrMore {
        constructor(item: Node, rep?: any, skip?: any)
    }

    export class OneOrMore extends Node {
        constructor(item: Node, rep?: any)
    }

    export class Stack extends Node {
        constructor(...items: Node[])
    }

    export class HorizontalChoice extends Node {
        constructor(...items: Node[])
    }

    export class VerticalSequence extends Node {
        constructor(...items: Node[])
    }

    export class Group extends Node {
        constructor(item: Node, label?: string)
    }

    export class Terminal extends Node {
        constructor(text: string)
    }

    export class NonTerminal extends Node {
        constructor(text: string, { href: string, title: string } = {})
    }

    export class Comment extends Node {
        constructor(text: string, { href: string, title: string } = {})
    }

    export class Skip extends Node { }

    const defaultExport: {
        Options: typeof Options
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
