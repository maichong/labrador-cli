/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const co = require('co');
const path = require('path');
const fs = require('fs');
const util = require('./util');
const buildJS = require('./build-js');
const buildLess = require('./build-less');
const buildXML = require('./build-xml');
require('shelljs/global');

const program = require('commander');
program
  .version(require('../package.json').version)
  .option('-t, --try-all', 'try-cache all code')
  .parse(process.argv);

if (program.tryAll) {
  process.env.TRY_ALL = true;
}

function getFiles(dir, sub) {
  let res = [];
  let list = fs.readdirSync(dir);
  if (sub) {
    sub += '/';
  }
  for (let name of list) {
    if (name[0] === '.') continue;
    let file = path.join(dir, name);
    if (util.isDirectory(file)) {
      res = res.concat(getFiles(file, sub + name))
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

function * build() {
  const dir = process.cwd() + '/';
  const dist = dir + 'dist/';
  if (!util.isDirectory(dir + 'src')) {
    throw new Error('src 目录不存在');
  }

  let files = getFiles(dir + 'src', '');

  let to;
  let ignores = {};
  for (let file of files) {
    switch (file.ext) {
      case '.js':
        yield buildJS(file.file, dist + file.path, false, ignores);
        break;
      case '.less':
        to = path.join(dist, path.dirname(file.path), file.name + '.wxss');
        yield buildLess(file.file, to);
        break;
      case '.xml':
        to = path.join(dist, path.dirname(file.path), file.name + '.wxml');
        yield buildXML(file.file, to);
        break;
      default:
        console.log('copy', file.file, dist + file.path);
        cp(file.file, dist + file.path);
    }
  }

}

co(build).then(function () {
  console.log('项目构建完成');
}, function (error) {
  console.log('项目构建失败!');
  console.log(error.stack ? error.stack : error.message);
});

