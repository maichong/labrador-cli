/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-25
 * @author Liang <liang@maichong.it>
 */

'use strict';

const program = require('commander');

program
  .version(require('../package.json').version)
  .command('init', 'init a labrador project')
  .command('build', 'build project')
  .command('watch', 'watch project files')
  .parse(process.argv);
