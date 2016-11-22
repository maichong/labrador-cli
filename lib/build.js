/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const co = require('co');
const path = require('path');
const mkdirp = require('mkdirp');
const utils = require('./utils');
const buildJS = require('./build-js');
const buildLess = require('./build-less');
const buildSass = require('./build-sass');
const buildXML = require('./build-xml');
const minifyPage = require('./minify-page');
const minifyJs = require('./minify-js');
require('shelljs/global');
require('colors');

function* build(options) {
  const config = require('./config')(options);
  if (!utils.isDirectory(config.srcDir)) {
    throw new Error('源码目录不存在 ' + config.srcDir);
  }
  if (!utils.isFile(config.srcDir + 'app.json')) {
    throw new Error('app.json 不存在');
  }

  let files = utils.getFileInfos(config.srcDir);

  mkdirp(config.tempDir);
  let metadataName = 'metadata';
  if (process.env.NODE_ENV === 'development') {
    metadataName += '-dev';
  }
  if (process.env.TEST) {
    metadataName += '-test';
  }
  if (process.env.NODE_ENV !== 'development' && !process.env.TEST && process.env.CATCH) {
    metadataName += '-catch';
  }
  let metadataPath = config.tempDir + metadataName + '.json';
  let metadata = {};
  if (!options.force && utils.isFile(metadataPath)) {
    metadata = utils.readJSON(metadataPath);
  }
  let to;
  let targets = {};
  for (let from of files) {
    to = path.join(config.distDir, path.relative(config.srcDir, from.dir), from.name + utils.getDistFileExt(from.ext));
    to = utils.getInfo(to);
    switch (from.ext) {
      case '.js':
        yield* buildJS(from, to, targets, metadata);
        break;
      case '.less':
        if (from.fromSrc === 'app.less' || utils.inPages(from.file)) {
          targets[to.file] = true;
          yield* buildLess(from, to);
        } else {
          console.log('ignore'.yellow, from.relative.gray);
        }
        break;
      case '.sass':
      case '.scss':
        if (from.fromSrc === 'app.sass' || from.fromSrc === 'app.scss' || utils.inPages(from.file)) {
          targets[to.file] = true;
          yield* buildSass(from, to);
        } else {
          console.log('ignore'.yellow, from.relative.gray);
        }
        break;
      case '.xml':
        if (utils.inPages(from.file)) {
          targets[to] = true;
          yield* buildXML(from, to);
        } else {
          console.log('ignore'.yellow, from.relative.gray);
        }
        break;
      default:
        targets[to] = true;
        console.log('copy'.green, from.relative.blue, '->', to.relative.cyan);
        mkdirp.sync(to.dir);
        cp(from.file, to.file);
    }
  }

  let distFiles = utils.getFileInfos(config.distDir);
  for (let file of distFiles) {
    if (!targets[file.file] && /\.js$/.test(file.file)) {
      utils.removeFile(file.file);
    }
  }
  utils.writeJson(metadataPath, metadata);

  if (process.env.MINIFY) {
    yield* minifyPage();
    yield* minifyJs();
  }
}


module.exports = function (options) {
  co(build(options)).then(() => {
    console.log('项目构建完成'.green);
  }, (error) => {
    console.log('项目构建失败!'.red);
    console.log(error.message);
    if (error.stack) {
      console.log(error.stack);
    }
  });
};
