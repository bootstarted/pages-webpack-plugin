// @flow

import cheerio from 'cheerio';
import loaderUtils from 'loader-utils';
import path from 'path';

type RenderResult = {
  markup: string,
  redirect?: string,
  status?: number,
};

type RenderProps = {
  path: string,
};

type OutputResult<T: RenderResult> = {
  ...T,
  markup: string,
  path: string,
  filename: string,
};

type RequiredOptions<T: RenderResult, P: RenderProps> = {|
  mapStatsToProps: (stats: Object) => P,
  render: (props: P) => T | Promise<T>,
|};

type Options<T: RenderResult, P: RenderProps> = {
  ...RequiredOptions<T, P>,
  name: string,
  paths: Array<string>,
  directory: boolean | ((OutputResult<T>) => boolean),
  mapResults: (Array<OutputResult<T>>) => Array<OutputResult<T>>,
};

class PagesPlugin<T: RenderResult, P: RenderProps> {
  options: Options<T, P>;

  constructor(options: RequiredOptions<T, P>) {
    this.options = {
      name: '[path][name].[ext]',
      paths: ['/'],
      directory: (result) => path.extname(result.path) === '',
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

  getUseDirectory(result: OutputResult<T>): boolean {
    if (typeof this.options.directory === 'boolean') {
      return this.options.directory;
    } else if (typeof this.options.directory === 'function') {
      return this.options.directory(result);
    }
    return true;
  }

  normalizePath(result: OutputResult<T>) {
    if (result.path.charAt(0) !== '/') {
      throw new TypeError(
        `PagesPlugin encountered invalid path: ${result.path}`,
      );
    }

    const path = this.getUseDirectory(result)
      ? `${result.path.substr(1)}/index.html`
      : result.path.substr(1);

    return path.replace(/^\//, './').replace(/\/\//g, '/');
  }

  parsePathsFromMarkup(markup: string): Array<string> {
    const $ = cheerio.load(markup);
    const relativeLinks = $('a[href^="/"], a[href^="."]');

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
