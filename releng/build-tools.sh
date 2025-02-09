#! /bin/sh

source releng/common.sh

rm -f emscript*.vsix

npm version --no-git-tag-version --allow-same-version $VERS

npm run build
sed_in_place "s/@VERS/${VERS_FULL}/" out/cli/Main.js
sed_in_place "s/@VERS/${VERS_FULL}/" out/ext/extension.js

npx vsce package
mv emscript-${VERS}.vsix emscript-${VERS_FULL}.vsix
cp *.vsix ${SDK}/tools/emscript-vscode.vsix

cp -r etc/packages/emscript-cli build
pushd $CLI
sed_in_place "s/@VERS/${VERS}/" package.json
mkdir -p bin
cp ../../out/cli/Main.js bin/main.js
chmod +x bin/main.js
npm pack .
mv *.tgz emscript-cli-${VERS_FULL}.tgz
gh release delete-asset resources *.tgz --repo em-foundation/npm-packages -y || true
gh release upload resources *.tgz --repo em-foundation/npm-packages
popd

cp etc/packages/emscript-sdk/package.json $SDK
pushd $SDK
sed_in_place "s/@VERS/${VERS}/" package.json
sed_in_place "s/@FULL/${VERS_FULL}/" package.json
npm install --package-lock-only --ignore-scripts
popd
