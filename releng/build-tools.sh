#! /bin/sh

VERS=`sed -n '1p' VERSION-*`
DATE=`sed -n '2p' VERSION-*`
VERS_FULL="${VERS}.${DATE}"

SDK=build/emscript-sdk

rm -f emscript*.vsix

npm version --no-git-tag-version --allow-same-version ${VERS}

npm run build
sed -i '' "s/@VERS/${VERS_FULL}/" out/cli/Main.js
sed -i '' "s/@VERS/${VERS_FULL}/" out/ext/extension.js

npx vsce package
mv emscript-${VERS}.vsix emscript-${VERS_FULL}.vsix
cp *.vsix ${SDK}/tools/emscript-vscode.vsix

cp -r etc/packages/emscript-cli build
pushd build/emscript-cli
sed -i '' "s/@VERS/${VERS}/" package.json
mkdir -p bin
cp ../../out/cli/Main.js bin/main.js
chmod +x bin/main.js
npm pack .
mv *.tgz emscript-cli-${VERS_FULL}.tgz
gh release delete-asset resources *.tgz --repo em-foundation/npm-packages -y || true
gh release upload resources *.tgz --repo em-foundation/npm-packages
popd

cp etc/packages/emscript-sdk/package.json build/emscript-sdk
sed -i '' "s/@VERS/${VERS}/" build/emscript-sdk/package.json
sed -i '' "s/@FULL/${VERS_FULL}/" build/emscript-sdk/package.json
