#! /bin/sh

source releng/common.sh

pushd $SDK
git checkout main
git pull
git merge --squash staging
git commit -m "squash merge of staging for v${VERS}"
popd
