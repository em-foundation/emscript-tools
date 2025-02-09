VERS=`sed -n '1p' VERSION-*`
DATE=`sed -n '2p' VERSION-*`
FULL="${VERS}.${DATE}"

PKGS=etc/packages

CLI=build/emscript-cli
NPM=build/npm
SDK=build/emscript-sdk

sed_in_place() {
    if [ "$(uname -s)" = "Darwin" ]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}
