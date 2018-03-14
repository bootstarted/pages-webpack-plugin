import PagesPlugin from '../../src/PagesPlugin';
import webpack from 'webpack';
import createConfig from '../fixture/webpack.config';
import path from 'path';
import MemoryFS from 'memory-fs';
import {expect} from 'chai';

const renderBody = (path) => {
  switch (path) {
  case '/':
    return 'See all our <a href="/products">Products</a>.';
  case '/products':
    return 'We have the hugest products. <a href="/yuge.html">Learn more</a>.';
  default:
    return 'Page not found.';
  }
};

const baseConfig = {
  name: '[path][name].[ext]',
  paths: ['/'],
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
    `;
    return {markup};
  },
};

const execWebpack = (config) => {
  const compiler = webpack(config);
  const fs = new MemoryFS();

  compiler.outputFileSystem = fs;

  return new Promise((resolve) => {
    compiler.run((err, stats) => {
      expect(err).to.be.null;
      const json = stats.toJson();
      const index = {};
      json.assets.forEach((asset) => {
        index[asset.name] = fs.readFileSync(
          path.join(config.output.path, asset.name),
          'utf8',
        );
      });
      resolve(index);
    });
  });
};

describe('PagesPlugin', () => {
  it('should work', () => {
    const config = createConfig(PagesPlugin, {
      ...baseConfig,
    });
    return execWebpack(config).then((result) => {
      expect(result)
        .to.have.property('index.html')
        .to.contain('See all');
      expect(result)
        .to.have.property('products/index.html')
        .to.contain('We have the hugest');
    });
  });
});
