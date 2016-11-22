/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const co = require('co');
const program = require('commander');
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


program
  .version(pkg.version);

program
  .command('create <name>')
  .alias('c')
  .description('创建新项目')
  .action((name, options) => {
    require('./create')(name, options);
  });

program
  .command('generate <type> <name>')
  .alias('g')
  .description('创建新组件、页面、Redux、Saga等等')
  .option('--work-dir [dir]', '工作目录，默认为当前目录')
  .option('--config [file]', '配置文件，默认为.labrador')
  .option('--src-dir [dir]', '源码目录，默认为工作目录下的src文件夹')
  .option('--scss', '使用scss，默认为less')
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

program
  .command('build')
  .alias('b')
  .description('编译当前项目')
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
  .action((options) => {
    require('./build')(options);
  });

program
  .command('watch')
  .alias('w')
  .description('编译当前项目并检测文件改动')
  .option('-c, --catch', '在载入时自动catch所有JS脚本的错误')
  .option('-t, --test', '运行测试脚本')
  .option('--work-dir [dir]', '工作目录，默认为当前目录')
  .option('--config [file]', '配置文件，默认为.labrador')
  .option('--src-dir [dir]', '源码目录，默认为工作目录下的src文件夹')
  .option('--dist-dir [dir]', '目标目录，默认为工作目录下的dist文件夹')
  .option('--modules-dir [dir]', 'NPM模块目录，默认为工作目录下的node_modules文件夹')
  .option('--temp-dir [dir]', '临时目录，默认为工作目录下的.build文件夹')
  .action((options) => {
    require('./watch')(options);
  });

program
  .command('minify-page')
  .description('minify page')
  .option('--work-dir [dir]', '工作目录，默认为当前目录')
  .option('--config [file]', '配置文件，默认为.labrador')
  .option('--src-dir [dir]', '源码目录，默认为工作目录下的src文件夹')
  .option('--dist-dir [dir]', '目标目录，默认为工作目录下的dist文件夹')
  .option('--modules-dir [dir]', 'NPM模块目录，默认为工作目录下的node_modules文件夹')
  .option('--temp-dir [dir]', '临时目录，默认为工作目录下的.build文件夹')
  .action((options) => {
    require('./utils');
    require('./config')(options);
    let minifyPage = require('./minify-page');
    co(minifyPage).then(() => console.log('done'), (error) => console.error(error));
  });

program
  .command('minify-js')
  .description('minify js')
  .option('--work-dir [dir]', '工作目录，默认为当前目录')
  .option('--config [file]', '配置文件，默认为.labrador')
  .option('--src-dir [dir]', '源码目录，默认为工作目录下的src文件夹')
  .option('--dist-dir [dir]', '目标目录，默认为工作目录下的dist文件夹')
  .option('--modules-dir [dir]', 'NPM模块目录，默认为工作目录下的node_modules文件夹')
  .option('--temp-dir [dir]', '临时目录，默认为工作目录下的.build文件夹')
  .action((options) => {
    require('./utils');
    require('./config')(options);
    let minifyJs = require('./minify-js');
    co(minifyJs).then(() => console.log('done'), (error) => console.error(error));
  });

program.parse(process.argv);

if (!program.args.length) program.help();
