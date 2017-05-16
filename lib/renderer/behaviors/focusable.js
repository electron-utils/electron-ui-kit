'use strict';

const utils = require('../utils');

// ==========================
// exports
// ==========================

module.exports = {
  get focusable() {
    return true;
  },

  /**
   * @property focused
   * @readonly
   */
  get focused() {
    return this.getAttribute('focused') !== null;
  },

  /**
   * @property unnavigable
   */
  get unnavigable() {
    return this.getAttribute('unnavigable') !== null;
  },
  set unnavigable(val) {
    if (val) {
      this.setAttribute('unnavigable', '');

      this.tabIndex = -1;
      for (let i = 0; i < this._navELs.length; ++i) {
        let el = this._navELs[i];
        el.tabIndex = -1;
      }
    } else {
      this.removeAttribute('unnavigable');

      this.tabIndex = 0;
      for (let i = 0; i < this._navELs.length; ++i) {
        let el = this._navELs[i];
        el.tabIndex = 0;
      }
    }
  },

  // NOTE: this is invoke in disable
  unfocusable(val) {
    if (val) {
      this.removeAttribute('tabIndex');
      for (let i = 0; i < this._focusELs.length; ++i) {
        let el = this._focusELs[i];
        el.removeAttribute('tabIndex');
      }
      for (let i = 0; i < this._navELs.length; ++i) {
        let el = this._navELs[i];
        el.removeAttribute('tabIndex');
      }
    } else {
      // REF: http://webaim.org/techniques/keyboard/tabindex
      for (let i = 0; i < this._focusELs.length; ++i) {
        let el = this._focusELs[i];
        el.tabIndex = -1;
      }

      for (let i = 0; i < this._navELs.length; ++i) {
        let el = this._navELs[i];
        el.tabIndex = 0;
      }

      // NOTE: always make sure this element focusable
      if (this.getAttribute('unnavigable') !== null) {
        this.tabIndex = -1;
      } else {
        this.tabIndex = 0;
      }
    }
  },

  _initFocusable(focusELs, navELs) {
    // focusELs
    if (focusELs) {
      if (Array.isArray(focusELs)) {
        this._focusELs = focusELs;
      } else {
        this._focusELs = [focusELs];
      }
    } else {
      this._focusELs = [];
    }

    // navELs
    if (navELs) {
      if (Array.isArray(navELs)) {
        this._navELs = navELs;
      } else {
        this._navELs = [navELs];
      }
    } else {
      this._navELs = this._focusELs;
    }

    // REF: http://webaim.org/techniques/keyboard/tabindex
    for (let i = 0; i < this._focusELs.length; ++i) {
      let el = this._focusELs[i];
      el.tabIndex = -1;
      el.addEventListener('focus', () => { this._curFocus = el; });
    }

    for (let i = 0; i < this._navELs.length; ++i) {
      let el = this._navELs[i];
      el.tabIndex = 0;
    }

    // NOTE: always make sure this element focusable
    if (this.getAttribute('unnavigable') !== null) {
      this.tabIndex = -1;
    } else {
      this.tabIndex = 0;
    }

    this.addEventListener('focus', event => {
      event.stopPropagation();
      event.preventDefault();

      this._setFocused(true);
    });

    this.addEventListener('blur', event => {
      event.stopPropagation();
      event.preventDefault();

      this._setFocused(false);
    });
  },

  _getFirstFocusableElement() {
    if (this._focusELs.length > 0) {
      return this._focusELs[0];
    }
    return null;
  },

  // NOTE: only invoked by FocusMgr
  _setFocused(focused) {
    // NOTE: disabled object can be focused, it just cannot be navigate.
    //       (for example, disabled prop can be fold/foldup by left/right key)
    // if ( this._isDisabledInHierarchy() ) {
    //   return;
    // }

    if (this.focused === focused) {
      return;
    }

    if (focused) {
      this.setAttribute('focused', '');

      if (this._focusELs.length > 0) {
        let focusEL = this._focusELs[0];
        if (focusEL === this) {
          focusEL.focus();
        } else {
          if (focusEL.focusable) {
            focusEL._setFocused(true);
          } else {
            focusEL.focus();
          }
        }
      }
    } else {
      this.removeAttribute('focused');

      this._focusELs.forEach(el => {
        if (el.focusable && el.focused) {
          el._setFocused(false);
        }
      });
    }

    utils.fire(this, 'focus-changed', {
      bubbles: true,
      detail: {
        focused: this.focused,
      },
    });
  },
};
