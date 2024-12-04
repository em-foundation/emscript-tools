import Fs from "fs";
import Path from "path";
import Vsc from "vscode";

import * as JSON5 from 'json5'

export function updateConfig(): void {
    const file = Path.join(rootPath(), 'tsconfig.json')
    const json = JSON5.parse(Fs.readFileSync(file, 'utf-8'))
    json.compilerOptions.paths = {"@EM-SCRIPT": ["./workspace/em.core/em.lang/em-script"]}
    let wdir = workPath()
    Fs.readdirSync(wdir).forEach(f1 => {
        let ppath = Path.join(wdir, f1);
        if (isPackage(ppath)) Fs.readdirSync(ppath).forEach(f2 => {
            let bpath = Path.join(ppath, f2);
            if (Fs.statSync(bpath).isDirectory()) {
                json.compilerOptions.paths[`@${f2}/*`] = [`./workspace/${f1}/${f2}/*`]
            }
        });
    });
    Fs.writeFileSync(file, JSON.stringify(json, null, 4), 'utf-8')
}

export function isPackage(path: string): boolean {
    if (!Fs.existsSync(path)) return false;
    if (!Fs.statSync(path).isDirectory()) return false;
    let ifile = Path.join(path, 'em-package.ini');
    if (!Fs.existsSync(ifile)) return false;
    return true;
}

export function mkBucketNames(): string[] {
    let res = new Array<string>();
    let wpath = workPath()
    Fs.readdirSync(wpath).forEach(f => {
        let ppath = Path.join(wpath, f);
        if (isPackage(ppath)) Fs.readdirSync(ppath).forEach(f => {
            let bpath = Path.join(ppath, f);
            if (Fs.statSync(bpath).isDirectory()) res.push(f);
        });
    });
    return res;
}

export function mkPackageNames(): string[] {
    let res = new Array<string>();
    let wpath = workPath()
    Fs.readdirSync(wpath).forEach(f => {
        if (isPackage(Path.join(wpath, f))) res.push(f);
    });
    return res;
}

export function rootPath(): string {
    return Vsc.workspace.workspaceFolders![0].uri.fsPath
}

export function workPath(): string {
    return Path.join(rootPath(), "workspace")
}
