/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-11-20
 * @author Liang <liang@maichong.it>
 */

'use strict';

require('colors');
const path = require('path');
const mkdirp = require('mkdirp');
const utils = require('./utils');
const Config = require('./config');

/**
 * 创建组件
 * @param {string} name
 * @param {Object} options
 */
function generateComponent(name, options) {
  const config = Config(options);

  let className = utils.nameToKey(name);
  let fileBase = path.join(config.srcDir, 'components', className, className);

  mkdirp.sync(path.dirname(fileBase));

  ['.js', '.xml', (options.scss ? '.scss' : '.less'), '.test.js'].forEach((ext) => {
    let target = fileBase + ext;
    if (utils.isFile(target)) {
      console.error(`组件创建失败："${path.relative(config.workDir, target)}" 已经存在`.red);
      process.exit();
    }
    utils.copyAndReplace(path.join(__dirname, '../templates/component/component' + ext), target, {
      COMPONENT_NAME: name,
      CLASS_NAME: className
    });
  });
}

module.exports = generateComponent;
