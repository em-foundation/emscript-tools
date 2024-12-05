import * as Commander from 'commander'

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
    console.log(`building ${opts.unit} ...`)
}