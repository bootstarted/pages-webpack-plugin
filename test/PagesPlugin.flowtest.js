// @flow

import PagesPlugin from '../src/PagesPlugin';

const _plugin = new PagesPlugin({
  mapStatsToProps(stats) {
    return {stats};
  },
  render(result) {
    (result.path: string);

    // $ExpectError
    (result.path: number);

    return Promise.resolve({markup: '', redirect: '/', status: 200, foo: 'bar'});
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
  useDirectory: false,
});
