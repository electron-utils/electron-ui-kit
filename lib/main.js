'use strict';

const path = require('path');
const protocols = require('electron-protocols');

let _themePath = 'default';

protocols.register('theme', uri => {
  let relativePath = uri.hostname;
  if (uri.pathname) {
    relativePath = path.join(relativePath, uri.pathname);
  }

  return path.join(_themePath, relativePath);
});

// =========================
// exports
// =========================

module.exports = {
  setTheme (theme) {
    _themePath = theme;
  }
};