/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-11-17
 * @author Liang <liang@maichong.it>
 */

'use strict';

require('colors');
const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const UglifyJS = require('uglify-js');
const slash = require('slash');
const config = require('./config')();

require('shelljs/global');

module.exports = function* minifyJs() {
  console.log('minify js...'.green);

  const distPagesDir = config.distDir + 'pages/';

  let pages = [config.distDir + 'app.js'].concat(utils.getJsFiles(distPagesDir)).map(file => path.normalize(file));

  let fileMap = {};
  let codeArray = [];

  function compile(file) {
    let code = fs.readFileSync(file, 'utf8');

    code = code.replace(/([\s;]?)require\(['"]([\w\_\-\.\/\@]+)['"]\)/g, function (matchs, char, ref) {
      let refFile = path.normalize(path.join(path.dirname(file), ref));
      if (fileMap[refFile] === undefined) {
        fileMap[refFile] = compile(refFile);
      }
      return char + `__labrador_require__(${fileMap[refFile]})`;
    });

    code = `function (module, exports, __labrador_require__) {\n//START ${path.relative(config.distDir, file)}\n${code}\n//END\n}\n`;

    codeArray.push(code);
    fileMap[file] = codeArray.length - 1;
    //console.log(codeArray.length - 1, file);
    return fileMap[file];
  }

  pages.forEach((file) => {
    compile(file);
  });

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
  TypeError: TypeError,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval
};
${code}
})()`;

  fs.writeFileSync(config.distDir + 'm.js', code);
  try {
    code = UglifyJS.minify(code, Object.assign({}, config.uglify, { fromString: true })).code;
  } catch (error) {
    console.log(error);
    throw error;
  }

  utils.getJsFiles(config.distDir).forEach((f) => utils.removeFile(f));

  pages.forEach((f) => {
    let r = path.relative(path.dirname(f), config.distDir + 'm.js');
    let fragment = `require('${slash(r)}')(${fileMap[f]})`;
    console.log('update'.green + ' ' + path.relative(config.workDir, f).blue);
    fs.writeFileSync(f, fragment);
  });

  console.log('create'.green, path.relative(config.workDir, config.distDir + 'm.js').blue);
  fs.writeFileSync(config.distDir + 'm.js', code);
};
