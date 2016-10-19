/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-01-19
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');

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

exports.writeJson = function writeJson(file, data) {
  return fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

exports.copyAndReplace = function copyAndReplace(src, target, replaces) {
  let data = fs.readFileSync(src, 'utf8');
  for (let key in replaces) {
    data = data.replace(new RegExp('\\$\\{' + key + '\\}', 'g'), replaces[key]);
  }
  fs.writeFileSync(target, data);
};
