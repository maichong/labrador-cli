/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-10-19
 * @author Liang <liang@maichong.it>
 */

'use strict';

require('colors');
const fs = require('fs');
const path = require('path');
const radix64 = require('radix64').radix64;
const CleanCSS = require('clean-css');
const utils = require('./utils');
const config = require('./config')();

let _id = 0;
function createId() {
  _id++;
  let str = radix64(_id);
  if (/^[\d_-]/.test(str) || /[-_]$/.test(str)) {
    return createId();
  }
  return str;
}

/**
 * 压缩app.less
 * @param appNameMap
 * @param appContentMap
 * @returns {Function}
 */
function minifyApp(appNameMap, appContentMap) {
  let file = config.distDir + 'app.wxss';
  if (!utils.isFile(file)) {
    return;
  }
  let minified = new CleanCSS({ keepBreaks: true }).minify(fs.readFileSync(file, 'utf8')).styles;
  minified = minified.replace(/::?(after|before|first\-child|last\-child)/g, ':$1');
  let finalCssContent = '';
  minified.split('\n').forEach((line) => {
    let index = line.indexOf('{');
    let selectors = line.substr(0, index).split(',');
    let content = line.substr(index);

    selectors.forEach((selector) => {
      if (selector[0] !== '.') {
        finalCssContent += selector + content + '\n';
        return;
      }
      let className = selector.substr(1);
      if (!appNameMap[className]) {
        appNameMap[className] = {
          id: '',
          contents: []
        };
      }
      appNameMap[className].contents.push(content);
      if (!appContentMap[content]) {
        appContentMap[content] = [];
      }
      appContentMap[content].push(className);
    });
  });

  return function () {
    //console.log(appNameMap, appContentMap);
    console.log('minify'.green, path.normalize('dist/app.wxss').blue);
    for (let key in appNameMap) {
      let matchs = key.match(/(.*):+(after|before|first\-child|last\-child)$/);
      if (matchs && appNameMap[matchs[1]] && appNameMap[matchs[1]].id) {
        appNameMap[key].id = appNameMap[matchs[1]].id + ':' + matchs[2];
      }
    }
    for (let c in appContentMap) {
      let keys = [];
      appContentMap[c].forEach((key) => {
        if (appNameMap[key].id) {
          keys.push('.' + appNameMap[key].id);
          console.log(('\t.' + key).blue, '->', ('.' + appNameMap[key].id).cyan);
        } else if (config.classNames && config.classNames[key]) {
          keys.push('.' + key);
          console.log(('\t.' + key).blue, '->', ('.' + key).cyan);
        }
      });
      if (keys.length) {
        finalCssContent += keys.join(',') + c + '\n';
      }
    }
    finalCssContent = new CleanCSS({ keepBreaks: true }).minify(finalCssContent).styles;
    fs.writeFileSync(file, finalCssContent);
  };
}

function findPages(dir) {
  let files = fs.readdirSync(dir);
  let res = [];
  for (let file of files) {
    let filePath = path.join(dir, file);
    if (utils.isDirectory(filePath)) {
      res = res.concat(findPages(filePath));
      continue;
    }
    let info = path.parse(filePath);
    if (info.ext === '.wxml') {
      res.push({
        wxml: filePath,
        wxss: path.join(info.dir, info.name + '.wxss')
      });
    }
  }
  return res;
}

/**
 * 压缩页面
 * @param {Object} page
 * @param {Object} appNameMap
 * @param {Object} appContentMap
 */
