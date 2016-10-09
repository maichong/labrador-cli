/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
//const mkdirp = require('mkdirp');
const co = require('co');
const babel = require(process.cwd() + '/node_modules/babel-core');
const util = require('./util');
const components = process.cwd() + '/src/components/';
const dist = process.cwd() + '/dist/inc/';
//const npmroot = process.cwd() + '/dist/npm/';
const node_modules = process.cwd() + '/node_modules/';
const less = require('less');
const cwd = process.cwd();
require('colors');

function build(from) {
  let data = fs.readFileSync(from, 'utf8');
  return data.replace(/\@import\s+['"]([\w\d\.\-\_\/]+)['"];?/ig, function (match, lib) {
    //尝试加载 相对目录或同一目录下指定的less文件
    let src = path.join(path.dirname(from), lib);
    if (!util.isFile(src)) {
      //尝试加载 没有指定less后缀时,相对目录或同一目录下指定的less文件
      src = path.join(path.dirname(from), lib + '.less');

      if (!util.isFile(src)) {

        //尝试加载 components 目录下的通用组件样式
        src = path.join(components, lib, lib + '.less');
        if (!util.isFile(src)) {
          //尝试加载 node_modules 目录下的index.less
          src = path.join(node_modules, lib, 'index.less');

          if (!util.isFile(src)) {
            //尝试加载 node_modules 目录下的指定less文件
            src = path.join(node_modules, lib);
          }
        }
      }
    }

    if (!util.isFile(src)) {
      throw new Error(`Can not import less file '${lib}' from ` + from);
    }
    return build(src)
  });
}

module.exports = function * buildLess(from, to) {
  console.log('build less'.green, path.relative(cwd, from).blue, '->', path.relative(cwd, to).cyan);
  let data = build(from);
  let options = {
    paths: [path.dirname(from)]
  };
  let result = yield less.render(data, options);
  if (!result.css) return;
  fs.writeFileSync(to, result.css);
};
