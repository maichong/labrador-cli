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
const utils = require('./utils');
const config = require('./config')();
require('colors');

const DOMParser = xmldom.DOMParser;

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
 * @param {Object} from
 * @param {string} str     原始字符串
 * @param {string} prefix  前缀
 * @param {object} ignores 忽略的字符串map
 * @returns {string}
 */
function replaceString(from, str, prefix, ignores) {
  if (prefix) {
    prefix += '.';
  }
  return str.replace(/\{\{([^}]+)\}\}/ig, function (matchs, words) {
    //console.log('\n------>\n', str);
    let isArray = /{{\s*\[/.test(matchs);
    //console.log('isArray', isArray);
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

        //console.log('isObject', isObject);
        if (isObject) {
          return '{{' + props.join(',') + '}}';
        }
      }
    }
    return matchs.replace(/[^\.\w'"]([a-z_\$][\w\d\._\$]*)/ig, function (match, word, n) {
      // console.log('matchs', matchs);
      // console.log('word', word);
      // console.log('inText', inText(matchs, n));
      let char = match[0];
      let w = word.match(/^\w+/)[0];
      //console.log('w', w);
      if (ignores.hasOwnProperty(w) || inText(matchs, n)) return match;
      if (['props', 'state'].indexOf(w) < 0) {
        console.error(`'${from.fromSrc}' 中发现无效变量引用 '${word}'，XML模板中只能引用组件'props'和'state'中的数据。`.red);
      }
      return char + prefix + word;
    });
  });
}

/**
 * 递归绑定XML中的节点
 * @param from
 * @param node
 * @param comPrefix
 * @param valPrefix
 * @param clsPrefix
 * @param ignores
 */
function bind(from, node, comPrefix, valPrefix, clsPrefix, ignores) {
  ignores = Object.assign({
    true: true,
    false: true,
    null: true,
    undefined: true
  }, ignores);

  let hasPath = false;

  //处理节点属性
  let attributes = node.attributes;
  for (let i in attributes) {
    if (!/^\d+$/.test(i)) continue;
    let attr = attributes[i];

    //处理属性值
    if (attr.value.indexOf('{') > -1) {
      attr.value = replaceString(from, attr.value, valPrefix, ignores);
    }

    //绑定事件
    if (/^(bind|catch)\w+/.test(attr.name)) {
      node.setAttribute('data-' + attr.name, attr.value);
      attr.value = '_dispatch';
      if (!hasPath && comPrefix) {
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
      const matchArr = [];
      // "xxx {{a ? 'b' : 'c'}}"
      // => "xxx $"
      attr.value = attr.value.replace(/\{\{([^}]+)\}\}/ig, function (match) {
        matchArr.push(match);
        matchArr.push(match);
        return '$';
      });

      // => "xxx prefix-xxx $ prefix-$"
      attr.value = attr.value.split(' ').map(cls => `${cls} ${clsPrefix}-${cls}`).join(' ');

      // => "xxx prefix-xxx {{a ? 'b' : 'c'}} prefix-{{a ? 'b' : 'c'}}"
      attr.value = attr.value.replace(/\$/g, function () {
        const matchItem = matchArr.shift();
        return matchItem;
      });
    }
  }

  //如果节点为文本
  if (node.nodeName === '#text') {
    let data = node.data;
    if (data) {
      node.replaceData(0, data.length, replaceString(from, data, valPrefix, ignores));
    }
  }

  //递归处理子节点
  for (let i in node.childNodes) {
    if (!/^\d+$/.test(i)) continue;
    let n = node.childNodes[i];
    bind(from, n, comPrefix, valPrefix, clsPrefix, ignores);
  }
}

/**
 * @param {FileInfo} from
 * @param {string} comPrefix
 * @param {string} valPrefix
 * @param {string} clsPrefix
 * @param {Object} depends
 * @returns {Document}
 */
