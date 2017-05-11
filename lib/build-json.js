/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const utils = require('./utils');
const config = require('./config')();
require('colors');

/**
 * 编译JSON
 * @param {FileInfo} from
 * @param {FileInfo} to
 * @returns {Array}
 */
module.exports = function* buildJSON(from, to) {
  console.log('build json'.green, from.relative.blue, '->', to.relative.cyan);
  let data = fs.readFileSync(from.file, 'utf8');

  if (config.define) {
    for (let key in config.define) {
      let value = config.define[key];
      data = data.replace(new RegExp(utils.escapeRegExp(key), 'g'), JSON.stringify(value));
    }
  }

  mkdirp.sync(to.dir);
  fs.writeFileSync(to.file, data);
};
