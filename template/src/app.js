const wx = require('labrador');
const { sleep } = require('./utils/util');

App({
  onLaunch: function () {
    //调用API从本地缓存中获取数据
    let logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);
    this.timer();
  },

  timer: async function () {
    while (true) {
      console.log('hello');
      await sleep(10000);
    }
  },

  getUserInfo: async function (cb) {
    if (this.globalData.userInfo) {
      return this.globalData.userInfo;
    }

    //调用登录接口
    await wx.login();
    let res = await wx.getUserInfo();
    this.globalData.userInfo = res.userInfo;
    return res.userInfo;
  },
  globalData: {
    userInfo: null
  }
});
