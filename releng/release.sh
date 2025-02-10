#! /bin/sh

VERS=`sed -n '1p' VERSION-*`
DATE=`sed -n '2p' VERSION-*`
FULL="${VERS}.${DATE}"

SDK=build/emscript-sdk

pushd ${SDK}
popd
