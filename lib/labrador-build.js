/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const cwdPath = process.cwd() + '/';
const program = require('commander');
program
  .version(require('../package.json').version)
  .option('-c, --catch', '在载入时自动catch所有JS脚本的错误')
  .option('-t, --test', '运行测试脚本')
  .option('-d, --debug', 'DEBUG模式')
  .option('-m, --minify', '压缩代码')
  .option('-f, --force', '强制构建，不使用缓存')
  .option('-w --workdir [path]', '当前工作目录, 确保[当前目录]/node_modules下存在labrador和babel-core目录')
  .option('-t --dist [path]', '生成目录, 默认值:dist')
  .option('-s --src [path]', '源码目录, 默认值:src')
  .parse(process.argv);

if (program.minify) process.env.MINIFY = true;
if (program.catch) process.env.CATCH = true;
if (program.test) {
  process.env.TEST = true;
  process.env.CATCH = true;
}
if (program.debug) {
  process.env.DEBUG = true;
  process.env.CATCH = true;
}
process.env.DIST = program.dist || 'dist';
process.env.SRC = program.src || 'src';
process.env.WORKDIR = program.workdir || '';



const co = require('co');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const updateNotifier = require('update-notifier');
const util = require('./util');
const buildJS = require('./build-js');
const buildLess = require('./build-less');
const buildXML = require('./build-xml');
const minifyPage = require('./minify-page');
require('shelljs/global');
require('colors');

function getFiles(dir, sub) {
  let res = [];
  let list = fs.readdirSync(dir);
  if (sub) {
    sub += '/';
  } else {
    sub = '';
  }
  for (let name of list) {
    if (name[0] === '.') continue;
    let file = path.join(dir, name);
    if (util.isDirectory(file)) {
      res = res.concat(getFiles(file, sub + name));
    } else {
      let info = path.parse(file);
      res.push({
        file: file,
        path: sub + name,
        name: info.name,
        ext: info.ext,
        dir: info.dir
      });
    }
  }
  return res;
}

function* build() {
  const dist = cwdPath + process.env.DIST+'/';
  //const lib = dir + process.env.DIST + '/lib/';
  if (!util.isDirectory(cwdPath + process.env.SRC)) {
    throw new Error(process.env.SRC + ' 目录不存在');
  }
  if (!util.isFile(cwdPath + process.env.SRC + '/app.json')) {
    throw new Error(process.env.SRC + '/app.json 不存在');
  }
  if (!util.isFile(cwdPath + process.env.SRC + '/app.js')) {
    throw new Error(process.env.SRC + '/app.js 不存在');
  }

  let pkg = require(path.join(cwdPath, '/' + process.env.WORKDIR + '/node_modules/labrador/package.json'));
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

  let files = getFiles(cwdPath + process.env.SRC, '');

  mkdirp(cwdPath + '.build');
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
  let metadataPath = cwdPath + '.build/' + metadataName + '.json';
  let metadata = {};
  if (!program.force && util.isFile(metadataPath)) {
    metadata = util.readJSON(metadataPath);
  }
  let to;
  let ignores = {};
  let targets = {};
  for (let file of files) {
    switch (file.ext) {
      case '.js':
        yield buildJS(file.file, path.normalize(dist + file.path), targets, metadata);
        break;
      case '.less':
        if (file.path === 'app.less' || file.path.startsWith('pages')) {
          to = path.join(dist, path.dirname(file.path), file.name + '.wxss');
          targets[to] = true;
          yield buildLess(file.file, to);
        } else {
          console.log('ignore'.yellow, file.path.gray);
        }
        break;
      case '.xml':
        if (file.path.startsWith('pages')) {
          to = path.join(dist, path.dirname(file.path), file.name + '.wxml');
          targets[to] = true;
          yield buildXML(file.file, to);
        } else {
          console.log('ignore'.yellow, file.path.gray);
        }
        break;
      default:
        to = dist + file.path;
        targets[to] = true;
        console.log('copy'.green, path.relative(cwdPath, file.file).blue, '->', path.relative(cwdPath, to).cyan);
        mkdirp.sync(path.dirname(to));
        cp(file.file, to);
    }
  }

  for (let target in targets) {
    delete targets[target];
    targets[path.join(target)] = true;
  }

  let distFiles = getFiles(dist);
  for (let file of distFiles) {
    if (!targets[file.file]) {
      console.log('remove'.red, path.relative(cwdPath, file.file));
      rm(file.file);
      let dir = path.dirname(file.file);
      if (!fs.readdirSync(dir).length) {
        console.log('remove'.red, path.relative(cwdPath, dir));
        rm('-R', dir);
      }
    }
  }
  util.writeJson(metadataPath, metadata);

  if (process.env.MINIFY) {
    yield co(minifyPage());
  }
}

co(build).then(function () {
  console.log('项目构建完成');
}, function (error) {
  console.log('项目构建失败!');
  console.log(error.message);
  if (error.stack) {
    console.log(error.stack);
  }
});

