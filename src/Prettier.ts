import * as ChildProc from 'child_process'
import * as Path from 'path'
import * as Fs from 'fs'

import Prty from 'prettier'

import * as Session from './Session'

export async function exec(upath: string) {
    // const opts: Prty.Options = {
    //     parser: 'typescript',
    //     semi: false,
    //     singleQuote: true,
    //     tabWidth: 4,
    // }
    // const src = await Prty.format(Fs.readFileSync(upath, 'utf-8'))

    const args = ['prettier', upath]
    const proc = ChildProc.spawnSync('npx', args, {
        shell: Session.getShellPath(),
    })
    console.log(String(proc.error))
    console.log(String(proc.stdout))
}

/*
{
    "semi": false,
    "tabWidth": 4,
    "useEditorConfig": false,
    "singleQuote": true
}
*/

/*
import { createRequire } from "module"
const require = createRequire(import.meta.url)

async function formatCode() {
    const prettier = await import("prettier")
    const code = `const x=  1;console.log(x);`

    const formatted = prettier.format(code, {
        parser: "typescript",
        semi: false,
        singleQuote: true
    })

    console.log(formatted)
}
*/
