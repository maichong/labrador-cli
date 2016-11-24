/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const slash = require('slash');
const utils = require('./utils');
const config = require('./config')();
const version = require('../package.json').version;
require('colors');

/**
 * 编译JS文件
 * @param {FileInfo|string} from      源文件绝对路径
 * @param {FileInfo|string} to        目标文件绝对路径
 * @param {Object} targets     编译目标文件列表
 * @param {Object} metadata    编译信息
 */
module.exports = function* buildJS(from, to, targets, metadata) {
  if (typeof from === 'string') {
    from = utils.getInfo(from);
  }
  if (typeof to === 'string') {
    to = utils.getInfo(to);
  }
  if (targets[to.file]) return;
  const distNpmDir = config.distDir + '/npm/';
  const isNPM = utils.inNpm(from.file);
  const isTest = /\.test\.js$/.test(from.file);
  const isPage = utils.inPages(from.file) && !isTest;
  if (isTest && !process.env.TEST) {
    console.log((isNPM ? '\tignore test' : 'ignore test').yellow, from.relative.gray);
    return;
  }
  targets[to.file] = true;

  if (!utils.isChanged(from.file, to.file, metadata)) {
    console.log((isNPM ? '\tignore unchanged' : 'ignore unchanged').yellow, from.relative.gray);
    if (metadata[from.file].depends) {
      for (let f in metadata[from.file].depends) {
        yield* buildJS(f, metadata[from.file].depends[f], targets, metadata);
      }
    }
    return;
  }
  const depends = metadata[from.file].depends = {};
  metadata[from.file].v = version;

  const isApp = from.fromSrc === 'app.js';
  const relativePath = slash(to.fromDist);
  console.log((isNPM ? '\tbuild js' : 'build js').green, from.relative.blue, '->', to.relative.cyan);

  let testPath;
  let relativeTestPath;
  if (!isTest && process.env.TEST) {
    let file = path.join(from.dir, from.name + '.test.js');
    if (utils.isFile(file)) {
      testPath = './' + from.name + '.test.js';
      relativeTestPath = path.relative(config.srcDir, file);
    }
  }

  let code = fs.readFileSync(from.file, 'utf8');

  if (!utils.shouldBabelIgnore(from.relative)) {
    const babel = require(config.modulesDir + 'babel-core');
    code = babel.transform(code, Object.assign({}, config.babelConfig, {
      sourceMaps: process.env.NODE_ENV === 'development' ? 'inline' : false
    })).code;
  } else {
    //console.log('babel ignored');
  }

  code = code.replace(/'use strict';\n?/g, '');

  //如果代码中引用了global或window 则加载'labrador/global'尝试兼容
  if (!process.env.MINIFY && /global|window/.test(code)) {
    code = "var global=window=require('labrador/global');" + code;
  }

  if (code.indexOf('__DEBUG__') > -1) {
    throw new Error(`__DEBUG__ 已经弃用，请使用 __DEV__ 代替`);
  }

  code = code.replace(/__DEV__/g, process.env.NODE_ENV === 'development' ? 'true' : 'false');
  code = code.replace(/process\.env\.NODE_ENV/g, JSON.stringify(process.env.NODE_ENV));
  if (config.define) {
    for (let key in config.define) {
      let value = config.define[key];
      code = code.replace(new RegExp(utils.escapeRegExp(key), 'g'), JSON.stringify(value));
    }
  }

  if (/[^\w_]process\.\w/.test(code) && !/typeof process/.test(code)) {
    code = `var process={};${code}`;
  }

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
    //如果引用文件是相对位置引用，并且当前文件不是NPM包文件，不存在映射
    if (lib[0] === '.' && !isNPM) {
      let file = path.join(path.dirname(from.file), lib);
      //兼容省略了.js的路径
      if (!utils.isFile(file) && utils.isFile(file + '.js')) {
        lib += '.js';
      }
      //兼容省略了/index.js的路径
      if (!utils.isFile(file) && utils.isFile(file + '/index.js')) {
        lib += '/index.js';
      }
      return `require('${lib}')`;
    }

    //如果引用NPM包文件
    let source;
    let target;
    if (lib.indexOf('/') === -1 || lib.indexOf('/') === lib.length - 1) {
      //只指定了包名
      lib = lib.replace(/\//, '');
      if (config.npmMap && config.npmMap.hasOwnProperty(lib)) {
        lib = config.npmMap[lib];
      }
      let dir = path.join(config.modulesDir, lib);
      let pkgFile = path.join(dir, '/package.json');
      if (utils.isFile(pkgFile)) {
        let pkg = utils.readJSON(pkgFile);
        let main = pkg.main || 'index.js';
        if (pkg.browser && typeof pkg.browser === 'string') {
          main = pkg.browser;
        } else if (pkg['jsnext:main']) {
          main = pkg['jsnext:main'];
        }
        source = path.join(config.modulesDir, lib, main);
      } else {
        source = dir;
      }
      if (!utils.isFile(source)) {
        if (utils.isFile(source + '.js')) {
          source += '.js';
        } else if (utils.isFile(source + '/index.js')) {
          source += '/index.js';
        }
      }
      target = path.join(distNpmDir, path.relative(config.modulesDir, source));
    } else {
      //如果还指定了包里边的路径
      lib = lib.replace(/^([\w\.\-\_]+)/i, function (name) {
        if (config.npmMap && config.npmMap.hasOwnProperty(name)) {
          return config.npmMap[name];
        }
        return name;
      });
      source = config.modulesDir + lib;
      target = distNpmDir + lib;
      if (lib[0] === '.') {
        source = path.join(from.dir, lib);
        target = path.join(to.dir, lib);
      }
      if (!utils.isFile(source) && utils.isFile(source + '.js')) {
        source += '.js';
        target += '.js';
      } else if (utils.isDirectory(source)) {
        source += '/index.js';
        target += '/index.js';
      }
      if (!utils.isFile(source)) {
        console.log(source);
        throw new Error('Can not resolve ' + lib);
      }
    }
    source = path.normalize(source);
    target = path.normalize(target);

    let sourceRelative = slash(path.relative(config.modulesDir, source));

    if (config.npmMap.hasOwnProperty(sourceRelative)) {
      //TODO log
      source = path.join(config.modulesDir, config.npmMap[sourceRelative]);
      target = path.join(config.distDir, 'npm', config.npmMap[sourceRelative]);
    }

    let relative = slash(path.relative(to.dir, target));
    if (!targets[target]) {
      depends[source] = target;
      promises.push(buildJS(source, target, targets, metadata));
    }

    relative = slash(relative);
    if (relative[0] !== '.') {
      relative = './' + relative;
    }

    return `require('${relative}')`;
  });

  if (isApp) {
    code += `\n{\nvar __app=new exports.default();Object.getOwnPropertyNames(__app.constructor.prototype).forEach(function(name){if(name!=='constructor')__app[name]=__app.constructor.prototype[name]});App(__app);\n}`;
  }

  if (process.env.CATCH) {
    code = `\ntry{${code}\n}catch(error){console.error('JS载入失败 ${relativePath} '+error.stack);throw error;}`;
  }

  if (!process.env.MINIFY) {
    code = '"use strict";var exports=module.exports={};' + code;
  }

  mkdirp.sync(to.dir);
  fs.writeFileSync(to.file, code);
  metadata[to.file].mtime = utils.getModifiedTime(to.file).toString();
  metadata[to.file].v = version;

  while (promises.length) {
    yield* promises.shift();
  }
};
