'use strict'

const Path = require('path')
const Fs = require('fs')
const Zip = require('adm-zip')

const HOME_DIR = Path.join(process.env['HOME'] ? process.env['HOME'] : process.env['USERPROFILE'])
let sdk_dir
for (let ch of ['', '.']) {
    let p = `${HOME_DIR}/${ch}em-sdk`
    if (Fs.existsSync(p)) {
        sdk_dir = p
        break
    }
}
if (!sdk_dir) throw '*** <<EM-SDK>> folder not found ***'

const DIST_DIR = 'dist'
const TOOLS_DIR = Path.join(sdk_dir, 'tools')
const TARG_DIR = Path.join(TOOLS_DIR, '@NAME')

const PRE = /^(VERSION)|(LICENSE)/

const PLAT_ARCH = `${process.platform}-${process.arch}`
const ZIP_FILE = Path.join(DIST_DIR, `${PLAT_ARCH}.zip`)

if (!Fs.existsSync(ZIP_FILE)) throw `no support for ${PLAT_ARCH}: can't find ${ZIP_FILE}`

if (Fs.existsSync(TARG_DIR)) Fs.rmSync(TARG_DIR, {recursive: true})
if (!Fs.existsSync(TOOLS_DIR)) Fs.mkdirSync(TOOLS_DIR)
Fs.mkdirSync(TARG_DIR)

let zip = new Zip(ZIP_FILE)
zip.extractAllTo(TARG_DIR, true, true)

Fs.readdirSync(DIST_DIR).filter(fn => fn.match(PRE)).forEach(fn => {
    Fs.writeFileSync(Path.join(TARG_DIR, fn), Fs.readFileSync(Path.join(DIST_DIR, fn)))
})

Fs.rmSync(DIST_DIR, {recursive: true})
