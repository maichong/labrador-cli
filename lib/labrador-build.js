/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const co = require('co');
const path = require('path');
const mkdirp = require('mkdirp');
const updateNotifier = require('update-notifier');
const utils = require('./utils');
const buildJS = require('./build-js');
const buildLess = require('./build-less');
const buildXML = require('./build-xml');
const minifyPage = require('./minify-page');
const minifyJs = require('./minify-js');
require('shelljs/global');
require('colors');

const program = require('commander');
program
  .version(require('../package.json').version)
  .option('-c, --catch', '在载入时自动catch所有JS脚本的错误')
  .option('-t, --test', '运行测试脚本')
  .option('-m, --minify', '压缩代码')
  .option('-f, --force', '强制构建，不使用缓存')
  .option('--work-dir [dir]', '工作目录，默认为当前目录')
  .option('--config [file]', '配置文件，默认为.labrador')
  .option('--src-dir [dir]', '源码目录，默认为工作目录下的src文件夹')
  .option('--dist-dir [dir]', '目标目录，默认为工作目录下的dist文件夹')
  .option('--modules-dir [dir]', 'NPM模块目录，默认为工作目录下的node_modules文件夹')
  .option('--temp-dir [dir]', '临时目录，默认为工作目录下的.build文件夹')
  .parse(process.argv);

const config = require('./config')(program);

function* build() {
  if (!utils.isDirectory(config.srcDir)) {
    throw new Error('源码目录不存在 ' + config.srcDir);
  }
  if (!utils.isFile(config.srcDir + 'app.json')) {
    throw new Error('app.json 不存在');
  }

  let pkg = require(path.join(config.modulesDir, 'labrador/package.json'));
  const notifier = updateNotifier({
    pkg,
    callback: function (error, update) {
      if (update && ['major', 'minor', 'patch'].indexOf(update.type) > -1) {
        notifier.update = update;
        notifier.notify({
          message: `Labardor update available ${update.current} → ${update.latest.green}\nRun ` + 'npm install --save labrador'.cyan + ' to update your project',
          defer: false
        });
      }
    }
  });

  let files = utils.getFileInfos(config.srcDir);

  mkdirp(config.tempDir);
  let metadataName = 'metadata';
  if (process.env.DEBUG) {
    metadataName += '-debug';
  }
  if (process.env.TEST) {
    metadataName += '-test';
  }
  if (!process.env.DEBUG && !process.env.TEST && process.env.CATCH) {
    metadataName += '-catch';
  }
  let metadataPath = config.tempDir + metadataName + '.json';
  let metadata = {};
  if (!program.force && utils.isFile(metadataPath)) {
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

co(build).then(() => {
  console.log('项目构建完成');
}, (error) => {
  console.log('项目构建失败!');
  console.log(error.message);
  if (error.stack) {
    console.log(error.stack);
  }
});

