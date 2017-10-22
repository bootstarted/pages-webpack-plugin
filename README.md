# pages-webpack-plugin

Generate static pages with [webpack].

![build status](http://img.shields.io/travis/metalabdesign/pages-webpack-plugin/master.svg?style=flat)
![coverage](https://img.shields.io/codecov/c/github/metalabdesign/pages-webpack-plugin/master.svg?style=flat)
![license](http://img.shields.io/npm/l/pages-webpack-plugin.svg?style=flat)
![version](http://img.shields.io/npm/v/pages-webpack-plugin.svg?style=flat)
![downloads](http://img.shields.io/npm/dm/pages-webpack-plugin.svg?style=flat)

Usage:

```js
const PagesPlugin = require('pages-webpack-plugin');

const renderBody = (path) => {
  switch (path) {
  case '/':
    return 'See all our <a href="/products">Products</a>.';
  case '/products':
    return 'We have the hugest products.';
  default:
    return 'Page not found.';
  }
}

module.exports = {
  // ...
  plugins: [
    new PagesPlugin({
      name: '[path][name].[ext]',
      paths: [
        '/',
      ],
      mapStatsToProps: (stats) => {
        return {stats: stats};
      },
      render: (props) => {
        const {stats, path} = props;
        const scriptSrc = stats.publicPath + stats.assetsByChunkName.main;
        const markup = `
          <!DOCTYPE html>
          <html>
            <body>
              ${renderBody(path)}
              <script src="${scriptSrc}"></script>
            </body>
          </html>
        `
        return {markup};
      },
    }),
  ],
};
```

[webpack]: https://webpack.js.org/
