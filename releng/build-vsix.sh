#! /bin/sh

VERS=`sed -n '1p' VERSION-*`
DATE=`sed -n '2p' VERSION-*`
VERS_FULL="${VERS}.${DATE}"

rm -f emscript*.vsix

npm version --no-git-tag-version --alow-same-version ${VERS}

#npx vsce package
#mv emscript-${VERS}.vsix emscript-${VERS_FULL}.vsix
