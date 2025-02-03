#! /bin/sh

VERS='26.0.1'

DATE=`date -u +%Y%m%d%H%M`
VERS_FULL="${VERS}.${DATE}"

rm -f VERSION-*
touch VERSION-${VERS_FULL}
echo "${VERS}" >> VERSION-${VERS_FULL}
echo "${DATE}" >> VERSION-${VERS_FULL}

cat releng/gh-auth.txt | gh auth login --with-token

rm -rf build
mkdir build

pushd build
git clone --depth 1 -b main https://github.com/em-foundation/emscript-sdk.git
cd emscript-sdk
gh release create v${VERS_FULL} --notes-file ../../CHANGELOG.md --prerelease
popd
