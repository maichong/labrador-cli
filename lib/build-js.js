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
const npmroot = process.cwd() + '/dist/npm/';
const node_modules = process.cwd() + '/node_modules/';

module.exports = function * buildJS(from, to, withAbstract, ignores) {
  console.log(withAbstract ? '\tbuildJS' : 'buildJS', from, to);
  let code = babel.transformFileSync(from).code.replace(/'use strict';\n?/g, '');

  if (/global|window/.test(code)) {
    code = "var global=window=require('labrador/global');\n" + code;
  }

  let promises = [];

  ignores = ignores || {};

  code = code.replace(/require\(['"]([\w\d\_\-\.\/]+)['"]\)/ig, function (match, lib) {
    if (lib[0] == '.' && !withAbstract) {
      let file = path.join(path.dirname(from), lib);
      if (!util.isFile(file)) {
        if (util.isFile(file + '.js')) {
          return `require('${lib}.js')`;
        }
        if (util.isFile(file + '/index.js')) {
          return `require('${lib}/index.js')`;
        }
      }
      return match;
    }
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
          promises.push(co(buildJS(source, target, true, ignores)));
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
        if (!util.isFile(target) || !withAbstract) {
          promises.push(co(buildJS(source, target, true, ignores)));
        }
      }
    }

    relative = relative.replace(/\\/g, '/');
    if (relative[0] !== '.') {
      relative = './' + relative;
    }

    return `require('${relative}')`;
  });

  if (!withAbstract || process.env.TRY_ALL) {
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
