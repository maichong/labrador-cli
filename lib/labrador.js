/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const program = require('commander');
const pkg = require('../package.json');

program
  .version(pkg.version);

program
  .command('create <name>')
  .description('创建新项目')
  .alias('c')
  .action((name, options) => {
    require('./create')(name, options);
  });

program
  .command('init [options]', '在当前目录初始化项目')
  .command('build [options]', '编译项目')
  .command('watch [options]', '监测文件变化');

program
  .command('generate <type> <name>')
  .description('创建新组件、页面、Redux、Saga等等')
  .alias('g')
  .option('--work-dir [dir]', '工作目录，默认为当前目录')
  .option('--config [file]', '配置文件，默认为.labrador')
  .option('--src-dir [dir]', '源码目录，默认为工作目录下的src文件夹')
  .action((type, name, options) => {
    switch (type) {
      case 'page':
        require('./generate-page')(name, options);
        return;
      case 'component':
        require('./generate-component')(name, options);
        return;
      case 'redux':
        require('./generate-redux')(name, options);
        return;
      case 'saga':
        require('./generate-saga')(name, options);
        return;
    }
    console.log('Unknown type to generate');
  });

program.parse(process.argv);

if (!program.args.length) program.help();

const updateNotifier = require('update-notifier');

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

