/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-26
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const co = require('co');
const babel = require(process.cwd() + '/node_modules/babel-core');
const util = require('./util');
const components = process.cwd() + '/src/components/';
const dist = process.cwd() + '/dist/';
const npmroot = process.cwd() + '/dist/npm/';
const node_modules = process.cwd() + '/node_modules/';
const querystring = require('querystring');


module.exports = function * buildXML(from, to, withAbstract, ignores) {
  console.log('buildXML', from, to);
  let data = fs.readFileSync(from, 'utf8');
  let imports = [];
  let promises = [];
  ignores = ignores || {};
  data = data.replace(/<component([^>]+)>(<\/component>)?/ig, function (_, str) {
    str = str.replace(/ +/g, '&').replace(/["'\/]/g, '');
    let q = querystring.parse(str);
    let key = q.key;
    if (!key) throw new Error('Unknown component key in ' + from);
    let name = q.name || key;
    let test = path.join(components, name);
    if (util.isDirectory(test)) {
      //在components目录中
      let src = path.join(dist, 'components', name, name + '.wxml');
      if (imports.indexOf(src) == -1) {
        imports.push(src);
      }
    } else if (util.isDirectory(path.join(node_modules, name))) {
      //在node_modules目录中
      let source = path.join(node_modules, name, 'index.xml');
      let target = path.join(npmroot, name, 'index.wxml');
      if (!util.isFile(target)) {
        promises.push(co(buildXML(source, target, true, ignores)));
      }
      if (imports.indexOf(target) == -1) {
        imports.push(target);
      }
    }
    return `<template is="${name}" data="{{...${key}}}"/>`;
  });

  if (promises.length) {
    yield Promise.all(promises);
  }

  let code = imports.map(function (file) {
    let src = path.relative(path.dirname(to), file);
    return `<import src="${src}"/>`;
  }).join('\n');

  code += '\n' + data;
  mkdirp.sync(path.dirname(to));
  fs.writeFileSync(to, code);
};
