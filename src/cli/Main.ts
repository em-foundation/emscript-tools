import * as Commander from 'commander'
import * as Path from 'path'

import * as Session from './Session'

const CMD = new Commander.Command('em-script')

CMD
    .version("0.0.1")
    .option('--root <dir>', 'project root directory', '..')
CMD
    .command('build')
    .description('build a unit')
    .requiredOption('-u --unit <qualified-name>', '<package-name>/<bundle-name>/<unit-name>')
    .action((opts: any) => doBuild(opts))
CMD
    .command('clean')
    .description('clean a bundle')
    .action((opts: any) => doClean(opts))

CMD.parse(process.argv)

function doBuild(opts: any): void {
    Session.activate(getRoot(), Session.Mode.BUILD)
    Session.buildUnit(opts.unit)
}

function doClean(opts: any): void {
    Session.activate(getRoot(), Session.Mode.CLEAN)
}

function getRoot() {
    return Path.resolve(CMD.opts().root)
}

