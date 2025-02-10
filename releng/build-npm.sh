#! /bin/sh

source releng/common.sh

make_package() {
    name=$1
    vers=$(cat $PKGS/$name/VERSION)
    root=$NPM/$name
    mkdir $root
    cp -r $PKGS/template/* ${root}
    sed_in_place "s/@NAME/$name/" "$root/scripts/install.js"
    sed_in_place "s/@NAME/$name/" "$root/package.json"
    sed_in_place "s/@VERS/${vers}/" "${root}/package.json"
    mkdir $root/dist
    cp $PKGS/$name/*.zip $root/dist
    cp $PKGS/$name/LICENSE $root/dist
    touch $root/dist/VERSION-$vers.$DATE
    pushd $root
    npm pack
    gh release delete-asset resources *.tgz --repo em-foundation/npm-packages -y || true
    gh release upload resources *.tgz --repo em-foundation/npm-packages
    popd
}

rm -rf $NPM
mkdir $NPM

make_package segger-arm
make_package ti-uniflash

