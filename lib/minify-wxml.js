/**
 * Created by axetroy on 17-2-13.
 */
const path = require('path');
const fs = require('fs');

const pd = require('pretty-data').pd;
const config = require('./config')();
const glob = require('glob');
const co = require('co');
const utils = require('./utils');

function *minifyWXML() {
  const srcFiles = path.join(config.distDir, 'pages/', '**', '**', '*.wxml');

  return new Promise(function (resolve, reject) {
    // options is optional
    glob(srcFiles, {}, function (err, files) {
      if (err) return reject(err);
      if (!files || !files.length) return resolve(null);
      files.forEach(function (file) {
        let fileRaw = fs.readFileSync(file, {encoding: 'utf8'});
        let minifyData = pd.xmlmin(fileRaw);
        fs.writeFileSync(file, minifyData);
        console.log('minify'.green, path.relative(config.workDir, file).blue);
      });
      resolve(files);
    });
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