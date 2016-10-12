/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const chokidar = require('chokidar');
const co = require('co');
const path = require('path');
const mkdirp = require('mkdirp');
const updateNotifier = require('update-notifier');
const util = require('./util');
const buildJS = require('./build-js');
const buildLess = require('./build-less');
const buildXML = require('./build-xml');
require('shelljs/global');

const src = process.cwd() + '/src/';
const dist = process.cwd() + '/dist/';
const cwd = process.cwd();

const program = require('commander');
program
  .version(require('../package.json').version)
  .option('-c, --catch', '在载入时自动catch所有JS脚本的错误')
  .option('-t, --test', '运行测试脚本')
  .option('-d, --debug', 'DEBUG模式')
  .option('-m, --minify', 'uglify压缩代码')
  .parse(process.argv);

if (program.minify) {
  process.env.MINIFY = true;
}
if (program.catch) {
  process.env.CATCH = true;
}
if (program.test) {
  process.env.CATCH = true;
  process.env.TEST = true;
}
if (program.debug) {
  process.env.DEBUG = true;
  process.env.TEST = true;
}

function* watch() {
  if (!util.isDirectory(src)) {
    throw new Error('src 目录不存在');
  }
  if (!util.isFile(src + 'app.json')) {
    throw new Error('src/app.json 不存在');
  }
  if (!util.isFile(src + 'app.js')) {
    throw new Error('src/app.js 不存在');
  }

  let pkg = require(path.join(cwd, 'node_modules/labrador/package.json'));
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

  let ignores = {};
  chokidar.watch(src, { ignored: /^\./ }).on('all', (event, source) => {
    if (event === 'addDir') return;
    let relative = path.relative(src, source);
    let file = path.parse(relative);
    let to;
    switch (file.ext) {
      case '.js':
        co(buildJS(source, path.join(dist, relative), ignores)).catch(error => console.log(error.message, error.codeFrame || ''));
        break;
      case '.less':
        if ((!file.dir && file.base === 'app.less') || file.dir.startsWith('pages')) {
          to = path.join(dist, file.dir, file.name + '.wxss');
          co(buildLess(source, to)).catch(error => console.log(error.message));
        } else {
          console.log('ignore'.yellow, path.join('src', relative).gray);
        }
        break;
      case '.xml':
        if (file.dir.startsWith('pages')) {
          to = path.join(dist, file.dir, file.name + '.wxml');
          co(buildXML(source, to)).catch(error => console.log(error.message));
        } else {
          console.log('ignore'.yellow, path.join('src', relative).gray);
        }
        break;
      default:
        to = dist + relative;
        console.log('copy'.green, path.relative(cwd, source).blue, '->', path.relative(cwd, to).cyan);
        mkdirp.sync(path.dirname(to));
        cp(source, to);
    }
  });
}

co(watch()).then(function () {
}, function (error) {
  console.error(error.stack);
  process.exit();
});
