import { createAction, handleActions } from 'redux-actions';
import immutable from 'seamless-immutable';

/**
 * Action Types
 */
export const NAME_UPPER_CASE_REQUEST = 'NAME_UPPER_CASE_REQUEST';
export const NAME_UPPER_CASE_SUCCESS = 'NAME_UPPER_CASE_SUCCESS';
export const NAME_UPPER_CASE_FAILURE = 'NAME_UPPER_CASE_FAILURE';

/**
 * Action Creators
 */
// 请求 action
export const NAME_LOWER_CASERequest = createAction(NAME_UPPER_CASE_REQUEST);

// 操作成功
export const NAME_LOWER_CASESuccess = createAction(NAME_UPPER_CASE_SUCCESS, ({ id }) => ({ id }));

// 操作失败
export const NAME_LOWER_CASEFailure = createAction(NAME_UPPER_CASE_FAILURE, (error) => ({ error }));

/**
 * Initial State
 */
export const INITIAL_STATE = immutable({
  error: null,
  fetching: false
});

/**
 * Reducers
 */
export default handleActions({
  NAME_UPPER_CASE_REQUEST: (state) =>
    state.merge({ fetching: true }),
  NAME_UPPER_CASE_SUCCESS: (state, { payload }) =>
    state.merge({ fetching: false, error: null, ...payload }),
  NAME_UPPER_CASE_FAILURE: (state, { payload }) =>
    state.merge({ fetching: false, error: payload.error })
}, INITIAL_STATE);
