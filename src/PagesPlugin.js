// @flow

import cheerio from 'cheerio';
import path from 'path';
import url from 'url';

type RenderResult = {
  markup: string,
  redirect?: string,
  status?: number,
};

type OutputResult<T: RenderResult> = {
  ...T,
  markup: string,
  path: string,
  filename: string,
};

type Stats = {
  assets: Array<{
    name: string,
    chunkNames: Array<string>,
  }>,
  hash: string,
  publicPath: string,
};

type Render<T, P> = ({...P, path: string}) => Promise<T> | T;
type MapResults<T> = (Array<OutputResult<T>>) => Array<OutputResult<T>>;
type GetFilename<T> = (OutputResult<T>) => string;

type Options<T: RenderResult, P: Object> = {
  mapStatsToProps: (stats: Stats) => P,
  render: Render<T, P>,
  mapResults?: MapResults<T>,
  name?: string,
  paths?: Array<string>,
};

class PagesPlugin<T: RenderResult, P: Object> {
  options: {
    mapStatsToProps: (stats: Stats) => P,
    render: Render<T, P>,
    mapResults: MapResults<T>,
    getFilename: GetFilename<T>,
    name: string,
    paths: Array<string>,
  };

  constructor(options: Options<T, P>) {
    this.options = {
      name: '[path][name].[ext]',
      paths: ['/'],
      mapResults: (results) => results,
      getFilename: (result) => result.path,
      ...options,
    };

    if (typeof this.options.mapStatsToProps !== 'function') {
      throw new TypeError(
        'PagesPlugin options must contain `mapStatsToProps` function.',
      );
    }

    if (typeof this.options.render !== 'function') {
      throw new TypeError(
        'PagesPlugin options must contain `render` function.',
      );
    }
  }

  normalizePath(pathname: string) {
    const parts = path.parse(pathname);
    const {name, dir, ext} = parts;

    if (ext) {
      return pathname;
    }

    return path.join(dir, name, 'index.html');
  }

  parsePathsFromMarkup(markup: string): Array<string> {
    const $ = cheerio.load(markup);
    const links = $('a[href]');

    const paths = [];

    links.each((i, element) => {
      const href = $(element).attr('href');
      const {pathname, host} = url.parse(href);

      if (
        !paths.includes(pathname) &&
        pathname &&
        !host &&
        !/\/\//.test(href)
      ) {
        paths.push(path.join(pathname));
      }
    });

    return paths;
  }

  isValidPath(pathname: string) {
    return /^\//.test(pathname);
  }

  resolvePath(currentPath: string, pathname: string) {
    if (/^\//.test(pathname)) return pathname;

    const dirParts = currentPath.split(/\/+/).slice(1);
    if (dirParts.length !== 0 && /\./.test(dirParts[dirParts.length - 1])) {
      dirParts.pop();
    }

    const pathParts = pathname.split(/\/+/).filter((part) => part !== '.');

    let atRoot = false;

    while (pathParts[0] === '..') {
      pathParts.shift();
      atRoot = atRoot || dirParts.length === 0;

      if (atRoot) dirParts.push('..');
      else dirParts.pop();
    }

    return `/${path.join(...dirParts, ...pathParts)}`;
  }

  renderPages(
    props: P,
    paths: Array<string>,
    renderedPaths: Array<string> = [],
    results: Array<OutputResult<T>> = [],
  ): Promise<Array<OutputResult<T>>> {
    if (paths.length === 0) return Promise.resolve(results);

    let discoveredPaths = [];
    return paths
      .reduce((previous, currentPath) => {
        const normalizedPath = this.normalizePath(currentPath);

        if (renderedPaths.includes(normalizedPath)) return previous;

        renderedPaths.push(normalizedPath);

        return previous
          .then(() => this.options.render({...props, path: currentPath}))
          .then((result) => {
            // TODO: ^ Check `statusCode`, `redirect` ?? etc. and not generate
            // pages that have e.g. 404 or 500 errors.
            results.push({...result, filename: '', path: currentPath});

            discoveredPaths = discoveredPaths.concat(
              this.parsePathsFromMarkup(result.markup)
                .map((pathname) => this.resolvePath(currentPath, pathname))
                .filter((pathname) => this.isValidPath(pathname)),
            );
          });
      }, Promise.resolve())
      .then(() => {
        return this.renderPages(props, discoveredPaths, renderedPaths, results);
      });
  }

  handleEmit = (compilation: Object, done: (?Error) => void) => {
    const {getFilename, mapStatsToProps, mapResults, paths} = this.options;

    const stats = compilation.getStats().toJson();

    const preparedPaths = paths
      .filter((pathname) => !/\.\.\//.test(pathname))
      .map((pathname) => path.join('/', pathname));

    this.renderPages(mapStatsToProps(stats), preparedPaths)
      .then((results) =>
        results.map((result) => ({
          ...result,
          filename: this.normalizePath(getFilename(result)).slice(1),
        })),
      )
      .then(mapResults)
      .then((results) => {
        results.forEach((result) => {
          compilation.assets[result.filename] = {
            source: () => result.markup,
            size: () => result.markup.length,
          };
        });
        done();
      })
      .catch(done);
  };

  apply(compiler: Object) {
    compiler.plugin('emit', this.handleEmit);
  }
}

export default PagesPlugin;
