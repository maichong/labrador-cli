/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-11-21
 * @author Liang <liang@maichong.it>
 */

'use strict';

require('colors');
require('shelljs/global');
const path = require('path');
const utils = require('./utils');
const download = require('download-github-repo');
const execSync = require('child_process').execSync;

function create(name, options) {
  let rootDir = path.join(process.cwd(), name);
  if (utils.isDirectory(rootDir)) {
    console.error(`项目创建失败："${rootDir}" 已经存在`.red);
    process.exit();
  }

  console.log('下载初始项目...'.green);
  download('maichong/labrador-demo', rootDir, () => {
    console.log('下载完毕'.green);

    let pkgFile = path.join(rootDir, 'package.json');
    let pkg = utils.readJSON(pkgFile);
    pkg.name = name;
    utils.writeJson(pkgFile, pkg);

    console.log('安装npm依赖'.green);
    execSync((which('yarn') ? 'yarn install' : 'npm install'), {
      cwd: rootDir,
      stdio: ['inherit', 'inherit', 'inherit'],
      env: Object.assign({
        NPM_CONFIG_LOGLEVEL: 'http',
        NPM_CONFIG_PROGRESS: 'false',
        NPM_CONFIG_COLOR: 'false'
      }, process.env)
    });
    console.log('构建项目...'.green);
    execSync('labrador build', {
      cwd: rootDir,
      stdio: ['inherit', 'inherit', 'inherit']
    });
  });
}

module.exports = create;
