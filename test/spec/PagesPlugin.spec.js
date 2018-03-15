import PagesPlugin from '../../src/PagesPlugin';
import webpack from 'webpack';
import createConfig from '../fixture/webpack.config';
import path from 'path';
import fs from 'fs';
import {expect} from 'chai';

const renderBody = (path) => {
  switch (path) {
  case '/':
    return 'See all our <a href="/products">Products</a>.';
  case '/products':
    return 'We have the hugest products.';
  case '/foo':
  case '/foo.html':
    return 'Foo';
  case '/empty':
    return '<a href="">empty</a>';
  case '/url':
    return '<a href="//foo.com/bar">url</a>';
  case '/relative':
    return '<a href="./">url1</a><a href="..">url2</a>';
  default:
    return 'Page not found.';
  }
};

const baseConfig = {
  name: '[path][name].[ext]',
  paths: ['/'],
  mapStatsToProps: (stats) => {
    return {stats: stats.toJson()};
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
  return new Promise((resolve) => {
    compiler.run((err, stats) => {
      expect(err).to.be.null;
      const json = stats.toJson();
      const index = {};
      json.assets.forEach((asset) => {
        index[asset.name] = fs.readFileSync(
          path.join(config.output.path, asset.name),
          'utf8'
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

  it('should fail with no `render`', () => {
    expect(() =>
      createConfig(PagesPlugin, {
        mapStatsToProps: () => {},
      })
    ).to.throw(TypeError);
  });
  it('should fail with no `mapStatsToProps`', () => {
    expect(() =>
      createConfig(PagesPlugin, {
        render: () => {},
      })
    ).to.throw(TypeError);
  });
  it('should resolve relative paths', () => {
    const config = createConfig(PagesPlugin, {
      ...baseConfig,
      paths: ['/foo/baz/qux/../..', '/foo/bar/..'],
    });
    return execWebpack(config).then((result) => {
      // TODO: Check this better
      expect(result)
        .to.have.property('foo/index.html')
        .to.contain('Foo');
    });
  });
  it('should resolve relative paths 2', () => {
    const config = createConfig(PagesPlugin, {
      ...baseConfig,
      paths: ['/relative'],
    });
    return execWebpack(config).then((result) => {
      // TODO: Check this better
      expect(result).to.have.property('index.html');
      expect(result).to.have.property('relative/index.html');
    });
  });
  it('should preserve extensions', () => {
    const config = createConfig(PagesPlugin, {
      ...baseConfig,
      paths: ['/foo.html'],
    });
    return execWebpack(config).then((result) => {
      // TODO: Check this better
      expect(result)
        .to.have.property('foo.html')
        .to.contain('Foo');
    });
  });
  it('should ignore empty paths', () => {
    const config = createConfig(PagesPlugin, {
      ...baseConfig,
      paths: ['/empty'],
    });
    return execWebpack(config).then((result) => {
      expect(Object.keys(result).length).to.equal(1);
    });
  });
  it('should ignore protocols', () => {
    const config = createConfig(PagesPlugin, {
      ...baseConfig,
      paths: ['/url'],
    });
    return execWebpack(config).then((result) => {
      expect(Object.keys(result).length).to.equal(1);
    });
  });
});
