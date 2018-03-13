// @flow

import cheerio from 'cheerio';
import loaderUtils from 'loader-utils';
import path from 'path';

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
type UseDirectory<T> = ((OutputResult<T>) => boolean);
type MapResults<T> = (Array<OutputResult<T>>) => Array<OutputResult<T>>;

type Options<T: RenderResult, P: Object> = {
  mapStatsToProps: (stats: Stats) => P,
  render: Render<T, P>,
  useDirectory?: boolean | UseDirectory<T>,
  mapResults?: MapResults<T>,
  name?: string,
  paths?: Array<string>,
};

class PagesPlugin<T: RenderResult, P: Object> {
  options: {
    mapStatsToProps: (stats: Stats) => P,
    render: Render<T, P>,
    useDirectory: UseDirectory<T>,
    mapResults: MapResults<T>,
    name: string,
    paths: Array<string>,
  };

  constructor({useDirectory, ...options}: Options<T, P>) {
    this.options = {
      name: '[path][name].[ext]',
      paths: ['/'],
      useDirectory:
        typeof useDirectory === 'boolean'
          ? (() => useDirectory)
          : useDirectory || ((result) => path.extname(result.path) === ''),
      mapResults: (results) => results,
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

  getFilename(resourcePath: string, options: Object) {
    return loaderUtils
      .interpolateName({resourcePath}, this.options.name, options)
      .replace(/^\.\//, '');
  }

  normalizePath(result: OutputResult<T>) {
    if (result.path.charAt(0) !== '/') {
      throw new TypeError(
        `PagesPlugin encountered invalid path: ${result.path}`,
      );
    }

    const path = this.options.useDirectory(result)
      ? `${result.path.substr(1)}/index.html`
      : result.path.substr(1);

    return path.replace(/^\//, './').replace(/\/\//g, '/');
  }

  parsePathsFromMarkup(markup: string): Array<string> {
    const $ = cheerio.load(markup);
    const relativeLinks = $('a[href^="/"]');

    const paths = [];

    relativeLinks.each((i, element) => {
      paths.push($(element).attr('href'));
    });

    return paths;
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
      .reduce((previous, path) => {
        if (renderedPaths.includes(path)) return previous;

        renderedPaths.push(path);

        return previous
          .then(() => this.options.render({...props, path}))
          .then((result) => {
            // TODO: ^ Check `statusCode`, `redirect` ?? etc. and not generate
            // pages that have e.g. 404 or 500 errors.
            results.push({...result, filename: '', path});
            discoveredPaths = discoveredPaths.concat(
              this.parsePathsFromMarkup(result.markup)
            );
          });
      }, Promise.resolve())
      .then(() => {
        return this.renderPages(props, discoveredPaths, renderedPaths, results);
      });
  }

  handleEmit = (compilation: Object, done: (?Error) => void) => {
    const stats = compilation.getStats().toJson();

    this.renderPages(this.options.mapStatsToProps(stats), this.options.paths)
      .then((results) =>
        results.map((result) => ({
          ...result,
          filename: this.getFilename(this.normalizePath(result), {
            content: result.markup,
          }),
        })),
      )
      .then(this.options.mapResults)
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
