/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const co = require('co');
const path = require('path');
const fs = require('fs');
const util = require('./util');
require('shelljs/global');
require('colors');

const program = require('commander');
program
  .version(require('../package.json').version)
  .usage('')
  .parse(process.argv);

function* init() {
  const cwdPath = process.cwd() + '/';
  const templateDir = path.resolve(__dirname, '../template') + '/';
  if (!util.isFile(cwdPath + 'package.json')) {
    throw new Error('Can not find package.json, please run "npm init" first!');
  }
  if (util.isFile(cwdPath + '.labrador')) {
    throw new Error('发现当前目录中已经存在 .labrador 项目配置文件，请勿重复初始化');
  }
  if (util.isDirectory(cwdPath + 'src')) {
    throw new Error('发现当前目录中已经存在 src 源码目录，请勿重复初始化');
  }

  let dependencies = [
    'assert',
    'babel-core',
    'babel-eslint',
    'babel-preset-es2015',
    'babel-preset-stage-0',
    'babel-plugin-transform-runtime',
    'babel-plugin-transform-export-extensions',
    'babel-plugin-syntax-export-extensions',
    'babel-runtime',
    'core-js',
    'regenerator-runtime',
    'eslint',
    'eslint-config-airbnb',
    'eslint-plugin-react',
    'eslint-plugin-import',
    'eslint-plugin-jsx-a11y',
    'less',
    'labrador',
    'labrador-test'
  ];

  cp('-R', templateDir + 'src', cwdPath);
  cp('-R', templateDir + '.labrador', cwdPath);
  cp('-R', templateDir + '.babelrc', cwdPath);
  cp('-R', templateDir + '.editorconfig', cwdPath);
  cp('-R', templateDir + '.eslintignore', cwdPath);
  cp('-R', templateDir + '.eslintrc', cwdPath);

  let cmd = 'npm install --save ' + dependencies.join(' ');
  console.log(cmd.green);
  exec(cmd);
  cmd = 'labrador build';
  console.log(cmd.green);
  exec(cmd);
}

co(init).then(function () {
  console.log('项目初始化完毕');
}, function (error) {
  console.log('项目初始化失败!');
  console.log(error.message);
});

