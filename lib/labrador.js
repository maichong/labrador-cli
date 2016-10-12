/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const program = require('commander');

program
  .version(require('../package.json').version)
  .command('init', '在当前目录初始化项目')
  .command('build', '编译项目')
  .command('watch', '监测文件变化')
  .parse(process.argv);

const updateNotifier = require('update-notifier');
const pkg = require('../package.json');

const notifier = updateNotifier({
  pkg,
  callback: function (error, update) {
    if (update && ['major', 'minor', 'patch'].indexOf(update.type) > -1) {
      notifier.update = update;
      notifier.notify({
        defer: false
      });
    }
  }
});

