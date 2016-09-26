
const wx = require('labrador');
const app = getApp();
const List = require('../../components/list/list.js');

wx.createPage({
  data: {
    motto: 'Hello World',
    userInfo: {}
  },
  components: {
    list: new List()
  },
  //事件处理函数
  bindViewTap: function () {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onLoad: async function () {
    console.log('onLoad');
    //调用应用实例的方法获取全局数据
    let userInfo = await app.getUserInfo();
    //更新数据
    this.setData({
      userInfo: userInfo
    });
    this.update();
  }
});
