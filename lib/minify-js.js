/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-11-17
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const util = require('./util');
const UglifyJS = require('uglify-js');
const config = require('./config');

require('shelljs/global');

const cwdPath = process.cwd() + '/';
const distPath = cwdPath + 'dist/';
const pagesPath = distPath + 'pages/';

function getFiles(dir, res) {
  res = res || [];
  let files = fs.readdirSync(dir);
  for (let file of files) {
    if (util.isDirectory(dir + '/' + file)) {
      res = res.concat(getFiles(dir + '/' + file));
    } else if (/\.js$/.test(file)) {
      res.push(dir + '/' + file);
    }
  }
  return res;
}

function removeEmptyDir(dir) {
  if (!fs.readdirSync(dir).length) {
    console.log('remove'.red, path.relative(cwdPath, dir));
    rm('-R', dir);
    removeEmptyDir(path.dirname(dir));
  }
}

function removeFile(file) {
  rm(file);
  removeEmptyDir(path.dirname(file));
}

module.exports = function* minifyJs() {
  console.log('minify js...'.green);

  let pages = [distPath + 'app.js'].concat(getFiles(pagesPath)).map(file => path.normalize(file));
  //console.log(pages);

  let fileMap = {};
  let codeArray = [];

  function compile(file) {
    let code = fs.readFileSync(file, 'utf8');

    code = code.replace(/([\s;]?)require\(['"]([\w\_\-\.\/]+)['"]\)/g, function (matchs, char, ref) {
      let refFile = path.normalize(path.join(path.dirname(file), ref));
      if (fileMap[refFile] === undefined) {
        //console.log(refFile);
        fileMap[refFile] = compile(refFile);
      }
      return char + `__labrador_require__(${fileMap[refFile]})`;
    });

    code = `function (module, exports, __labrador_require__) {\n//START ${path.relative(distPath, file)}\n${code}\n//END\n}\n`;

    codeArray.push(code);
    fileMap[file] = codeArray.length - 1;
    //console.log(codeArray.length - 1, file);
    return fileMap[file];
  }

  pages.forEach((file) => {
    compile(file);
  });

  // console.log(fileMap);
  // console.log(codeArray);

  let code = `module.exports=(function(modules) {
  var installedModules = {};

  function __labrador_require__(moduleId) {
    if (installedModules[moduleId])
      return installedModules[moduleId].exports;
    var module = installedModules[moduleId] = {
      exports: {},
      id: moduleId,
      loaded: false
    };
    modules[moduleId].call(module.exports, module, module.exports, __labrador_require__);
    module.loaded = true;
    return module.exports;
  }

  __labrador_require__.m = modules;
  __labrador_require__.c = installedModules;
  __labrador_require__.p = "/assets/";
  return __labrador_require__;
})([` + codeArray.join(',') + ']);';

  code = code.replace(/function _interopRequireDefault\(obj\) \{ return obj && obj\.__esModule \? obj : \{ default: obj \}; }/g, '');
  code = 'function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }\n' + code;

  code = code.replace(/__esModule/g, '_E');

  code = `'use strict';(function(){
var window;
var global=window={
  Array: Array,
  Date: Date,
  Error: Error,
  Function: Function,
  Math: Math,
  Object: Object,
  RegExp: RegExp,
  String: String,
  TypeError: TypeError
};
${code}
})()`;

  fs.writeFileSync(distPath + 'm.js', code);
  try {
    code = UglifyJS.minify(code, Object.assign({}, config.uglify, { fromString: true })).code;
  } catch (error) {
    console.log(error);
    throw error;
  }

  getFiles(distPath).forEach((f) => removeFile(f));

  pages.forEach((f) => {
    let r = path.relative(path.dirname(f), distPath + 'm.js');
    let fragment = `require('${r}')(${fileMap[f]})`;
    console.log('update'.green + ' ' + path.relative(cwdPath, f).blue);
    fs.writeFileSync(f, fragment);
  });

  console.log('create'.green, 'dist/m.js'.blue);
  fs.writeFileSync(distPath + 'm.js', code);
};
