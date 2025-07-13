#!/usr/bin/env node

import * as Analyze from './Analyze'
import * as Capture from './Capture'
import * as Display from './Display'

import * as Commander from 'commander'

const CMD = new Commander.Command('embue')

CMD.command('analyze')
    .description('analyze captured data')
    .action((opts: any) => Analyze.exec(opts))
CMD.command('capture')
    .description('capture power data')
    .action((opts: any) => Capture.exec(opts))
CMD.command('display')
    .description('display active events')
    .action((opts: any) => Display.exec(opts))


CMD.parse(process.argv)
