#! /bin/sh

source releng/common.sh

pushd $SDK
git checkout main
git pull
git merge --squash staging
git commit -m "squash merge of staging for v${VERS}"
git tag v${VERS}
git push origin v${VERS}
gh release create v26.0.1 -F CHANGELOG.md
popd
