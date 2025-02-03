#! /bin/sh

VERS=`sed -n '1p' VERSION-*`
DATE=`sed -n '2p' VERSION-*`
VERS_FULL="${VERS}.${DATE}"

pushd build/emscript-sdk
gh release upload v${VERS_FULL} ../npm/*.tgz
popd
