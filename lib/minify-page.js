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

function minifyApp(clsMap, clsMapReverse) {
  let file = distPath + 'app.wxss';
  if (!util.isFile(file)) {
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  let minified = new CleanCSS({ keepBreaks: true }).minify(content).styles;
  minified = minified.replace(/\.([a-z_][\w\d\_\-]*)([\{\,])/ig, function (matchs, cls, char) {
    if (!clsMap[cls]) {
      let id = createId();
      clsMap[cls] = id;
      clsMapReverse[id] = cls;
    }
    return '.' + clsMap[cls] + char;
  });
  fs.writeFileSync(file, minified);
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

function minify(page, clsMap, clsMapReverse) {
  let cssContent = '';
  let xmlContent = fs.readFileSync(page.wxml, 'utf8');
  if (util.isFile(page.wxss)) {
    cssContent = fs.readFileSync(page.wxss, 'utf8');
  }
  if (cssContent) {
    cssContent = new CleanCSS({ keepBreaks: true }).minify(cssContent).styles;
  }
  let styleClassNames = {};
  let styles = [];
  cssContent.split('\n').forEach(function (line) {
    let index = line.indexOf('{');
    let selectors = line.substr(0, index).split(',');
    let content = line.substr(index);

    selectors.forEach(function (selector) {
      if (selector[0] !== '.') {
        styles.push({ selector, content });
        return;
      }
      let className = selector.substr(1);
      styles.push({ selector, content, className });
      styleClassNames[className] = true;
    });
  });
  let xmlClassNames = {};
  xmlContent = xmlContent.replace(/[\r\n]\s+</g, '\n<').replace(/<!--[^>]+-->/g, '');
  xmlContent = xmlContent.replace(/ class="([^"]+)"/g, function (matchs, names) {
    names = names.split(' ').filter(function (name) {
      if (!name) return false;
      if (name.indexOf('{') > -1) return true;
      if (config.classNames && config.classNames[name]) return true;
      if (styleClassNames[name] || clsMap[name]) {
        xmlClassNames[name] = true;
        return true;
      }
      return false;
    }).map(function (name) {
      if (name.indexOf('{') > -1) return name;
      if (config.classNames && config.classNames[name]) return name;
      if (!clsMap[name]) {
        let id = createId();
        clsMap[name] = id;
        clsMapReverse[id] = name;
      }
      return clsMap[name];
    });
    if (names.length) {
      return ' class="' + names.join(' ') + '"';
    }
    return '';
  });
  cssContent = '';
  for (let style of styles) {
    if (!style.className) {
      cssContent += style.selector + style.content + '\n';
      continue;
    }
    if (config.classNames && config.classNames[style.className]) {
      cssContent += '.' + style.className + style.content + '\n';
      continue;
    }
    if (!xmlClassNames[style.className]) {
      continue;
    }
    cssContent += '.' + clsMap[style.className] + style.content + '\n';
  }

  fs.writeFileSync(page.wxml, xmlContent);
  if (cssContent) {
    fs.writeFileSync(page.wxss, cssContent);
  }
}

module.exports = function* minifyPage() {
  let clsMap = {};
  let clsMapReverse = {};
  minifyApp(clsMap, clsMapReverse);
  let pages = findPages(pagesPath);
  let id = _id;
  for (let page of pages) {
    _id = id;
    console.log('minify'.green, path.relative(process.cwd(), page.wxml).blue);
    minify(page, Object.assign({}, clsMap), Object.assign({}, clsMapReverse));
  }
};
