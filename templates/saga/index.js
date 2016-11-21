import { put } from 'redux-saga/effects';
import request from 'al-request';
import * as NAME_LOWER_CASEActions from '../redux/NAME_LOWER_CASE';

export default function* NAME_LOWER_CASESaga() {
  try {
    // 在这里写异步操作代码
    let data = yield request.post('api/NAME_LOWER_CASE');

    // 将异步操作结果更新至Redux
    yield put(NAME_LOWER_CASEActions.NAME_LOWER_CASESuccess(data));
  } catch (error) {
    yield put(NAME_LOWER_CASEActions.NAME_LOWER_CASEFailure(error));
  }
}
