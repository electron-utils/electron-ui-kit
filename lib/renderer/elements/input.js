'use strict';

// requires
const utils = require('../utils');
const themeMgr = require('../theme-mgr');

class Input extends window.HTMLElement {
  static get css() { return 'theme://input.css'; }
  static get html() { return 'theme://input.html'; }

  get value () { return this.$input.value; }
  set value ( val ) {
    if ( val === null || val === undefined ) {
      val = '';
    }
    this.$input.value = val;
  }
  /**
   * @method constructor
   * @param {string} text
   */
  constructor (text) {
    super();
    this._inited = false;

    if ( text ) {
      this.value = text;
    }

    this.attachShadow({
      mode: 'open',
      // delegatesFocus: true
    });
    this.shadowRoot.innerHTML = themeMgr.load(Input.html);

    // init style
    let styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.textContent = themeMgr.load(Input.css);

    this.shadowRoot.insertBefore( styleElement, this.shadowRoot.firstChild );

    // query selector
    this.$input = this.shadowRoot.querySelector('input');
    if (!this.$input) {
      console.error('You must have <input> in your template');
      return;
    }

    // init $input
    this.$input.value = this.getAttribute('value');
    this.$input.placeholder = this.getAttribute('placeholder') || '';
    this.$input.type = this.getAttribute('password') !== null ? 'password' : '';
  }

  get placeholder () { return this.$input.placeholder; }
  set placeholder ( val ) {
    this.$input.placeholder = val;
  }

  get password () { return this.$input.type === 'password'; }
  set password ( val ) {
    this.$input.type = (val === true) ? 'password' : '';
  }

  connectedCallback () {
    if ( this._inited ) {
      return;
    }

    //
    // this._initFocusable(this, this.$input);
    this._initFocusable(this);
    this.$input.tabIndex = -1;

    this._initDisable(false, [this.$input]);
    this._initReadonly(false);
    this._initInputState(this.$input);

    this.$input.readOnly = this.readonly;

    // init events
    this.addEventListener('mousedown', this._mouseDownHandler);
    this.addEventListener('keydown', this._keyDownHandler);
    this.addEventListener('focus-changed', this._focusChangedHandler);
  }

  clear () {
    this.$input.value = '';
    this.confirm();
  }

  confirm () {
    this._onInputConfirm(this.$input);
  }

  cancel () {
    this._onInputCancel(this.$input);
  }

  // NOTE: override Readonly behavior
  _setIsReadonlyAttribute ( readonly ) {
    if ( readonly ) {
      this.setAttribute('is-readonly', '');
    } else {
      this.removeAttribute('is-readonly');
    }
    this.$input.readOnly = readonly;
  }

  _onInputConfirm ( inputEL, pressEnter ) {
    if ( !this.readonly ) {
      if ( this._changed ) {
        this._changed = false;
        inputEL._initValue = inputEL.value;

        utils.fire(this, 'confirm', {
          bubbles: false,
          detail: {
            value: inputEL.value,
            confirmByEnter: pressEnter,
          },
        });
      }
    }

    if ( pressEnter ) {
      // blur inputEL, focus to :host
      this.focus();
    }
  }

  _onInputCancel ( inputEL, pressEsc ) {
    if ( !this.readonly ) {
      if ( this._changed ) {
        this._changed = false;

        // reset to init value and emit change event
        if ( inputEL._initValue !== inputEL.value ) {
          inputEL.value = inputEL._initValue;

          utils.fire(this, 'change', {
            bubbles: false,
            detail: {
              value: inputEL.value,
            },
          });
        }

        utils.fire(this, 'cancel', {
          bubbles: false,
          detail: {
            value: inputEL.value,
            cancelByEsc: pressEsc,
          },
        });
      }
    }

    if ( pressEsc ) {
      // blur inputEL, focus to :host
      this.focus();
    }
  }

  _onInputChange ( inputEL ) {
    this._changed = true;

    utils.fire(this, 'change', {
      bubbles: false,
      detail: {
        value: inputEL.value,
      },
    });
  }

  _mouseDownHandler (event) {
    event.stopPropagation();
    this.focus();
  }

  _keyDownHandler (event) {
    if ( this.disabled ) {
      return;
    }

    // keydown 'enter' or 'space'
    if (event.keyCode === 13 || event.keyCode === 32) {
      utils.acceptEvent(event);
      this.$input._initValue = this.$input.value;
      this.$input.focus();
      this.$input.select();
    }

    // DISABLE
    // // keydown 'esc'
    // else if (event.keyCode === 27) {
    //   utils.acceptEvent(event);
    //   // FocusMgr._focusParent(this); // DISABLE
    // }
  }

  _focusChangedHandler () {
    if ( this.focused ) {
      this.$input._initValue = this.$input.value;
    }
  }
}

utils.addon(Input.prototype, require('../behaviors/focusable'));
utils.addon(Input.prototype, require('../behaviors/disable'));
utils.addon(Input.prototype, require('../behaviors/readonly'));
utils.addon(Input.prototype, require('../behaviors/input-state'));

module.exports = Input;
