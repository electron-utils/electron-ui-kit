'use strict';

const utils = require('../utils');

function _pressed($el) {
  return $el.getAttribute('pressed') !== null;
}

// ==========================
// exports
// ==========================

module.exports = {
  _initButtonState($el) {
    // process $el events
    utils.installDownUpEvent($el);

    $el.addEventListener('keydown', event => {
      if (this.disabled) {
        return;
      }

      if (event.keyCode === 32 /*space*/) {
        utils.acceptEvent(event);

        this._setPressed($el, true);
        this._canceledByEsc = false;

      } else if (event.keyCode === 13 /*enter*/) {
        utils.acceptEvent(event);

        if (this._enterTimeoutID) {
          return;
        }

        this._setPressed($el, true);
        this._canceledByEsc = false;

        this._enterTimeoutID = setTimeout(() => {
          this._enterTimeoutID = null;
          this._setPressed($el, false);
          $el.click();
        }, 100);

      } else if (event.keyCode === 27 /*esc*/) {
        utils.acceptEvent(event);

        if (_pressed($el)) {
          utils.fire($el, 'cancel', { bubbles: false });
          this._canceledByEsc = true;
        }
        this._setPressed($el, false);
      }
    });

    $el.addEventListener('keyup', event => {
      if (event.keyCode === 32 /*space*/) {
        utils.acceptEvent(event);

        if (_pressed($el)) {
          // async-click
          setTimeout(() => {
            $el.click();
          }, 1);
        }
        this._setPressed($el, false);
      }
    });

    $el.addEventListener('down', event => {
      utils.acceptEvent(event);

      this.focus();
      this._setPressed($el, true);
      this._canceledByEsc = false;
    });

    $el.addEventListener('up', event => {
      utils.acceptEvent(event);

      this._setPressed($el, false);
    });

    $el.addEventListener('click', event => {
      if (this.readonly) {
        return;
      }

      if (this._canceledByEsc) {
        this._canceledByEsc = false;
        utils.acceptEvent(event);
        return;
      }

      this._onButtonClick($el);
    });

    $el.addEventListener('blur', () => {
      this._setPressed($el, false);
    });
  },

  _setPressed($el, val) {
    if (val) {
      $el.setAttribute('pressed', '');
    } else {
      $el.removeAttribute('pressed');
    }
  },
};