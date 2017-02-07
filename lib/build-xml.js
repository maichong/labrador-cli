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
  // 替换字符串中 {{}} 包含的表达式

  // 获取类似 a.b.c 表达式中第一个有效变量名 a
  function getFirstWord(word) {
    return word.match(/[_a-z][\w\d]*/i)[0];
  }

  // 检查类似 a.b.c 格式表达式是否忽略绑定
  function shouldIgnore(word, matchs, n) {
    if (word[0] === '"' || word[0] === "'" || /^\d+$/.test(word)) return true;
    let w = getFirstWord(word);
    if (ignores.hasOwnProperty(w) || (matchs && inText(matchs, n))) {
      return true;
    }
    if (['state', 'props'].indexOf(w) < 0) {
      console.error(`'${from.fromSrc}' 中发现无效变量引用 '${word}'，XML模板中只能引用组件'props'和'state'中的数据。`.red);
      console.error('如果您的项目基于Labrador 0.5.x，请按照升级指南升级到0.6.x版本 https://github.com/maichong/labrador');
    }

    return false;
  }

  if (prefix) {
    prefix += '.';
  } else {
    prefix = '';
  }
  return str.replace(/\{\{([^}]+)\}\}/ig, function (matchs, words) {
    // matchs 是{{xxxxx}}格式的字符串
    // words  是{{}}中间的表达式

    // ...foo
    if (/^\s*\.\.\.[\w_][\w\d\-_.\[\]]*\s*$/.test(words)) {
      let word = words.match(/\s*\.\.\.([\w_][\w\d\-_.\[\]]*)/)[1].trim();
      if (shouldIgnore(word)) {
        return matchs;
      }
      return `{{...${prefix}${word}}}`;
    }

    let isArray = /{{\s*\[/.test(matchs);
    if (!isArray) {
      //支持对象简写
      let arrays = words.split(',');
      if (arrays.length > 1) {
        let isObject = true;
        let props = arrays.map(function (str) {
          if (!isObject) return;
          // str 为对象中的一个属性， 可能为 a:b / a / ...a / ...a.b
          str = str.trim();

          let arr = str.split(':');
          if (arr.length === 1) {
            // 如果属性表达式中不包含冒号

            // 如果为简写属性表达式，例如 {foo}
            if (/^[a-z_][\w\d]*$/i.test(str)) {
              if (ignores[str]) {
                return str + ':' + str;
              }
              return str + ':' + prefix + str;
            }

            // 属性展开表达式 ...foo
            if (/^\.{3}[a-z_][\w\d.\[\]]*$/i.test(str)) {
              let word = str.substr(3);
              if (shouldIgnore(word)) {
                return str;
              }
              return '...' + prefix + word;
            }

            // 判定 ${matchs} 不为对象表达式
            isObject = false;
            return;
          }

          // 存在冒号的对象属性表达式

          let word = arr[1].trim();
          // foo:2.3
          if (/^[\d.]+$/.test(word)) {
            return arr[0] + ':' + word;
          }

          // foo:bar
          // 'foo':bar
          if (shouldIgnore(word)) {
            return str;
          }

          // foo:bar
          // 'foo':bar
          // foo
          return arr[0] + ':' + prefix + word;
        });

        //console.log('isObject', isObject);
        if (isObject) {
          return '{{' + props.join(',') + '}}';
        }
      }
    }


    return matchs.replace(/[^\.\w'"]([a-z_\$][\w\d\._\$]*)/ig, function (match, word, n) {
      if (shouldIgnore(word, matchs, n)) {
        return match;
      }
      return match[0] + prefix + word;
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
    // 不转换template 定义
    if (n.nodeName === 'template' && n.getAttribute('name')) {
      bindTemplateEvents(n);
      continue;
    }
    bind(from, n, comPrefix, valPrefix, clsPrefix, ignores);
  }
}

/**
 * 递归绑定template标签子节点中的事件
 * @param node
 */
function bindTemplateEvents(node) {
  //处理节点属性
  let attributes = node.attributes;
  for (let i in attributes) {
    if (!/^\d+$/.test(i)) continue;
    let attr = attributes[i];

    //绑定事件
    if (/^(bind|catch)\w+/.test(attr.name)) {
      node.setAttribute('data-' + attr.name, attr.value);
      attr.value = '_dispatch';
    }
  }

  for (let i in node.childNodes) {
    if (!/^\d+$/.test(i)) continue;
    let n = node.childNodes[i];
    bindTemplateEvents(n);
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
    let id = uid();
    let indexName = '_k' + id;
    let itemName = '_v' + id;
    let subComPrefix = comPrefix ? comPrefix + '.' + key : key;
    subComPrefix += '.{{' + itemName + '.__k}}';
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

