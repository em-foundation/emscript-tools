export function fail(msg: string) {
    console.error(`*** ${msg}`)
    process.exit(1)
}