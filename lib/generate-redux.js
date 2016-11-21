/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-11-21
 * @author Liang <liang@maichong.it>
 */

'use strict';

require('colors');
const path = require('path');
const mkdirp = require('mkdirp');
const utils = require('./utils');
const Config = require('./config');

/**
 * 创建Redux
 * @param {string} name
 * @param {Object} options
 */
function generateRedux(name, options) {
  const config = Config(options);

  let target = path.join(config.srcDir, 'redux', name + '.js');
  if (utils.isFile(target)) {
    console.error(`组件创建失败："${path.relative(config.workDir, target)}" 已经存在`.red);
    process.exit();
  }

  mkdirp.sync(path.dirname(target));

  utils.copyAndReplace(path.join(__dirname, '../templates/redux/index.js'), target, {
    NAME_UPPER_CASE: name.toUpperCase(),
    NAME_LOWER_CASE: name.toLowerCase()
  });
}

module.exports = generateRedux;
