#! /bin/sh

VERS='26.0.1'

DATE=`date -u +%Y%m%d%H%M`
FULL="${VERS}.${DATE}"

rm -f VERSION-*
touch VERSION-${FULL}
echo "${VERS}" >> VERSION-${FULL}
echo "${DATE}" >> VERSION-${FULL}

cat releng/gh-auth.txt | gh auth login --with-token

rm -rf build
mkdir build

pushd build
git clone --depth 1 -b staging https://github.com/em-foundation/emscript-sdk.git
cd emscript-sdk
cp ../../CHANGELOG.md .
rm -f VERSION-*
cp ../../VERSION-* .
popd
