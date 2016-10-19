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
const UglifyJS = require('uglify-js');
const util = require('./util');
const config = require('./config');
require('colors');

const distPath = process.cwd() + '/dist/';
const pagesPath = process.cwd() + '/dist/pages/';
const npmPath = process.cwd() + '/dist/npm/';
const modulesPath = process.cwd() + '/node_modules/';
const cwdPath = process.cwd() + '/';

function isChanged(from, to, metadata) {

  if (process.env.MINIFY) {
    metadata[from] = {};
    return true;
  }

  let fromTime = util.getModifiedTime(from).toString();

  if (!metadata[from]) {
    metadata[from] = {
      mtime: fromTime
    };
    return true;
  }

  if (!util.isFile(to)) {
    metadata[from].mtime = fromTime;
    return true;
  }

  if (metadata[from].mtime !== fromTime) {
    metadata[from].mtime = fromTime;
    return true;
  }
  if (!metadata[from].depends) {
    return true;
  }

  return false;
}

/**
 * 编译JS文件
 * @param from        源文件绝对路径
 * @param to          目标文件绝对路径
 * @param targets     编译目标文件列表
 * @param metadata    编译信息
 */
module.exports = function* buildJS(from, to, targets, metadata) {
  if (targets[to]) return;
  const isNPM = path.relative(modulesPath, from)[0] !== '.';
  targets[to] = true;

  if (!isChanged(from, to, metadata)) {
    console.log((isNPM ? '\tignore unchanged' : 'ignore unchanged').yellow, path.relative(cwdPath, from).gray);
    if (metadata[from].depends) {
      for (let f in metadata[from].depends) {
        yield co(buildJS(f, metadata[from].depends[f], targets, metadata));
      }
    }
    return;
  }
  const depends = metadata[from].depends = {};


  const isApp = path.relative(distPath, to) === 'app.js';
  const isTest = /\.test\.js$/.test(from);
  const isPage = path.relative(pagesPath, to)[0] !== '.' && !isTest;
  const relativePath = path.relative(distPath, to);
  if (isTest && !process.env.TEST) {
    console.log((isNPM ? '\tignore test' : 'ignore test').yellow, path.relative(cwdPath, from).gray);
    return;
  }
  console.log((isNPM ? '\tbuild js' : 'build js').green, path.relative(cwdPath, from).blue, '->', path.relative(cwdPath, to).cyan);

  let testPath;
  let relativeTestPath;
  if (!isTest && process.env.TEST) {
    let info = path.parse(from);
    let file = path.join(info.dir, info.name + '.test.js');
    if (util.isFile(file)) {
      testPath = './' + info.name + '.test.js';
      relativeTestPath = path.relative(cwdPath + '/src', file);
    }
  }

  //babel转码
  const babel = require(process.cwd() + '/node_modules/babel-core');
  let code = babel.transformFileSync(from).code.replace(/'use strict';\n?/g, '');

  //如果代码中引用了global或window 则加载'labrador/global'尝试兼容
  if (/global|window/.test(code)) {
    code = "var global=window=require('labrador/global');\n" + code;
  }

  code = code.replace(/__DEBUG__/g, process.env.DEBUG ? 'true' : 'false');
  code = code.replace(/process\.env\.NODE_ENV/g, JSON.stringify(process.env.DEBUG ? 'development' : 'production'));

  //转换 foobar instanceof Function 为 typeof foobar ==='function'
  //由于微信重定义了全局的Function对象，所以moment等npm库会出现异常
  code = code.replace(/([\w\[\]a-d\.]+)\s*instanceof Function/g, function (matchs, word) {
    return ' typeof ' + word + " ==='function' ";
  });

  if (isPage) {
    let defaultExport = 'exports.default';
    let matchs = code.match(/exports\.default\s*=\s*(\w+);/i);
    if (matchs) {
      defaultExport = matchs[1];
      code = code.replace(/exports\.default\s*=\s*(\w+);/i, '');
    }

    if (testPath) {
      defaultExport = `require('labrador-test')(${defaultExport},require('${testPath}'),'${relativeTestPath}')`;
    }

    if (code.indexOf('var _labrador = require(') > -1) {
      code += `\nPage(_labrador._createPage(${defaultExport}));\n`;
    } else {
      code += `\nPage(require('labrador')._createPage(${defaultExport}));\n`;
    }
  } else {
    if (testPath) {
      code += `\nmodule.exports=require('labrador-test')(module.exports,require('${testPath}'),'${relativeTestPath}');`;
    }
  }

  let promises = [];

  code = code.replace(/require\(['"]([\w\d_\-\.\/]+)['"]\)/ig, function (match, lib) {
    //如果引用文件是相对位置引用
    if (lib[0] === '.' && !isNPM) {
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
    if (lib.indexOf('/') === -1 || lib.indexOf('/') === lib.length - 1) {
      //只指定了包名
      lib = lib.replace(/\//, '');
      if (config.npmMap && config.npmMap.hasOwnProperty(lib)) {
        lib = config.npmMap[lib];
      }
      let pkg = util.readJSON(path.join(modulesPath, lib, '/package.json'));
      let main = pkg.main || 'index.js';
      if (pkg.browser && typeof pkg.browser === 'string') {
        main = pkg.browser;
      }
      let source = path.join(modulesPath, lib, main).replace(/\\/g, '/');
      if (!util.isFile(source)) {
        if (util.isFile(source + '.js')) {
          source += '.js';
        } else if (util.isFile(source + '/index.js')) {
          source += '/index.js';
        }
      }

      let target = path.join(npmPath, path.relative(modulesPath, source)).replace(/\\/g, '/');
      relative = path.relative(path.dirname(to), target).replace(/\\/g, '/');
      if (!targets[target]) {
        depends[source] = target;
        promises.push(buildJS(source, target, targets, metadata));
      }
    } else {
      //如果还指定了包里边的路径
      lib = lib.replace(/^(\w+)/i, function (name) {
        if (config.npmMap && config.npmMap.hasOwnProperty(name)) {
          return config.npmMap[name];
        }
        return name;
      });
      let source = modulesPath + lib;
      let target = npmPath + lib;
      if (lib[0] === '.') {
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
      if (!targets[target]) {
        depends[source] = target;
        promises.push(buildJS(source, target, targets, metadata));
      }
    }

    relative = relative.replace(/\\/g, '/');
    if (relative[0] !== '.') {
      relative = './' + relative;
    }

    return `require('${relative}')`;
  });

  if (isApp) {
    code += `\n{\nvar __app=new exports.default();Object.getOwnPropertyNames(__app.constructor.prototype).forEach(function(name){if(name!=='constructor')__app[name]=__app.constructor.prototype[name]});App(__app);\n}`;
  }

  if (process.env.CATCH) {
    code = `\ntry{\n${code}\n}catch(error){console.error('JS载入失败 ${relativePath} '+error.stack);throw error;}`;
  }

  code = 'var exports=module.exports={};\n' + code;
  code = "'use strict';\n(function(module,require){" + code + '\n})(module,require);';

  if (process.env.MINIFY) {
    code = UglifyJS.minify(code, Object.assign({}, { fromString: true }, config)).code;
  }

  mkdirp.sync(path.dirname(to));
  fs.writeFileSync(to, code);

  while (promises.length) {
    yield co(promises.shift());
  }
};
