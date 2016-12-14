/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author soulwu <soulwuzjjx@vip.qq.com>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const promisify = require('es6-promisify');
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
  return data.replace(/@import\s+['"]([\w\d\.\-_\/]+)['"];?/ig, (match, lib) => {
    //尝试加载 相对目录或同一目录下指定的scss文件
    let src = path.join(from.dir, lib);
    if (!utils.isFile(src)) {
      //尝试加载 没有指定scss后缀时,相对目录或同一目录下指定的scss文件
      src = path.join(from.dir, lib + '.scss');
      if (!utils.isFile(src)) {
        //尝试加载 尝试.sass后缀
        src = path.join(from.dir, lib + '.sass');
        if (!utils.isFile(src)) {
          //尝试加载 components 目录下的通用组件样式
          src = path.join(componentsPath, lib, lib + '.scss');
          if (!utils.isFile(src)) {
            //尝试加载 components 目录下的.sass后缀
            src = path.join(componentsPath, lib, lib + '.sass');
            if (!utils.isFile(src)) {
              //尝试加载 node_modules 目录下的index.scss
              src = path.join(config.modulesDir, lib, 'index.scss');
              if (!utils.isFile(src)) {
                //尝试加载 node_modules 目录下的index.sass
                src = path.join(config.modulesDir, lib, 'index.sass');
                if (!utils.isFile(src)) {
                  //尝试加载 node_modules 目录下的指定scss文件
                  src = path.join(config.modulesDir, lib);
                }
              }
            }
          }
        }
      }
    }

    if (!utils.isFile(src)) {
      throw new Error(`Can not import scss file '${lib}' from ` + from.relative);
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
module.exports = function* buildSass(from, to) {
  console.log('build sass'.green, from.relative.blue, '->', to.relative.cyan);
  let sass;
  try {
    sass = require(config.modulesDir + 'node-sass');
  } catch (e) {
    console.log('\nnode-sass 加载失败，请在项目中运行 '.red + 'npm install --save node-sass'.blue + ' 安装node-sass\n'.red);
    throw e;
  }
  const render = promisify(sass.render);
  let depends = {};
  let data = build(from, depends);
  let result = yield render({ data, outputStyle: 'expanded', includePaths: [from.dir] });
  if (!result.css) return [];
  mkdirp.sync(to.dir);
  fs.writeFileSync(to.file, result.css);
  return Object.keys(depends);
};
