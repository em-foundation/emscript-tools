#! /bin/sh

VERS=`sed -n '1p' VERSION-*`
DATE=`sed -n '2p' VERSION-*`
VERS_FULL="${VERS}.${DATE}"

SDK=build/emscript-sdk

rm -f emscript*.vsix

npm version --no-git-tag-version --allow-same-version ${VERS}

cp -r etc/packages/emscript-cli build
pushd build/emscript-cli
sed -i "s/@VERS/${VERS}/" emscript.sh
sed -i "s/@VERS/${VERS}/" package.json
npm pack .
cp *.tgz ../../emscript-cli.tgz
popd

cp etc/packages/sdk-tools/package.json package-tools.json
sed -i "s/@VERS/${VERS}/" package-tools.json

npm run build
sed -i "s/@VERS/${VERS_FULL}/" out/cli/Main.js
sed -i "s/@VERS/${VERS_FULL}/" out/ext/extension.js

npx vsce package
mv emscript-${VERS}.vsix emscript-${VERS_FULL}.vsix

rm emscript-cli.tgz

cp *.vsix ${SDK}/emscript.vsix
cp package-tools.json ${SDK}/package.json

## cd build/emscript-sdk
## gh release upload v${VERS_FULL} ../../*.vsix
## gh release upload v${VERS_FULL} ../../package-tools.json

