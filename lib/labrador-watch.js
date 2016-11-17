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
const utils = require('./utils');
const buildJS = require('./build-js');
const buildLess = require('./build-less');
const buildXML = require('./build-xml');
require('shelljs/global');

const program = require('commander');
program
  .version(require('../package.json').version)
  .option('-c, --catch', '在载入时自动catch所有JS脚本的错误')
  .option('-t, --test', '运行测试脚本')
  .option('--work-dir [dir]', '工作目录，默认为当前目录')
  .option('--config [file]', '配置文件，默认为.labrador')
  .option('--src-dir [dir]', '源码目录，默认为工作目录下的src文件夹')
  .option('--dist-dir [dir]', '目标目录，默认为工作目录下的dist文件夹')
  .option('--modules-dir [dir]', 'NPM模块目录，默认为工作目录下的node_modules文件夹')
  .option('--temp-dir [dir]', '临时目录，默认为工作目录下的.build文件夹')
  .parse(process.argv);

const config = require('./config')(program);

function* watch() {
  if (!utils.isDirectory(config.srcDir)) {
    throw new Error('src 目录不存在');
  }
  if (!utils.isFile(config.srcDir + 'app.json')) {
    throw new Error('src/app.json 不存在');
  }
  if (!utils.isFile(config.srcDir + 'app.js')) {
    throw new Error('src/app.js 不存在');
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

  let targets = {};
  let refs = {};

  function* buildFile(source) {
    let from = utils.getInfo(source);
    let to = path.join(config.distDir, path.relative(config.srcDir, from.dir), from.name + utils.getDistFileExt(from.ext));
    to = utils.getInfo(to);
    switch (from.ext) {
      case '.js':
        delete targets[to.file];
        yield* buildJS(from, to, targets, {});
        break;
      case '.less':
        if ((from.fromSrc === 'app.less') || utils.inPages(from.file)) {
          let depends = yield* buildLess(from, to);
          depends.forEach((d) => {
            d = path.normalize(d);
            if (!refs[d]) {
              refs[d] = {};
            }
            refs[d][from.file] = true;
          });
        } else if (refs[from.file]) {
          console.log('changed'.green, from.relative.blue);
          let files = Object.keys(refs[from.file]);
          for (let s of files) {
            yield* buildFile(s);
          }
        } else {
          console.log('ignore'.yellow, from.relative.gray);
        }
        break;
      case '.xml':
        if (utils.inPages(from.file)) {
          let depends = yield* buildXML(from, to);
          depends.forEach((d) => {
            d = path.normalize(d);
            if (!refs[d]) {
              refs[d] = {};
            }
            refs[d][from.file] = true;
          });
        } else if (refs[from.file]) {
          console.log('changed'.green, from.relative.blue);
          let files = Object.keys(refs[from.file]);
          for (let s of files) {
            yield* buildFile(s);
          }
        } else {
          console.log('ignore'.yellow, from.relative.gray);
        }
        break;
      default:
        console.log('copy'.green, from.relative.blue, '->', to.relative.cyan);
        mkdirp.sync(to.dir);
        cp(from.file, to.file);
    }
  }

  chokidar.watch(config.srcDir, { ignored: /^\./ }).on('all', (event, source) => {
    if (event === 'addDir') return;
    co(buildFile(source)).catch((error) => {
      console.log(error.codeFrame || error.stack || '');
    });
  });
}

co(watch()).then(() => {
}, (error) => {
  console.error(error.stack);
  process.exit();
});
