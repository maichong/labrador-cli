/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const co = require('co');
const babel = require(process.cwd() + '/node_modules/babel-core');
const util = require('./util');
const dist = process.cwd() + '/dist/';
const pages = process.cwd() + '/dist/pages/';
const npmroot = process.cwd() + '/dist/npm/';
const node_modules = process.cwd() + '/node_modules/';
const cwd = process.cwd();
require('colors');

/**
 * 编译JS文件
 * @param from        源文件绝对路径
 * @param to          目标文件绝对路径
 * @param ignores     编译时,忽略递归编译被引用的文件路径列表
 */
module.exports = function * buildJS(from, to, ignores) {
  const isNPM = path.relative(node_modules, from)[0] !== '.';
  const isPage = path.relative(pages, to)[0] !== '.';
  console.log((isNPM ? '\tbuild js' : 'build js').green, path.relative(cwd, from).blue, '->', path.relative(cwd, to).cyan);

  //babel转码
  let code = babel.transformFileSync(from).code.replace(/'use strict';\n?/g, '');

  //如果代码中引用了global或window 则加载'labrador/global'尝试兼容
  if (/global|window/.test(code)) {
    code = "var global=window=require('labrador/global');\n" + code;
  }

  let promises = [];

  ignores = ignores || {};

  code = code.replace(/require\(['"]([\w\d\_\-\.\/]+)['"]\)/ig, function (match, lib) {
    //如果引用文件是相对位置引用
    if (lib[0] == '.' && !isNPM) {
      let file = path.join(path.dirname(from), lib);
      //兼容省略了.js的路径
      if (!util.isFile(file) && util.isFile(file + '.js')) {
        lib += '.js';
      }
      //兼容省略了/index.js的路径
      if (!util.isFile(file) && util.isFile(file + '/index.js')) {
        lib += '/index.js';
      }
      return `require('${lib}')`;
    }

    //如果引用NPM包文件
    let relative = lib;
    if (lib.indexOf('/') == -1) {
      //只指定了包名
      let pkg = util.readJSON(node_modules + lib + '/package.json');
      let file = 'index.js';
      if (pkg.main) {
        file = pkg.main;
      }
      let source = node_modules + lib + '/' + file;
      let target = npmroot + lib + '/' + file;
      relative = path.relative(path.dirname(to), target);
      if (!ignores[source]) {
        ignores[source] = true;
        if (!util.isFile(target)) {
          promises.push(co(buildJS(source, target, ignores)));
        }
      }
    } else {
      let source = node_modules + lib;
      let target = npmroot + lib;
      if (lib[0] == '.') {
        source = path.join(path.dirname(from), lib);
        target = path.join(path.dirname(to), lib);
      }
      if (!util.isFile(source) && util.isFile(source + '.js')) {
        source += '.js';
        target += '.js';
      } else if (util.isDirectory(source)) {
        source += '/index.js';
        target += '/index.js';
      }
      if (!util.isFile(source)) {
        console.log(source);
        throw new Error('Can not resolve ' + lib);
      }
      relative = path.relative(path.dirname(to), target);
      if (!ignores[source]) {
        ignores[source] = true;
        if (!util.isFile(target) || !isNPM) {
          promises.push(co(buildJS(source, target, ignores)));
        }
      }
    }

    relative = relative.replace(/\\/g, '/');
    if (relative[0] !== '.') {
      relative = './' + relative;
    }

    return `require('${relative}')`;
  });

  if (isPage) {
    code += `\n{\nvar __page=new exports.default();\n__page.init();\nPage(__page);\n}`;
  } else if (path.relative(dist, to) === 'app.js') {
    code += `\n{\nvar __app=new exports.default();Object.getOwnPropertyNames(__app.constructor.prototype).forEach(function(name){if(name!=='constructor')__app[name]=__app.constructor.prototype[name]});App(__app);\n}`;
  }

  if (!isNPM || process.env.TRY_ALL) {
    code = '\ntry{\n' + code + '\n}catch(error){console.error(error.stack);throw error;}';
  }

  code = 'var exports=module.exports={};' + code;
  code = "'use strict';\n" + code;

  //console.log(matchs);
  mkdirp.sync(path.dirname(to));
  fs.writeFileSync(to, code);

  if (promises.length) {
    yield Promise.all(promises);
  }
};
