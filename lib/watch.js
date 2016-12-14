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
const buildSass = require('./build-sass');
const buildXML = require('./build-xml');
require('shelljs/global');

function* watch(options) {
  const config = require('./config')(options);
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
      case '.sass':
      case '.scss':
        if ((from.fromSrc === 'app.sass') || (from.fromSrc === 'app.scss') || utils.inPages(from.file)) {
          let depends = yield* buildSass(from, to);
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
        if (utils.inPages(from.file) || utils.inTemplates(from.file)) {
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

module.exports = function (options) {
  co(watch(options)).then(() => {
  }, (error) => {
    console.error(error.stack);
    process.exit();
  });
};
