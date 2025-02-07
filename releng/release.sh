#! /bin/sh

VERS=`sed -n '1p' VERSION-*`
DATE=`sed -n '2p' VERSION-*`
VERS_FULL="${VERS}.${DATE}"

SDK=build/emscript-sdk

pushd ../emscript-content
git tag ${VERS_FULL}
git push origin ${VERS_FULL}
popd

pushd ${SDK}
git add .
git commit -m "version ${VERS_FULL}"
git push
git tag ${VERS_FULL}
git push origin ${VERS_FULL}
popd
