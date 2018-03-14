// @flow

import PagesPlugin from '../src/PagesPlugin';

let _;

_ = new PagesPlugin({
  mapStatsToProps(stats) {
    return {stats};
  },
  render(result) {
    (result.path: string);

    // $ExpectError
    (result.path: number);

    return {markup: '', redirect: '/', status: 200, foo: 'bar'};
  },
  mapResults(results) {
    (results: Array<Object>);
    // $ExpectError
    (results: void);

    return results.map((result) => {
      (result.foo: string);
      // $ExpectError
      (result.foo: number);
      return result;
    });
  },
});

_ = new PagesPlugin({
  mapStatsToProps(stats) {
    return {stats};
  },
  render() {
    return Promise.resolve({markup: '', redirect: '/', foo: 'bar'});
  },
  mapResults(results) {
    return results.map((result) => {
      (result.foo: string);
      // $ExpectError
      (result.foo: number);
      return result;
    });
  },
});
