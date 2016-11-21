import { Component, PropTypes } from 'labrador-immutable';
import immutable from 'seamless-immutable';
//import { connect } from 'labrador-redux';

const { any } = PropTypes;

class COMPONENT_NAME extends Component {
  static propTypes = {
    foo: any
  };

  static defaultProps = {
    foo: 'bar'
  };

  constructor(props) {
    super(props);
    this.state = immutable({});
  }

  children() {
    return {};
  }

  // onLoad() {
  // }

  // onReady() {
  // }

  // onUpdate() {
  // }

  // onShow() {
  // }

  // onHide() {
  // }

  // onUnload() {
  // }

}

export default COMPONENT_NAME;

// export default connect(
//   (state)=>({})
// )(COMPONENT_NAME);
