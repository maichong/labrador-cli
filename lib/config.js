/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-10-11
 * @author Liang <liang@maichong.it>
 */

'use strict';

const path = require('path');
const util = require('./util');

let config = {
  npmMap: {},
  uglify: {
    mangle: [],
    compress: {
      warnings: false
    }
  },
  classNames: {}
};

let file = path.join(process.cwd(), '.labrador');

if (util.isFile(file)) {
  try {
    let data = util.readJSON(file);
    config = Object.assign(config, data);
  } catch (error) {
    console.error('Read project config file error ' + file);
    throw error;
  }
}

module.exports = config;
