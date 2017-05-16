'use strict';

const utils = require('../utils');
const themeMgr = require('../theme-mgr');

class Button extends window.HTMLElement {
  static get css() { return 'theme://button.css'; }
  static get html() { return 'theme://button.html'; }

  /**
   * @method constructor
   * @param {string} text
   */
  constructor (text) {
    super();
    this._inited = false;

    if (text) {
      this.innerText = text;
    }

    this.attachShadow({
      mode: 'open'
    });
    this.shadowRoot.innerHTML = themeMgr.load(Button.html);

    // init style
    let styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.textContent = themeMgr.load(Button.css);

    // DISABLE:
    // let styleElement = document.createElement('link');
    // styleElement.rel = 'stylesheet';
    // styleElement.href = Button.css;

    this.shadowRoot.insertBefore( styleElement, this.shadowRoot.firstChild );
  }

  connectedCallback () {
    if ( this._inited ) {
      return;
    }

    // init
    this._inited = true;

    // init behaivours
    this._initFocusable(this);
    this._initDisable(false);
    this._initButtonState(this);
  }

  _onButtonClick() {
    // make sure click event first
    setTimeout(() => {
      utils.fire(this, 'confirm', { bubbles: false });
    }, 1);
  }
}

utils.addon(Button.prototype, require('../behaviors/focusable'));
utils.addon(Button.prototype, require('../behaviors/disable'));
utils.addon(Button.prototype, require('../behaviors/button-state'));

module.exports = Button;