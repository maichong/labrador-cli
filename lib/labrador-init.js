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

function * init() {
  const dir = process.cwd() + '/';
  const templateDir = path.resolve(__dirname, '../template') + '/';
  if (!util.isFile(dir + 'package.json')) {
    throw new Error('Can not find package.json, please run "npm init" first!');
  }

  let dependencies = [
    'babel-core',
    'babel-eslint',
    'babel-preset-es2015',
    'babel-preset-stage-0',
    'babel-plugin-transform-runtime',
    'eslint',
    'eslint-config-airbnb',
    'eslint-plugin-react',
    'eslint-plugin-import',
    'eslint-plugin-jsx-a11y',
    'less',
    'labrador'
  ];

  cp('-R', templateDir + 'src', dir);
  cp('-R', templateDir + '.babelrc', dir);
  cp('-R', templateDir + '.editorconfig', dir);
  cp('-R', templateDir + '.eslintignore', dir);
  cp('-R', templateDir + '.eslintrc', dir);

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

