import * as Fs from 'fs'

const TAB = 4

class Obj {
    col: number
    text: Array<string>
    constructor(readonly path: string) {
        this.col = 0
        this.path = path
        this.text = []
    }
}

const NULL_OBJ: Obj = new Obj("")

var sCur: Obj = NULL_OBJ

export function addFile(path: string) {
    addText(String(Fs.readFileSync(path)))
}

export function addText(...text: string[]) {
    text.forEach(t => sCur.text.push(t))
}

export function clearText(): string {
    let res = getText()
    sCur.col = 0
    sCur.text = []
    return res
}

export function close() {
    sCur.path && Fs.writeFileSync(sCur.path, getText())
    sCur = NULL_OBJ
}

export function genTitle(msg: string) {
    print("\n// -------- %1 -------- //\n\n", msg)
}

export function getText(): string {
    return sCur.text.join('')
}

export function open(path: string) {
    let k = path ? path.lastIndexOf('/') : -1
    if (k < 0) throw new Error("bad path")
    Fs.mkdirSync(path.substring(0, k), {recursive: true})
    sCur = new Obj(path)
 }

export function print(fmt: string, a0?: any, a1?: any, a2?: any, a3?: any) {
    if (sCur.path == null) return
    let res = ""
    let idx = 0
    while (idx < fmt.length) {
        const c = fmt.charAt(idx++)
        if (c != '%') {
            res += c
            continue
        }
        switch (fmt.charAt(idx++)) {
        case '%':
            res += '%'
            continue
        case 't':
            res += ' '.repeat(sCur.col)
            continue
        case '+':
            sCur.col += TAB
            continue
        case '-':
            sCur.col && (sCur.col -= TAB)
            continue
        case '1':
            res += a0
            continue
        case '2':
            res += a1
            continue
        case '3':
            res += a2
            continue
        case '4':
            res += a3
            continue
        }
    }
    addText(res)
}

