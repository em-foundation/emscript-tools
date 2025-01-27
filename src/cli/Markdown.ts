import * as ChildProc from 'child_process'
import * as Fs from 'fs'
import * as Path from 'path'

import * as Err from './Err'
import * as Meta from './Meta'
import * as Out from './Out'
import * as Render from './Render'
import * as Session from './Session'
import * as Unit from './Unit'

export function generate(ppath: string, outdir: string) {
    const wdir = Session.getWorkDir()
    let pn = Path.basename(ppath)
    let dstdir = Path.resolve(outdir, pn)
    if (Fs.existsSync(dstdir)) Fs.rmSync(dstdir, { recursive: true })
    Fs.mkdirSync(dstdir, { recursive: true })
    let plines = Array<String>()
    plines.push("<script>document.querySelector('body').classList.add('em-content')</script>")
    plines.push(`# {[es,kr]package}&thinsp;{[fn]${pn}}`)
    Fs.writeFileSync(Path.join(dstdir, 'index.md'), plines.join('\n'))
    Out.clearText()
    Out.print("    - %1:\n", pn)
    Out.print("      - shelf/%1/index.md\n", pn)
    for (let bn of Fs.readdirSync(Path.join(wdir, ppath))) {
        let bdir = Path.join(wdir, ppath, bn)
        if (!Fs.lstatSync(bdir).isDirectory()) continue
        let first = true
        for (let uf of Fs.readdirSync(bdir)) {
            const m = uf.match(/^(.+)\.em\.ts$/)
            if (!m) continue
            if (first) {
                Fs.mkdirSync(Path.join(dstdir, bn))
                let blines = Array<String>()
                blines.push("<script>document.querySelector('body').classList.add('em-content')</script>")
                blines.push(`# {[es,kr]bundle}&thinsp;{[fn]${bn}}`)
                Fs.writeFileSync(Path.join(dstdir, bn, 'index.md'), blines.join('\n'))
                Out.print("      - %1:\n", bn)
                Out.print("        - shelf/%1/%2/index.md\n", pn, bn)
                first = false;
            }
            let un = m[1]
            let ulines = Array<String>()
            ulines.push("<script>document.querySelector('body').classList.add('em-content')</script>")
            plines.push(`# {[es,kr]unit}&thinsp;{[fn]${un}}`)
            let fence = '```'
            let uid = `${bn}/${un}`
            console.log(uid)
            ulines.push(`${fence}ems linenums="1" title="${uid}.em"`)
            let upath = `${pn}/${uid}.em.ts`
            Meta.parse(upath)
            const ud = Unit.units().get(uid!)!
            const src = Render.exec(ud)
            ulines.push(src)
            // const args = ['render', '-u', `${pn}/${bn}/${un}.em.ts`]
            // let proc = ChildProc.spawnSync('emscript', args, { cwd: Session.getWorkDir(), shell: Session.getShellPath() })
            // if (proc.status != 0) {
            //     console.log(String(proc.output))
            //     Err.fail(`rendering failed for unit '${uid}'`)
            // }
            // ulines.push(String(proc.stdout))
            ulines.push(fence)
            const fn = Path.join(dstdir, bn, `${un}.md`)
            Fs.writeFileSync(Path.join(dstdir, bn, `${un}.md`), ulines.join('\n'))
            Out.print("        - %3: shelf/%1/%2/%3.md\n", pn, bn, un)
        }
    }
    // let yfile = Path.join(outdir, '../../mkdocs.yml')
    // let mkdocs = String(Fs.readFileSync(yfile))
    // let re = RegExp(`(#-- ${pn}\\s)([\\s\\S]*?)(#--)`)
    // Fs.writeFileSync(yfile, mkdocs.replace(re, `$1${Out.getText()}$3`))

}
