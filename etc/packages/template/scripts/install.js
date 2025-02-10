'use strict'

const Path = require('path')
const Fs = require('fs')
const Zip = require('adm-zip')

const DIST_DIR = 'dist'
const TOOLS_DIR = '../../tools'
const TARG_DIR = Path.join(TOOLS_DIR, '@NAME')

const PRE = /^(VERSION)|(LICENSE)/

const PLAT_ARCH = `${process.platform}-${process.arch}`
const ZIP_FILE = Path.join(DIST_DIR, `${PLAT_ARCH}.zip`)

if (!Fs.existsSync(ZIP_FILE)) throw `no support for ${PLAT_ARCH}: can't find ${ZIP_FILE}`

if (Fs.existsSync(TARG_DIR)) Fs.rmSync(TARG_DIR, { recursive: true })
Fs.mkdirSync(TARG_DIR, { recursive: true })

let zip = new Zip(ZIP_FILE)
zip.extractAllTo(TARG_DIR, true, true)

Fs.readdirSync(DIST_DIR).filter(fn => fn.match(PRE)).forEach(fn => {
    Fs.writeFileSync(Path.join(TARG_DIR, fn), Fs.readFileSync(Path.join(DIST_DIR, fn)))
})

Fs.rmSync(DIST_DIR, { recursive: true })
