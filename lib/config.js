/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-10-11
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const JSON5 = require('json5');

let program = {};

let configData = {
  srcDir: 'src',
  distDir: 'dist',
  modulesDir: 'node_modules',
  tempDir: '.build',
  define: {},
  npmMap: {},
  uglify: {
    mangle: [],
    compress: {
      warnings: false
    }
  },
  classNames: {},
  env: {
    development: {},
    production: {}
  }
};

let babelFileData = null;

const config = {
  get define() {
    return configData.define || {};
  },

  get npmMap() {
    return configData.npmMap || {};
  },

  get uglify() {
    return configData.uglify || {};
  },

  get classNames() {
    return configData.classNames || {};
  },

  get workDir() {
    return process.cwd() + '/';
  },

  get srcDir() {
    return configData.srcDir;
  },

  get distDir() {
    return configData.distDir;
  },

  get tempDir() {
    return configData.tempDir;
  },

  get modulesDir() {
    return configData.modulesDir;
  },

  get babelConfig() {
    if (!babelFileData) {
      let content = '{}';
      let file = config.workDir + '.babelrc';
      if (utils.isFile(file)) {
        content = fs.readFileSync(file, 'utf8');
      }
      babelFileData = JSON5.parse(content);
    }
    return babelFileData;
  },
};

module.exports = function (p) {
  if (p) {
    babelFileData = null;

    program = p;
    if (p.minify) {
      process.env.MINIFY = true;
      if (!process.env.NODE_ENV) {
        process.env.NODE_ENV = 'production';
      }
    } else {
      if (p.catch) {
        process.env.CATCH = true;
      }
      if (p.test) {
        process.env.TEST = true;
        process.env.CATCH = true;
      }
    }
    if (!process.env.NODE_ENV) {
      process.env.NODE_ENV = 'development';
    }

    if (p.workDir) {
      if (!utils.isDirectory(p.workDir)) {
        throw new Error('--work-dir=' + p.workDir + ' is not exist');
      }
      process.chdir(p.workDir);
    }

    let file = path.join(process.cwd(), '.labrador');

    if (utils.isFile(file)) {
      try {
        let data = utils.readJSON5(file);
        configData = Object.assign(configData, data);
        if (configData.env) {
          let envConfig = configData.env[process.env.NODE_ENV];
          if (envConfig) {
            configData = Object.assign(configData, envConfig);
          }
        }
      } catch (error) {
        console.error('Read project config file error ' + file);
        throw error;
      }
    }

    ['srcDir', 'distDir', 'tempDir', 'modulesDir'].forEach((name) => {
      if (p[name]) {
        configData[name] = p[name];
      }
      if (path.isAbsolute(configData[name])) {
        configData[name] = path.normalize(configData[name]) + '/';
      } else {
        configData[name] = path.join(config.workDir, configData[name]) + '/';
      }
    });
  }
  return config;
};
