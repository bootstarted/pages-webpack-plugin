const path = require('path');

module.exports = function(PagesPlugin, options) {
  return {
    entry: path.join(__dirname, 'main.js'),
    output: {
      path: path.join(__dirname, 'dist'),
      filename: 'test.js',
    },
    plugins: [
      new PagesPlugin(options),
    ],
  };
};
