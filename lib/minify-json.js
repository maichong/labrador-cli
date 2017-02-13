/**
 * Created by axetroy on 17-2-13.
 */
const path = require('path');
const fs = require('fs');

const pd = require('pretty-data').pd;
const config = require('./config')();
const globby = require('globby');
const co = require('co');

function *minifyWXML() {
  const pageFiles = path.join(config.distDir, 'pages/', '**', '**', '*.json');
  const distAllFiles = path.join(config.distDir, '**', '**', '*.json');

  let files = yield globby([
    pageFiles,
    distAllFiles
  ]);

  return new Promise(function (resolve, reject) {
    if (!files || !files.length) files = [];
    files.forEach(function (file) {
      let fileRaw = fs.readFileSync(file, {encoding: 'utf8'});
      let minifyData = pd.cssmin(fileRaw);
      fs.writeFileSync(file, minifyData);
      console.log('minify'.green, path.relative(config.workDir, file).blue);
    });
    resolve(files);
  });
}

module.exports = function *() {
  console.log('minify json...'.green);
  return co(minifyWXML)
    .then(function (files) {
      return Promise.resolve(files);
    })
    .catch(function (err) {
      console.log(err);
      return Promise.reject(err);
    })
};