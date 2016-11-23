/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-01-19
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config')();
const version = require('../package.json').version;
const minimatch = require('minimatch');
const JSON5 = require('json5');

/**
 * 判断指定路径是否是文件
 * @param path
 * @returns {boolean}
 */
exports.isFile = function isFile(path) {
  try {
    return fs.statSync(path).isFile();
  } catch (e) {
    return false;
  }
};

/**
 * 判断指定路径是否是文件夹
 * @param path
 * @returns {boolean}
 */
exports.isDirectory = function isDirectory(path) {
  try {
    return fs.statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
};

/**
 * 获取修改时间
 * @param path
 * @returns {boolean}
 */
exports.getModifiedTime = function (path) {
  try {
    return fs.statSync(path).mtime;
  } catch (e) {
    return false;
  }
};

exports.readJSON = function readJSON(file) {
  let data = fs.readFileSync(file, 'utf8');
  return JSON.parse(data);
};

/**
 * 读取JSON5文件
 * @param file
 */
exports.readJSON5 = function readJSON5(file) {
  let data = fs.readFileSync(file, 'utf8');
  return JSON5.parse(data);
};

exports.writeJson = function writeJson(file, data) {
  return fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

exports.copyAndReplace = function copyAndReplace(src, target, replaces) {
  let data = fs.readFileSync(src, 'utf8');
  for (let key in replaces) {
    data = data.replace(new RegExp(exports.escapeRegExp(key), 'g'), replaces[key]);
  }
  fs.writeFileSync(target, data);
};

/**
 * 递归获取JS文件列表
 * @param dir
 * @returns {*|Array}
 */
exports.getJsFiles = function getJsFiles(dir) {
  let res = [];
  let files = fs.readdirSync(dir);
  for (let file of files) {
    if (exports.isDirectory(dir + '/' + file)) {
      res = res.concat(exports.getJsFiles(dir + '/' + file));
    } else if (/\.js$/.test(file)) {
      res.push(dir + '/' + file);
    }
  }
  return res;
};

/**
 * 获取文件信息
 * @param file
 * @returns {FileInfo}
 */
exports.getInfo = function (file) {
  let info = path.parse(file);
  return Object.assign(info, {
    file: path.normalize(file),
    relative: path.relative(config.workDir, file),
    fromSrc: path.relative(config.srcDir, file),
    fromDist: path.relative(config.distDir, file)
  });
};

/**
 * 获取文件信息列表
 * @param dir
 * @returns {Array<FileInfo>}
 */
exports.getFileInfos = function getFileInfos(dir) {
  let res = [];
  let list = fs.readdirSync(dir);
  for (let name of list) {
    if (name[0] === '.') continue;
    let file = path.join(dir, name);
    if (exports.isDirectory(file)) {
      res = res.concat(exports.getFileInfos(file));
    } else {
      res.push(exports.getInfo(file));
    }
  }
  return res;
};

/**
 * 递归向上删除空文件夹
 * @param dir
 */
exports.removeEmptyDir = function removeEmptyDir(dir) {
  if (!fs.readdirSync(dir).length) {
    console.log('remove'.red, path.relative(config.workDir, dir));
    rm('-R', dir);
    removeEmptyDir(path.dirname(dir));
  }
};

/**
 * 删除文件
 * @param file
 */
exports.removeFile = function removeFile(file) {
  rm(file);
  exports.removeEmptyDir(path.dirname(file));
};

/**
 * 获取目标文件后缀
 * @param ext
 */
exports.getDistFileExt = function getDistFileExt(ext) {
  switch (ext) {
    case '.less':
    case '.sass':
    case '.scss':
      return '.wxss';
    case '.xml':
      return '.wxml';
  }
  return ext;
};

/**
 * 判断某个文件是否是页面中的文件
 * @param file
 * @returns {boolean}
 */
exports.inPages = function inPages(file) {
  return path.relative(config.srcDir + 'pages/', file)[0] !== '.';
};


/**
 * 判断某个文件是否是node_modules中的文件
 * @param file
 * @returns {boolean}
 */
exports.inNpm = function inNpm(file) {
  return path.relative(config.modulesDir, file)[0] !== '.';
};

/**
 * 判断文件是否发生了变化
 * @param {string} from
 * @param {string} to
 * @param {Object} metadata
 * @returns {boolean}
 */
exports.isChanged = function isChanged(from, to, metadata) {
  if (process.env.MINIFY) {
    metadata[from] = {};
    metadata[to] = {};
    return true;
  }

  let fromTime = exports.getModifiedTime(from).toString();

  if (!metadata[from] || !metadata[to] || metadata[from].mtime !== fromTime || !metadata[from].depends || !exports.isFile(to)) {
    metadata[from] = {
      mtime: fromTime
    };
    metadata[to] = {};
    return true;
  }

  if (metadata[from].v !== version || metadata[to].v !== version) {
    metadata[from] = {
      mtime: fromTime
    };
    metadata[to] = {};
    return true;
  }

  let toTime = exports.getModifiedTime(to).toString();
  if (metadata[to].mtime !== toTime) {
    metadata[from] = {
      mtime: fromTime
    };
    metadata[to] = {};
    return true;
  }

  return false;
};

/**
 * 生成安全的正则字符串
 * @param {string} str
 * @returns {string}
 */
exports.escapeRegExp = function escapeRegExp(str) {
  if (str && str.toString) str = str.toString();
  if (typeof str !== 'string' || !str.length) return '';
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
};

/**
 * 将驼峰样式字符串转为小写字符串样式
 * @param {string} name
 * @returns {string}
 */
exports.nameToKey = function nameToKey(name) {
  return name.replace(/([a-z])([A-Z])/g, (a, b, c) => (b + '-' + c.toLowerCase())).toLowerCase();
};

function match(file, role) {
  if (typeof role === 'string') {
    return minimatch(file, role);
  } else if (Array.isArray(role)) {
    for (let r of role) {
      if (match(file, r)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {string} file
 * @returns {boolean}
 */
exports.shouldBabelIgnore = function shouldBabelIgnore(file) {
  let babelConfig = config.babelConfig;
  if (babelConfig.only) {
    return !match(file, babelConfig.only);
  }
  if (!babelConfig.ignore) {
    return false;
  }

  return match(file, babelConfig.ignore);
};
