#! /bin/sh

source releng/common.sh

git tag $FULL
git push origin $FULL

pushd ../emscript-content
git tag $FULL
git push origin $FULL
popd

pushd $SDK
git add .
git commit -m "version $FULL"
git push
git tag $FULL
git push origin $FULL
popd
