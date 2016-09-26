/**
 * @copyright Maichong Software Ltd. 2016 http://maichong.it
 * @date 2016-09-26
 * @author Liang <liang@maichong.it>
 */

module.exports = class List {
  constructor() {
    this.data = {
      items: [
        { title: 'Labrador' },
        { title: 'Alaska' },
      ]
    };
  }

  onLoad() {
    this.setData({
      items: [{ title: 'Collie' }].concat(this.data.items)
    });
  }
};
