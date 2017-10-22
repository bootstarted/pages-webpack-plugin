// @flow
import cheerio from 'cheerio';
import loaderUtils from 'loader-utils';

type RenderResult = {
  markup: string
}

type RenderFunction = (props: Object) => (RenderResult | Promise<RenderResult>);

type Options = {
  name: string,
  mapStatsToProps: (stats: Object) => Object,
  render: RenderFunction,
  paths: Array<string>,
}

type OutputResult = {
  markup: string,
  path: string,
};

type DoItOptions = {
  render: RenderFunction,
  props: Object,
  paths: Array<string>,
};

const doIt = ({
  render,
  props,
  paths = ['/'],
}: DoItOptions) => {
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
    return paths.reduce((previous: Promise<*>, path: string) => {
      if (pathMap[path]) {
        return previous;
      }
      pathMap[path] = true;
      return previous.then(() => {
        const result: Promise<RenderResult> = (
          Promise.resolve(render({path, ...props}))
        );
        return result.then(({markup}) => {
          // TODO: ^ Check `statusCode`, `redirect` ?? etc. and not generate
          // pages that have e.g. 404 or 500 errors.
          newResults.push({markup, path});
          const $ = cheerio.load(markup);
          $('a[href^="/"]').each((i, elem) => {
            const path = $(elem).attr('href');
            next.push(path);
          });
        });
      });
    }, Promise.resolve()).then(() => {
      return renderPaths(newResults, next);
    });
  };
  return renderPaths([], paths);
};

class PagesPlugin {
  options: Options;

  constructor(options: Options) {
    this.options = options;
  }

  getName(resourcePath: string, options: Object) {
    return loaderUtils.interpolateName(
      {resourcePath},
      this.options.name,
      options
    ).replace(/^\.\//, '');
  }

  normalizePath(path: string) {
    if (path.charAt(0) !== '/') {
      throw new TypeError();
    }
    return `${path.substr(1)}/index.html`
      .replace(/^\//, './')
      .replace(/\/\//g, '/');
  }

  apply(compiler: any) {
    const {mapStatsToProps, render, paths} = this.options;
    compiler.plugin('emit', (compilation, callback) => {
      const stats = compilation.getStats().toJson();
      doIt({
        render,
        props: mapStatsToProps(stats),
        paths: paths,
      }).then((results) => {
        results.forEach((result) => {
          const path = this.getName(this.normalizePath(result.path), {
            content: result.markup,
          });
          compilation.assets[path] = {
            source: function() {
              return result.markup;
            },
            size: function() {
              return result.markup.length;
            },
          };
        });
        callback();
      }).catch(callback);
    });
  }
}

export default PagesPlugin;
