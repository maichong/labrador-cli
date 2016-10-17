/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-26
 * @author Liang <liang@maichong.it>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const xmldom = require('xmldom');
const util = require('./util');
require('colors');

const DOMParser = xmldom.DOMParser;
const components = process.cwd() + '/src/components/';
const modulesPath = process.cwd() + '/node_modules/';
const cwdPath = process.cwd() + '/';

let _uid = 0;
function uid() {
  _uid++;
  return _uid;
}
/**
 * 判断字符串中指定的位置是否是被包含在引号中
 * @param string
 * @param n
 * @returns {boolean}
 */
function inText(string, n) {
  let firstIndex = string.search(/"|'/);
  if (firstIndex === -1 || firstIndex > n) return false;
  let char = '';
  let last = '';
  for (let i = 0; i < n; i++) {
    let c = string[i];
    if (c === '"' || c === "'") {
      if (!char) {
        char = c;
      } else if (char === c && last !== '\\') {
        char = '';
      }
    }
    last = c;
  }
  return char !== '';
}

/**
 * 将带数据绑定的字符串替换
 * @param {string} str     原始字符串
 * @param {string} prefix  前缀
 * @param {object} ignores 忽略的字符串map
 * @returns {string}
 */
function replaceString(str, prefix, ignores) {
  return str.replace(/\{\{([^}]+)\}\}/ig, function (matchs, words) {
    let isArray = /{{\s*\[/.test(matchs);
    if (!isArray) {
      //支持对象简写
      let arrays = words.split(',');
      if (arrays.length > 1) {
        let isObject = true;
        let props = arrays.map(function (str) {
          if (!isObject) return;
          let arr = str.split(':');
          if (arr.length === 1) {
            // foo
            // ...foo
            if (/^\w[\w\d\_]*$/.test(str)) {
              return str + ':' + prefix + '.' + str;
            }

            if (/^\.{3}\w[\w\d\_]*$/.test(str)) {
              return str;
            }

            isObject = false;
            return;
          }
          // foo:bar
          // 'foo':bar
          // foo
          return arr[0] + ':' + prefix + '.' + arr[1];
        });

        if (isObject) {
          return '{{' + props.join(',') + '}}';
        }
      }
    }
    return matchs.replace(/[^\.\w'"]([a-z_\$][\w\d\._\$]*)/ig, function (match, word, n) {
      let char = match[0];
      let w = word.match(/^\w+/)[0];
      if (ignores.hasOwnProperty(w) || inText(matchs, n)) return match;
      return char + prefix + '.' + word;
    });
  });
}

/**
 * 递归绑定XML中的节点
 * @param node
 * @param comPrefix
 * @param valPrefix
 * @param clsPrefix
 * @param ignores
 */
function bind(node, comPrefix, valPrefix, clsPrefix, ignores) {
  ignores = Object.assign({
    true: true,
    false: true,
    null: true,
    undefined: true
  }, ignores);
  //let _prefix = prefix.replace(/\./g, '_');

  let hasPath = false;

  //处理节点属性
  let attributes = node.attributes;
  for (let i in attributes) {
    if (!/^\d+$/.test(i)) continue;
    let attr = attributes[i];

    //处理属性值
    if (valPrefix && attr.value.indexOf('{') > -1) {
      attr.value = replaceString(attr.value, valPrefix, ignores);
    }

    //绑定事件
    if (/^(bind|catch)\w+/.test(attr.name)) {
      node.setAttribute('data-' + attr.name, attr.value);
      attr.value = '_dispatch';
      if (!hasPath) {
        node.setAttribute('data-path', comPrefix);
      }
    }

    //如果是循环标签,则在子标签中忽略循环索引和值变量
    if (attr.name === 'wx:for') {
      let index = node.getAttribute('wx:for-index') || 'index';
      let item = node.getAttribute('wx:for-item') || 'item';
      ignores[index] = true;
      ignores[item] = true;
    }

    if (clsPrefix && attr.name === 'class') {
      attr.value = attr.value.split(' ').map(cls => `${cls} ${clsPrefix}-${cls}`).join(' ');
    }
  }

  //如果节点为文本
  if (valPrefix && node.nodeName === '#text') {
    let data = node.data;
    if (data) {
      node.replaceData(0, data.length, replaceString(data, valPrefix, ignores));
    }
  }

  //递归处理子节点
  for (let i in node.childNodes) {
    if (!/^\d+$/.test(i)) continue;
    let n = node.childNodes[i];
    bind(n, comPrefix, valPrefix, clsPrefix, ignores);
  }
}

function build(from, comPrefix, valPrefix, clsPrefix) {
  let data = fs.readFileSync(from, 'utf8');

  if (!data) {
    throw new Error('XML file is empty ' + from);
  }

  let doc = new DOMParser().parseFromString(data);

  bind(doc, comPrefix, valPrefix, clsPrefix);

  let listElemnts = doc.getElementsByTagName('list');
  //console.log('listElemnts', listElemnts);

  for (let i = 0; i < listElemnts.$$length; i++) {
    let el = listElemnts[i];
    let key = el.getAttribute('key');
    let name = el.getAttribute('name') || key;
    if (!key) throw new Error('Unknown list key in ' + from);
    let src;
    if (util.isDirectory(path.join(components, name))) {
      //在components目录中
      src = path.join(components, name, name + '.xml');
    } else if (util.isDirectory(path.join(modulesPath, name))) {
      //在node_modules目录中
      src = path.join(modulesPath, name, 'index.xml');
    } else {
      throw new Error(`Can not find components "${name}" in ` + from);
    }

    let indexName = '_index_' + uid();
    let itemName = '_item_' + uid();
    let subComPrefix = comPrefix ? comPrefix + '.' + key : key;
    subComPrefix += '.{{' + indexName + '}}';
    let subValPrefix = valPrefix ? valPrefix + '.' + key : key;
    let subClsPrefix = clsPrefix ? clsPrefix + '-' + key : key;
    let listNode = doc.createElement('block');
    listNode.setAttribute('wx:for', '{{' + subValPrefix + '}}');
    listNode.setAttribute('wx:for-index', indexName);
    listNode.setAttribute('wx:for-item', itemName);
    el.parentNode.replaceChild(listNode, el);
    let ignores = {};
    ignores[indexName] = true;
    ignores[itemName] = true;
    let node = build(src, subComPrefix, itemName, subClsPrefix);
    listNode.appendChild(node);
  }

  let componentElements = doc.getElementsByTagName('component');

  for (let i = 0; i < componentElements.$$length; i++) {
    let el = componentElements[i];
    let key = el.getAttribute('key');
    let name = el.getAttribute('name') || key;
    if (!key) throw new Error('Unknown component key in ' + from);
    let src;
    if (util.isDirectory(path.join(components, name))) {
      //在components目录中
      src = path.join(components, name, name + '.xml');
    } else if (util.isDirectory(path.join(modulesPath, name))) {
      //在node_modules目录中
      src = path.join(modulesPath, name, 'index.xml');
    } else {
      throw new Error(`Can not find components "${name}" in ` + from);
    }
    let subComPrefix = comPrefix ? comPrefix + '.' + key : key;
    let subValPrefix = valPrefix ? valPrefix + '.' + key : key;
    let subClsPrefix = clsPrefix ? clsPrefix + '-' + key : key;
    let node = build(src, subComPrefix, subValPrefix, subClsPrefix);
    el.parentNode.replaceChild(node, el);
  }
  return doc;
}

module.exports = function* buildXML(from, to) {
  console.log('build xml'.green, path.relative(cwdPath, from).blue, '->', path.relative(cwdPath, to).cyan);
  let element = build(from, '', '');
  mkdirp.sync(path.dirname(to));
  let xml = element.toString();
  xml = xml.replace(/&amp;nbsp;/g, '&nbsp;');
  xml = xml.replace(/{{([^}]+)}}/g, function (matchs) {
    return matchs.replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  });
  fs.writeFileSync(to, xml);
};
