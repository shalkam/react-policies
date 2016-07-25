import React, { Component, PropTypes } from 'react'

let count = 0
const ignore = () => {}

/**
 * @param {Object} config.
 * @param {Function} config.test The testing callback. Should return 'true' if the test
 *                               passed and 'false' otherwise. Can also return a promise.
 *                               Can also throw errors, which will be taken as failure.
 * @param {Function} [config.failure] An optional failure callback.
 * @param {Boolean} [preview=false] If set to 'true' will render the component while
 *                                  the testing process is not finished. Defaults to
 *                                  'false', which means 'placeholder' or 'empty'
 *                                  component will be used instead.
 * @param {Object} [empty=<div />] A component to be rendered when the test fails.
 * @param {Object} [placeholder=null] A component to be redered while the testing process
 *                                    is not finished.
 * @param {Function} [config.shouldTest] A callback to determine if policy testing
 *                                       should be re-executed or note. This callback
 *                                       receives two arguments: 'to' and 'from', where
 *                                       'to' equals nextProps and 'from' equals current.
 * @return {Function} A policy decorator.
 */
const Policy = (...configs) => {
  const config = configs
    .map(config => typeof config === 'function' ? { test: config } : config)
    .reduce((prev, next) => ({ ...prev, ...next }), {})

  const {
    name,
    test,
    failure = () => {},
    preview = false,
    empty = <div />,
    placeholder = null,
    shouldTest = () => true,
  } = config

  const _name = name || (test.name !== 'test' && test.name) || 'policy' + count++

  const _test = props => (async () => test(props))().then(result => {
    if (!result || result instanceof Error) throw result
    return result
  })

  const _shouldTest = (to, from) => (async () => shouldTest(to, from))().then(result => {
    if (!result || result instanceof Error) throw result
    return result
  })

  const HOC = Composed => class PoliciedComponent extends Component {
    static displayName = `PoliciedComponent(${_name}/${Composed.displayName || 'Composed'})`

    static childContextTypes = {
      policy: PropTypes.object
    }

    static contextTypes = {
      policy: PropTypes.object,
    }

    constructor (props, foo, bar) {
      super(props)
      this.state = { tested: false, testing: null, failed: null }
    }

    async test (props) {
      try {
        this.setState({ tested: false, testing: true, failed: false })
        await _test(props)
        this.setState({ tested: true, testing: false, failed: false })
      } catch (error) {
        this.setState({ tested: true, testing: false, failed: true })
        failure({ ...this, props, error })
        throw error
      }
    }

    componentDidMount () {
      this.test(this.props).catch(ignore)
    }

    componentWillReceiveProps (nextProps) {
      _shouldTest(nextProps, this.props).then(() => this.test(nextProps)).catch(ignore)
    }

    getChildContext () {
      return {
        policy: {
          ...this.context.policy || {},
          [_name]: this.state
        }
      }
    }

    render () {
      const { tested, testing, failed } = this.state

      // 1. In case still testing, not failed, and allowing preview.
      if (testing && !failed && preview) return <Composed { ...this.props } />

      // 2. In case still testing and placeholder component available,
      // show placeholder component.
      if (!tested && !failed && placeholder) return placeholder

      // 3. In case finished testing and not failed, render component.
      if (tested && !failed) return <Composed { ...this.props } />

      // 4. In case finished testing or failed or not previewing,
      // return empty component or null if none given.
      return empty || null
    }
  }

  HOC.derivate = override => Policy(config, override)

  return HOC
}

export default Policy

export const combine = (...policies) => component => [].concat(policies).reverse()
  .reduce((component, policy) => policy(component), component)
