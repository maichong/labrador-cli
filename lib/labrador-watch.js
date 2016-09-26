/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const chokidar = require('chokidar');
const co = require('co');
const path = require('path');
const util = require('./util');
const buildJS = require('./build-js');
const buildLess = require('./build-less');
const buildXML = require('./build-xml');
const src = process.cwd() + '/src/';
const dist = process.cwd() + '/dist/';
require('shelljs/global');

const program = require('commander');
program
  .version(require('../package.json').version)
  .option('-t, --try-all', 'try-cache all code')
  .parse(process.argv);

if (program.tryAll) {
  process.env.TRY_ALL = true;
}

function *watch() {
  if (!util.isDirectory(src)) {
    throw new Error(src + ' is not exist');
  }
  chokidar.watch(src, { ignored: /^\./ }).on('all', (event, source) => {
    if (event === 'addDir') return;
    let relative = path.relative(src, source);
    let file = path.parse(relative);
    let to;
    switch (file.ext) {
      case '.js':
        co(buildJS(source, path.join(dist, relative)));
        break;
      case '.less':
        to = path.join(dist, file.dir, file.name + '.wxss');
        co(buildLess(source, to));
        break;
      case '.xml':
        to = path.join(dist, file.dir, file.name + '.wxml');
        co(buildXML(source, to));
        break;
      default:
        console.log('copy', source, dist + relative);
        cp(source, dist + relative);
    }
  });
}

co(watch()).then(function () {
}, function (error) {
  console.error(error.stack);
  process.exit();
});
