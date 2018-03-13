// @flow
import cheerio from 'cheerio';
import loaderUtils from 'loader-utils';

type RenderResult = {
  markup: string,
};

type OutputResult = {
  markup: string,
  path: string,
};

type RenderFunction = (props: Object) => RenderResult | Promise<RenderResult>;

type Options = {
  name: string,
  directory?: ((OutputResult) => boolean) | boolean,
  mapStatsToProps: (stats: Object) => Object,
  mapResults?: (Array<OutputResult>) => Array<OutputResult>,
  render: RenderFunction,
  paths?: Array<string>,
};

type DoItOptions = {
  render: RenderFunction,
  props: Object,
  paths: Array<string>,
};

const doIt = ({render, props, paths = ['/']}: DoItOptions) => {
  const pathMap = {};
  const renderPaths = (
    results: Array<OutputResult>,
    paths: Array<string>
  ): Promise<Array<OutputResult>> => {
    if (paths.length === 0) {
      return Promise.resolve(results);
    }
    const next = [];
    const newResults = results.slice();
    return paths
      .reduce((previous: Promise<*>, path: string) => {
        if (pathMap[path]) {
          return previous;
        }
        pathMap[path] = true;
        return previous.then(() => {
          const result: Promise<RenderResult> = Promise.resolve(
            render({path, ...props})
          );
          return result.then((data) => {
            // TODO: ^ Check `statusCode`, `redirect` ?? etc. and not generate
            // pages that have e.g. 404 or 500 errors.
            newResults.push({path, ...data});
            const $ = cheerio.load(data.markup);
            $('a[href^="/"]').each((i, elem) => {
              const path = $(elem).attr('href');
              next.push(path);
            });
          });
        });
      }, Promise.resolve())
      .then(() => {
        return renderPaths(newResults, next);
      });
  };
  return renderPaths([], paths);
};

const defaultOptions: Options = {
  name: '[path][name].[ext]',
  paths: ['/'],
  mapStatsToProps: () => {
    throw new TypeError();
  },
  render: () => {
    throw new TypeError();
  },
  directory: (result: OutputResult): boolean => {
    const parts = result.path.split('/');
    return parts[parts.length - 1].indexOf('.') < 0;
  },
};

class PagesPlugin {
  options: Options;

  constructor(options: Options) {
    this.options = {
      ...defaultOptions,
      ...options,
    };
  }

  getName(resourcePath: string, options: Object) {
    return loaderUtils
      .interpolateName({resourcePath}, this.options.name, options)
      .replace(/^\.\//, '');
  }

  getUseDirectory(result: OutputResult): boolean {
    if (typeof this.options.directory === 'boolean') {
      return this.options.directory;
    } else if (typeof this.options.directory === 'function') {
      return this.options.directory(result);
    }
    return true;
  }

  normalizePath(result: OutputResult) {
    if (result.path.charAt(0) !== '/') {
      throw new TypeError();
    }
    const path = this.getUseDirectory(result)
      ? `${result.path.substr(1)}/index.html`
      : result.path.substr(1);
    return path.replace(/^\//, './').replace(/\/\//g, '/');
  }

  apply(compiler: any) {
    const {mapStatsToProps, render, paths} = this.options;
    compiler.plugin('emit', (compilation, callback) => {
      const stats = compilation.getStats().toJson();
      doIt({
        render,
        props: mapStatsToProps(stats),
        paths: paths || ['/'],
      })
        .then((preResults) => {
          preResults.forEach((result) => {
            const path = this.getName(this.normalizePath(result), {
              content: result.markup,
            });
            result.path = path;
          });
          const results =
            typeof this.options.mapResults === 'undefined'
              ? preResults
              : this.options.mapResults(preResults);
          results.forEach((result) => {
            compilation.assets[result.path] = {
              source: function() {
                return result.markup;
              },
              size: function() {
                return result.markup.length;
              },
            };
          });
          callback();
        })
        .catch(callback);
    });
  }
}

export default PagesPlugin;
