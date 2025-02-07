#! /bin/sh

SDK=build/emscript-sdk

rm -rf ${SDK}/workspace
mkdir ${SDK}/workspace

cp -r ../emscript-content/workspace/em.core ${SDK}/workspace
cp -r ../emscript-content/workspace/ti.cc23xx ${SDK}/workspace

cp ../emscript-content/workspace/emscript.ini ${SDK}/workspace
cp ../emscript-content/.clang-format ${SDK}
cp ../emscript-content/tsconfig.base.json ${SDK}
