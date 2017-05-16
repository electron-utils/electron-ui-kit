'use strict';

const utils = require('../utils');
const themeMgr = require('../theme-mgr');

class Checkbox extends window.HTMLElement {
  static get css() { return 'theme://checkbox.css'; }
  static get html() { return 'theme://checkbox.html'; }

  /**
   * @method constructor
   * @param {boolean} checked
   * @param {string} text
   */
  constructor (checked, text) {
    super();
    this._inited = false;

    if ( text ) {
      this.innerText = text;
    }

    if (checked !== undefined) {
      this.checked = checked;
    }

    this.attachShadow({
      mode: 'open'
    });
    this.shadowRoot.innerHTML = themeMgr.load(Checkbox.html);

    // init style
    let styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.textContent = themeMgr.load(Checkbox.css);

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
    this._initReadonly(false);
    this._initButtonState(this);
  }

  _onButtonClick () {
    this.checked = !this.checked;
    utils.fire(this, 'change', {
      bubbles: false,
      detail: {
        value: this.checked,
      },
    });
    utils.fire(this, 'confirm', {
      bubbles: false,
      detail: {
        value: this.checked,
      },
    });
  }

  /**
   * @property checked
   */
  get checked () {
    return this.getAttribute('checked') !== null;
  }
  set checked (val) {
    if (val) {
      this.setAttribute('checked', '');
    } else {
      this.removeAttribute('checked');
    }
  }

  /**
   * @property value
   */
  get value () {
    return this.checked;
  }
  set value (val) {
    this.checked = val;
  }
}

utils.addon(Checkbox.prototype, require('../behaviors/focusable'));
utils.addon(Checkbox.prototype, require('../behaviors/disable'));
utils.addon(Checkbox.prototype, require('../behaviors/readonly'));
utils.addon(Checkbox.prototype, require('../behaviors/button-state'));

module.exports = Checkbox;