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
  const pageFiles = path.join(config.distDir, 'pages/', '**', '**', '*.wxml');
  const tplFiles = path.join(config.distDir, 'templates/', '**', '**', '*.wxml');
  const distAllFiles = path.join(config.distDir, '**', '**', '*.wxml');

  let files = yield globby([
    pageFiles,
    tplFiles,
    distAllFiles
  ]);

  return new Promise(function (resolve, reject) {
    if (!files || !files.length) files = [];
    files.forEach(function (file) {
      let fileRaw = fs.readFileSync(file, {encoding: 'utf8'});
      let minifyData = pd.xmlmin(fileRaw);
      fs.writeFileSync(file, minifyData);
      console.log('minify'.green, path.relative(config.workDir, file).blue);
    });
    resolve(files);
  });
}

module.exports = function *() {
  console.log('minify wxml...'.green);
  return co(minifyWXML)
    .then(function (files) {
      return Promise.resolve(files);
    })
    .catch(function (err) {
      console.log(err);
      return Promise.reject(err);
    })
};