function build(from, comPrefix, valPrefix, clsPrefix, depends) {
  if (typeof from === 'string') {
    from = utils.getInfo(from);
  }
  const components = config.srcDir + 'components/';

  let data = fs.readFileSync(from.file, 'utf8');

  if (!data) {
    throw new Error('XML file is empty ' + from.relative);
  }

  let doc = new DOMParser().parseFromString(data);

  bind(from, doc, comPrefix, valPrefix, clsPrefix);

  let listElemnts = doc.getElementsByTagName('list');
  //console.log('listElemnts', listElemnts);

  for (let i = 0; i < listElemnts.$$length; i++) {
    let el = listElemnts[i];
    let key = el.getAttribute('key');
    let name = el.getAttribute('name') || key;
    if (!key) throw new Error('Unknown list key in ' + from.relative);
    let src;
    if (utils.isDirectory(path.join(components, name))) {
      //在components目录中
      src = path.join(components, name, name + '.xml');
    } else if (utils.isFile(path.join(components, name + '.xml'))) {
      //在components目录中
      src = path.join(components, name + '.xml');
    } else if (utils.isDirectory(path.join(config.modulesDir, name))) {
      //在node_modules目录中
      src = path.join(config.modulesDir, name, 'index.xml');
    } else if (utils.isFile(path.join(config.modulesDir, name + '.xml'))) {
      //在node_modules目录中
      src = path.join(config.modulesDir, name + '.xml');
    } else {
      throw new Error(`Can not find components "${name}" in ` + from.relative);
    }

    depends[src] = true;
    let indexName = '_index_' + uid();
    let itemName = '_item_' + uid();
    let subComPrefix = comPrefix ? comPrefix + '.' + key : key;
    subComPrefix += '.{{' + indexName + '}}';
    let subValPrefix = valPrefix ? valPrefix + '.' + key : key;
    let subClsPrefix = clsPrefix ? clsPrefix + '-' + key : key;
    let listNode = doc.createElement('block');
    listNode.setAttribute('wx:for', '{{' + subValPrefix + '}}');
    listNode.setAttribute('wx:key', '__k');
    listNode.setAttribute('wx:for-index', indexName);
    listNode.setAttribute('wx:for-item', itemName);
    el.parentNode.replaceChild(listNode, el);
    let ignores = {};
    ignores[indexName] = true;
    ignores[itemName] = true;
    let node = build(src, subComPrefix, itemName, subClsPrefix, depends);
    listNode.appendChild(node);
  }

  let componentElements = doc.getElementsByTagName('component');

  for (let i = 0; i < componentElements.$$length; i++) {
    let el = componentElements[i];
    let key = el.getAttribute('key');
    let name = el.getAttribute('name') || key;
    if (!key) throw new Error('Unknown component key in ' + from.relative);
    let src;
    if (utils.isDirectory(path.join(components, name))) {
      //在components目录中
      src = path.join(components, name, name + '.xml');
    } else if (utils.isFile(path.join(components, name + '.xml'))) {
      //在components目录中
      src = path.join(components, name + '.xml');
    } else if (utils.isDirectory(path.join(config.modulesDir, name))) {
      //在node_modules目录中
      src = path.join(config.modulesDir, name, 'index.xml');
    } else if (utils.isFile(path.join(config.modulesDir, name + '.xml'))) {
      //在node_modules目录中
      src = path.join(config.modulesDir, name + '.xml');
    } else {
      throw new Error(`Can not find components "${name}" in ` + from.relative);
    }
    depends[src] = true;
    let subComPrefix = comPrefix ? comPrefix + '.' + key : key;
    let subValPrefix = valPrefix ? valPrefix + '.' + key : key;
    let subClsPrefix = clsPrefix ? clsPrefix + '-' + key : key;
    let node = build(src, subComPrefix, subValPrefix, subClsPrefix, depends);
    el.parentNode.replaceChild(node, el);
  }
  return doc;
}

/**
 * 编译XML
 * @param {FileInfo} from
 * @param {FileInfo} to
 * @returns {Array}
 */
module.exports = function* buildXML(from, to) {
  console.log('build xml'.green, from.relative.blue, '->', to.relative.cyan);
  let depends = {};
  let element = build(from, '', '', '', depends);
  mkdirp.sync(to.dir);
  let xml = element.toString();
  xml = xml.replace(/&amp;nbsp;/g, '&nbsp;');
  xml = xml.replace(/{{([^}]+)}}/g, function (matchs) {
    return matchs.replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  });
  fs.writeFileSync(to.file, xml);
  return Object.keys(depends);
};
