'use strict';
let _caches = {};

function _loadPromise(url) {
  return new Promise((resolve, reject) => {
    let xhr = new window.XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = onreadystatechange;
    xhr.send(null);

    function onreadystatechange(e) {
      if (xhr.readyState !== 4) {
        return;
      }

      // Testing harness file:/// results in 0.
      if ([0, 200, 304].indexOf(xhr.status) === -1) {
        reject(`While loading from url ${url} server responded with a status of ${xhr.status}`);
      } else {
        _cacheResource(url, e.target.response);
        resolve(e.target.response);
      }
    }
  });
}

function _cacheResource(url, content) {
  if (content === undefined) {
    console.error(`Failed to load resource: ${url}`);
    _caches[url] = undefined;
    return;
  }

  // TODO: if this is a javascript:
  // content = `${content}\n//# sourceURL=${url}`;

  _caches[url] = content;
  return content;
}

module.exports = {
  init(urls) {
    if (!Array.isArray(urls)) {
      return Promise.reject('Please send an array as the first parameter');
    }

    let promises = [];
    for (let i = 0; i < urls.length; ++i) {
      let url = urls[i];
      let promise = _loadPromise(url).catch(err => {
        console.error(err);
      });

      promises.push(promise);
    }
    return Promise.all(promises);
  },

  load(url) {
    let content = _caches[url];
    if (!content) {
      console.error(`Failed to load ${url}: resource not found.`);
      return '';
    }

    return content;
  }
};