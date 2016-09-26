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
const dist = process.cwd() + '/dist/';
//const npmroot = process.cwd() + '/dist/npm/';
const node_modules = process.cwd() + '/node_modules/';
const less = require('less');

module.exports = function * buildLess(from, to) {
  console.log('buildLess', from, to);
  let data = fs.readFileSync(from, 'utf8');
  data = data.replace(/\@import\s+['"]([\w\d\.\-\_\/]+)['"]/ig, function (match, lib) {
    let test = path.join(path.dirname(from), lib);
    if (util.isFile(test)) {
      return `@import '${lib}'`;
    }
    if (lib.indexOf('/') > -1) {
      test = path.join(node_modules, lib);
      if (util.isFile(test)) {
        test = path.relative(path.dirname(from), test).replace(/\\/g, '/');
        return `@import '${test}'`;
      }
    } else {
      test = path.join(components, lib, lib + '.less');
      if (util.isFile(test)) {
        test = path.relative(path.dirname(from), test).replace(/\\/g, '/');
        return `@import '${test}'`;
      }
      test = path.join(node_modules, lib, 'index.less');
      if (util.isFile(test)) {
        test = path.relative(path.dirname(from), test).replace(/\\/g, '/');
        return `@import '${test}'`;
      }
    }
    return `@import '${lib}'`;
  });
  let options = {};
  //options.rootpath = path.dirname(from);
  options.paths = [path.dirname(from)];
  let result = yield less.render(data, options);
  if (!result.css) return;
  fs.writeFileSync(to, result.css);
};
