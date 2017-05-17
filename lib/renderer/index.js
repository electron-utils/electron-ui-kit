'use strict';

const utils = require('./utils');
const themeMgr = require('./theme-mgr');
const Button = require('./elements/button');
const Checkbox = require('./elements/checkbox');
const Input = require('./elements/input');

// ==========================
// exports
// ==========================

module.exports = {
  utils,
  Button,
  Checkbox,
  Input,
};

// ==========================
// custom elements
// ==========================

document.addEventListener('readystatechange', () => {
  if ( document.readyState === 'interactive' ) {
    // let styleElement = document.createElement('link');
    // styleElement.rel = 'stylesheet';
    // styleElement.href = 'theme://global.css';
    // document.head.appendChild(styleElement);

    themeMgr.init([
      'theme://button.html',
      'theme://button.css',
      'theme://checkbox.html',
      'theme://checkbox.css',
      'theme://input.html',
      'theme://input.css',
    ]).then(() => {
      // NOTE: we should define in order of dependencies
      // This is because, when we load a index.html with predefined custom element in it.
      // The custom-elements' constructor will be trigger immediately during `customElements.define` invokes.
      window.customElements.define('ui-button', Button);
      window.customElements.define('ui-checkbox', Checkbox);
      window.customElements.define('ui-input', Input);
    });
  }
});
