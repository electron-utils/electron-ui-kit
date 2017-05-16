'use strict';

const fs = require('fs');
const fsJetpack = require('fs-jetpack');
const path_ = require('path');
const chalk = require('chalk');
const async_ = require('async');
const less = require('less');
const lessPluginCleanCSS = require('less-plugin-clean-css');
const {minify} = require('html-minifier');

const dev = false;

let themes = [
  'default',
];
let plugins;

if (dev) {
  plugins = [];
} else {
  plugins = [
    new lessPluginCleanCSS({
      advanced: true,
    })
  ];
}

themes.forEach(theme => {
  let destDir = `./bin/themes/${theme}`;
  let commonDir = `./lib/themes/common`;
  let themeDir = `./lib/themes/${theme}`;

  // clear directory
  fsJetpack.dir(destDir, { empty: true });

  async_.series([
    // build less
    next => {
      console.log(chalk.cyan('css:'));

      let files = fs.readdirSync(themeDir);
      async_.eachSeries(files, (file, done) => {
        if (file === 'common.less' || path_.extname(file) !== '.less') {
          done();
          return;
        }

        process.stdout.write(chalk.blue('compile ') + chalk.cyan(file) + ' ...... ');

        let path = path_.join(themeDir, file);
        let content = fs.readFileSync(path, { encoding: 'utf8' });

        less.render(content, {
          paths: ['./lib/themes'],
          plugins: plugins,
        }).then(output => {
          fs.writeFileSync(path_.join(destDir, `${path_.basename(file, '.less')}.css`), output.css, 'utf8');
          process.stdout.write(chalk.green('done\n'));
          done();
        }).catch(err => {
          console.error(chalk.red(err));
          process.stdout.write(chalk.red('error\n'));
          done(err);
        });
      }, next);
    },

    // build html
    next => {
      console.log();
      console.log(chalk.cyan('html:'));

      let files = fs.readdirSync(themeDir);
      async_.eachSeries(files, (file, done) => {
        if (path_.extname(file) !== '.html') {
          done();
          return;
        }

        process.stdout.write(chalk.blue('compile ') + chalk.cyan(file) + ' ...... ');

        let path = path_.join(themeDir, file);
        let content = fs.readFileSync(path, { encoding: 'utf8' });

        let output = minify(content, {
          removeAttributeQuotes: true,
          collapseWhitespace: true,
        });

        fs.writeFileSync(path_.join(destDir, file), output, 'utf8');
        process.stdout.write(chalk.green('done\n'));
        done();

      }, next);
    },

    // build common
    next => {
      console.log();
      console.log(chalk.cyan('copy:'));

      // copies
      ['font', 'img', 'fontello.css'].forEach(file => {
        let path = path_.join(commonDir, file);
        process.stdout.write(chalk.blue('copy ') + chalk.cyan(file) + ' ...... ');

        fsJetpack.copy(path, path_.join(destDir, file));
        process.stdout.write(chalk.green('done\n'));
      });

      // build common less
      async_.eachSeries(['layout.less'], (file, done) => {
        process.stdout.write(chalk.blue('compile ') + chalk.cyan(file) + ' ...... ');

        let path = path_.join(commonDir, file);
        let content = fs.readFileSync(path, { encoding: 'utf8' });

        less.render(content, {
          paths: ['./lib/themes'],
          plugins: plugins,
        }).then(output => {
          fs.writeFileSync(path_.join(destDir, `${path_.basename(file, '.less')}.css`), output.css, 'utf8');
          process.stdout.write(chalk.green('done\n'));
          done();
        }).catch(err => {
          console.error(chalk.red(err));
          process.stdout.write(chalk.red('error\n'));
          done(err);
        });

      }, next);
    },
  ], err => {
    if (err) {
      console.error(chalk.red(err));
    }

    console.log(chalk.green('finish'));
  });
});