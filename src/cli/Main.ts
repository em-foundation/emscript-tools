import * as Commander from 'commander'

import * as Session from './Session'

const CMD = new Commander.Command('em-script')

CMD
    .version("0.0.1")
    .option('-w, --workspace <dir>', 'Workspace directory', '.')
CMD
    .command('build')
    .description('build a unit')
    .requiredOption('-u --unit <qualified-name>', '<package-name>/<bundle-name>/<unit-name>')
    .action((opts: any) => doBuild(opts))

CMD.parse(process.argv)

function doBuild(opts: any) {
    Session.activate('.', Session.Mode.BUILD)
    Session.buildUnit(opts.unit)
}