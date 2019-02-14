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
      // Required Config
      mapStatsToProps: (stats) => {
        // Map webpack stats object to render function props
        return {stats: stats.toJson(/* webpack toJson options*/)};
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

        const result = {markup, /* status, redirect */}
        return result;
      },
      // Optional Config
      paths: ['/'], // Define initial seed routes
      mapResultToFilename(result) {
        // Map rendered path to output file name
        return result.path;
      },
      mapResults(results, compilation) {
        // Intercept generated files before emit
        return results.map((result) => {
          return result;
        });
      },
      // Only explore the paths provided in the `paths` option
      // parsePathsFromMarkup: () => []
    }),
  ],
};
```

[webpack]: https://webpack.js.org/