function minify(page, appNameMap, appContentMap) {
  let cssContent = '';
  let xmlContent = fs.readFileSync(page.wxml, 'utf8');
  if (utils.isFile(page.wxss)) {
    cssContent = fs.readFileSync(page.wxss, 'utf8');
  }
  if (cssContent) {
    cssContent = new CleanCSS({ keepBreaks: true }).minify(cssContent).styles;
    cssContent = cssContent.replace(/::?(after|before|first\-child|last\-child)/g, ':$1');
  }
  // LESS中存在的className列表
  let styleClassNames = {};
  // LESS中 content -> className 映射
  let pageContentMap = {};
  let finalCssContent = '';
  cssContent.split('\n').forEach((line) => {
    let index = line.indexOf('{');
    let selectors = line.substr(0, index).split(',');
    let content = line.substr(index);

    selectors.forEach((selector) => {
      if (selector[0] !== '.') {
        finalCssContent += selector + content + '\n';
        return;
      }
      let className = selector.substr(1);
      if (!pageContentMap[content]) {
        pageContentMap[content] = [];
      }
      styleClassNames[className] = true;
      pageContentMap[content].push(className);
      //styles.push({ selector, content, className });
    });
  });
  // console.log('styleClassNames', styleClassNames);
  // console.log('pageContentMap', pageContentMap);
  // console.log('cssContent', cssContent);
  let xmlClassNames = {};
  let clsNameMap = {};
  xmlContent = xmlContent.replace(/[\r\n]\s+</g, '\n<').replace(/<!--[^>]+-->/g, '');
  xmlContent = xmlContent.replace(/ class="([^"]+)"/g, (matchs, names) => {
    names = names.replace(/{{([^}]+)}}/g, function (m, words) {
      return '{{' + (new Buffer(words, 'utf8')).toString('hex') + '}}';
    });
    names = names.split(' ').filter((name) => {
      if (!name) return false;
      if (name.indexOf('{') > -1) return true;
      if (config.classNames && config.classNames[name]) return true;
      if (appNameMap[name]) {
        appNameMap[name].used = true;
        if (!appNameMap[name].id) {
          appNameMap[name].id = createId();
        }
      }
      if (
        styleClassNames[name]
        || styleClassNames[name + ':before']
        || styleClassNames[name + ':after']
        || styleClassNames[name + ':first-child']
        || styleClassNames[name + ':last-child']
        || appNameMap[name]
        || appNameMap[name + ':before']
        || appNameMap[name + ':after']
        || appNameMap[name + ':first-child']
        || appNameMap[name + ':last-child']
      ) {
        xmlClassNames[name] = true;
        return true;
      }
      return false;
    }).map(function (name) {
      if (name.indexOf('{') > -1) return name;
      if (config.classNames && config.classNames[name]) {
        clsNameMap[name] = name;
        if (appNameMap[name]) {
          appNameMap[name].id = name;
        } else if (appNameMap[name + ':before'] || appNameMap[name + ':after'] || appNameMap[name + ':first-child'] || appNameMap[name + ':lasr-child']) {
          // 如果app.less中存在 .name:before 或 .name:after 但是不存在 .name，自动添加 .name
          appNameMap[name] = { id: name, contents: ['{}'] };
        }
        return name;
      }
      if (clsNameMap[name]) {
        return clsNameMap[name];
      }
      let id;
      if (appNameMap[name]) {
        id = appNameMap[name].id;
      } else {
        id = createId();
        // 如果app.less中存在 .name:before 或 .name:after 但是不存在 .name，自动添加 .name
        if (appNameMap[name + ':before'] || appNameMap[name + ':after'] || appNameMap[name + ':first-child'] || appNameMap[name + ':last-child']) {
          appNameMap[name] = { id, contents: ['{}'] };
        }
      }
      clsNameMap[name] = id;
      return id;
    });

    if (names.length) {
      // 返回替换后的class name输出到XML中
      return ' class="' + names.join(' ').replace(/{{([\da-f]+)}}/g,
          (m, hex) => {
            return '{{' + new Buffer(hex, 'hex').toString('utf8') + '}}';
          }) + '"';
    }
    return '';
  });

  if (cssContent) {
    console.log('minify'.green, path.relative(process.cwd(), page.wxss).blue);
    for (let c in pageContentMap) {
      // c 为样式定义content '{foo:bar}'
      let keys = [];
      pageContentMap[c].forEach((key) => {
        // key 为className

        if (appContentMap[c] && appContentMap[c].indexOf(key) > -1) {
          //如果app.wxss中已经存在完全一模一样的记录，则忽略本条
          return;
        }

        let matchs = key.match(/(.*):(after|before|first\-child|last\-child)$/);
        if (matchs && clsNameMap[matchs[1]]) {
          //如果是伪类
          keys.push('.' + clsNameMap[matchs[1]] + ':' + matchs[2]);
          return;
        }

        if (clsNameMap[key]) {
          // 如果页面XML文件中有对应className引用

          keys.push('.' + clsNameMap[key]);
          console.log(('\t.' + key).blue, '->', ('.' + clsNameMap[key]).cyan);
        } else if (config.classNames[key]) {
          // 如果配置文件中要求保留此类名

          keys.push('.' + key);
          console.log(('\t.' + key).blue, '->', ('.' + key).cyan);
        }
      });
      if (keys.length) {
        finalCssContent += keys.join(',') + c + '\n';
      }
    }
  }

  fs.writeFileSync(page.wxml, xmlContent);
  if (finalCssContent) {
    finalCssContent = new CleanCSS({ keepBreaks: true }).minify(finalCssContent).styles;
    fs.writeFileSync(page.wxss, finalCssContent);
  }
}

module.exports = function* minifyPage() {
  console.log('minify page...'.green);
  let appNameMap = {};
  let appContentMap = {};
  let output = minifyApp(appNameMap, appContentMap);
  let pages = findPages(config.distDir + 'pages');
  for (let page of pages) {
    console.log('minify'.green, path.relative(config.workDir, page.wxml).blue);
    minify(page, appNameMap, appContentMap);
  }
  output();
};
