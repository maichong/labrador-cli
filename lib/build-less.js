/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const less = require('less');
const utils = require('./utils');
const config = require('./config')();
require('colors');

/**
 * @param {FileInfo} from
 * @param {Object} depends
 * @returns {string}
 */
function build(from, depends) {
  if (typeof from === 'string') {
    from = utils.getInfo(from);
  }
  const componentsPath = config.srcDir + 'components/';

  let data = fs.readFileSync(from.file, 'utf8');
  return data.replace(/@import\s+['"]([\w\d\.\-_\/]+)['"];?/ig, function (match, lib) {
    //尝试加载 相对目录或同一目录下指定的less文件
    let src = path.join(from.dir, lib);
    if (!utils.isFile(src)) {
      //尝试加载 没有指定less后缀时,相对目录或同一目录下指定的less文件
      src = path.join(from.dir, lib + '.less');

      if (!utils.isFile(src)) {
        //尝试加载 components 目录下的通用组件样式
        src = path.join(componentsPath, lib, lib + '.less');
        if (!utils.isFile(src)) {
          //尝试加载 node_modules 目录下的index.less
          src = path.join(config.modulesDir, lib, 'index.less');

          if (!utils.isFile(src)) {
            //尝试加载 node_modules 目录下的指定less文件
            src = path.join(config.modulesDir, lib);
          }
        }
      }
    }

    if (!utils.isFile(src)) {
      throw new Error(`Can not import less file '${lib}' from ` + from.relative);
    }
    depends[src] = true;
    return build(src, depends);
  });
}

/**
 * 编译LESS
 * @param {FileInfo} from
 * @param {FileInfo} to
 * @returns {Array}
 */
module.exports = function* buildLess(from, to) {
  console.log('build less'.green, from.relative.blue, '->', to.relative.cyan);
  let depends = {};
  let data = build(from, depends);
  let options = {
    paths: [from.dir]
  };
  let result = yield less.render(data, options);
  if (!result.css) return [];
  mkdirp.sync(to.dir);
  fs.writeFileSync(to.file, result.css);
  return Object.keys(depends);
};
