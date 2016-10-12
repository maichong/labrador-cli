import wx from 'labrador';
import List from '../../components/list/list';
import Title from '../../components/title/title';

export default class Index extends wx.Component {
  data = {
    userInfo: {}
  };
  children = {
    list: new List(),
    motto: new Title({ text: 'Hello world' })
  };

  //事件处理函数
  handleViewTap() {
    wx.navigateTo({
      url: '../logs/logs'
    })
  }

  async onLoad() {
    //调用应用实例的方法获取全局数据
    let userInfo = await wx.app.getUserInfo();
    //更新数据
    this.setData({
      userInfo: userInfo
    });
  }
}
