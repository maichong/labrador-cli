/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-10-19
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const radix64 = require('radix64').radix64;
const CleanCSS = require('clean-css');
const util = require('./util');
const config = require('./config');

const distPath = path.join(process.cwd(), 'dist') + '/';
const pagesPath = path.join(process.cwd(), 'dist/pages') + '/';

let _id = 0;
function createId() {
  _id++;
  let str = radix64(_id);
  if (/^[\d_-]/.test(str) || /[-_]$/.test(str)) {
    return createId();
  }
  return str;
}

function minifyApp(appNameMap, appContentMap) {
  let file = distPath + 'app.wxss';
  if (!util.isFile(file)) {
    return;
  }
  let minified = new CleanCSS({ keepBreaks: true }).minify(fs.readFileSync(file, 'utf8')).styles;
  let finalCssContent = '';
  minified.split('\n').forEach(function (line) {
    let index = line.indexOf('{');
    let selectors = line.substr(0, index).split(',');
    let content = line.substr(index);

    selectors.forEach(function (selector) {
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
      // styles.push({ selector, content, className });
      // styleClassNames[className] = true;
    });
  });

  //console.log('---------');
  //process.exit();

  return function () {
    //console.log(appNameMap, appContentMap);
    console.log('minify'.green, path.normalize('dist/app.wxss').blue);
    for (let c in appContentMap) {
      let keys = [];
      appContentMap[c].forEach(function (key) {
        if (appNameMap[key].id) {
          keys.push('.' + appNameMap[key].id);
          console.log(('\t.' + key).blue, '->', ('.' + appNameMap[key].id).cyan);
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
    if (util.isDirectory(filePath)) {
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

function minify(page, appNameMap, appContentMap) {
  let cssContent = '';
  let xmlContent = fs.readFileSync(page.wxml, 'utf8');
  if (util.isFile(page.wxss)) {
    cssContent = fs.readFileSync(page.wxss, 'utf8');
  }
  if (cssContent) {
    cssContent = new CleanCSS({ keepBreaks: true }).minify(cssContent).styles;
  }
  let styleClassNames = {};
  let pageContentMap = {};
  let finalCssContent = '';
  cssContent.split('\n').forEach(function (line) {
    let index = line.indexOf('{');
    let selectors = line.substr(0, index).split(',');
    let content = line.substr(index);

    selectors.forEach(function (selector) {
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
  let xmlClassNames = {};
  let clsNameMap = {};
  xmlContent = xmlContent.replace(/[\r\n]\s+</g, '\n<').replace(/<!--[^>]+-->/g, '');
  xmlContent = xmlContent.replace(/ class="([^"]+)"/g, function (matchs, names) {
    names = names.split(' ').filter(function (name) {
      if (!name) return false;
      if (name.indexOf('{') > -1) return true;
      if (config.classNames && config.classNames[name]) return true;
      if (appNameMap[name]) {
        appNameMap[name].used = true;
        if (!appNameMap[name].id) {
          appNameMap[name].id = createId();
        }
      }
      if (styleClassNames[name] || appNameMap[name]) {
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
      }
      clsNameMap[name] = id;
      return id;
    });

    if (names.length) {
      return ' class="' + names.join(' ') + '"';
    }
    return '';
  });

  if (cssContent) {
    console.log('minify'.green, path.relative(process.cwd(), page.wxss).blue);
    for (let c in pageContentMap) {
      let keys = [];
      pageContentMap[c].forEach(function (key) {
        if (clsNameMap[key]) {
          if (appContentMap[c] && appContentMap[c].indexOf(key) > -1) {
            //如果app.wxss中已经存在完全一模一样的记录，则忽略本条
            return;
          }
          keys.push('.' + clsNameMap[key]);
          console.log(('\t.' + key).blue, '->', ('.' + clsNameMap[key]).cyan);
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
  let appNameMap = {};
  let appContentMap = {};
  let output = minifyApp(appNameMap, appContentMap);
  //console.log('clsContentMap', appContentMap);
  let pages = findPages(pagesPath);
  for (let page of pages) {
    console.log('minify'.green, path.relative(process.cwd(), page.wxml).blue);
    minify(page, appNameMap, appContentMap);
  }
  output();
};
