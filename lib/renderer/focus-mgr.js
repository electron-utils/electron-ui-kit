'use strict';

// requires
const {shell} = require('electron');
const utils = require('./utils');

function _isNavigable(el) {
  return el.focusable && !el.disabled && !el.unnavigable;
}

function _getFocusableParent(el) {
  let parent = el.parentNode;
  // shadow root
  if (parent.host) {
    parent = parent.host;
  }

  while (parent) {
    if (parent.focusable && !parent.disabled) {
      return parent;
    }

    parent = parent.parentNode;
    // shadow root
    if (parent && parent.host) {
      parent = parent.host;
    }
  }

  return null;
}

// NOTE: it does not consider shadowRoot and host
//       it does not consider visibility in hierarchy
function _getFirstFocusableFrom(el, excludeSelf) {
  if (!excludeSelf) {
    if (!utils.isVisible(el)) {
      return null;
    }

    if (_isNavigable(el)) {
      return el;
    }
  }

  let parentEL = el, curEL = el;
  if (!curEL.children.length) {
    return null;
  }

  curEL = curEL.children[0];
  while (1) {
    if (!curEL) {
      curEL = parentEL;
      if (curEL === el) {
        return null;
      }

      parentEL = parentEL.parentElement;
      curEL = curEL.nextElementSibling;
    }

    if (curEL) {
      // skip check children if current element is invisible
      if (!utils.isVisible(curEL)) {
        curEL = curEL.nextElementSibling;
      } else {
        if (_isNavigable(curEL)) {
          return curEL;
        }

        if (curEL.children.length) {
          parentEL = curEL;
          curEL = curEL.children[0];
        } else {
          curEL = curEL.nextElementSibling;
        }
      }
    }
  }
}

// NOTE: it does not consider shadowRoot and host
//       it does not consider visibility in hierarchy
function _getLastFocusableFrom(el, excludeSelf) {
  let lastFocusable = null;

  if (!excludeSelf) {
    if (!utils.isVisible(el)) {
      return null;
    }

    if (_isNavigable(el)) {
      lastFocusable = el;
    }
  }

  let parentEL = el, curEL = el;
  if (!curEL.children.length) {
    return lastFocusable;
  }

  curEL = curEL.children[0];
  while (1) {
    if (!curEL) {
      curEL = parentEL;
      if (curEL === el) {
        return lastFocusable;
      }

      parentEL = parentEL.parentElement;
      curEL = curEL.nextElementSibling;
    }

    if (curEL) {
      // skip check children if current element is invisible
      if (!utils.isVisible(curEL)) {
        curEL = curEL.nextElementSibling;
      } else {
        if (_isNavigable(curEL)) {
          lastFocusable = curEL;
        }

        if (curEL.children.length) {
          parentEL = curEL;
          curEL = curEL.children[0];
        } else {
          curEL = curEL.nextElementSibling;
        }
      }
    }
  }
}

function _getNextFocusable(el) {
  let nextEL = _getFirstFocusableFrom(el, true);
  if (nextEL) {
    return nextEL;
  }

  let parentEL = el.parentElement, curEL = el.nextElementSibling;
  while (1) {
    if (!curEL) {
      curEL = parentEL;
      if (curEL === null) {
        return null;
      }

      parentEL = parentEL.parentElement;
      curEL = curEL.nextElementSibling;
    }

    if (curEL) {
      nextEL = _getFirstFocusableFrom(curEL);
      if (nextEL) {
        return nextEL;
      }

      curEL = curEL.nextElementSibling;
    }
  }
}

function _getPrevFocusable(el) {
  let prevEL;
  let parentEL = el.parentElement, curEL = el.previousElementSibling;

  while (1) {
    if (!curEL) {
      curEL = parentEL;
      if (curEL === null) {
        return null;
      }

      if (curEL.focusable && !curEL.disabled) {
        return curEL;
      }

      parentEL = parentEL.parentElement;
      curEL = curEL.previousElementSibling;
    }

    if (curEL) {
      prevEL = _getLastFocusableFrom(curEL);
      if (prevEL) {
        return prevEL;
      }

      curEL = curEL.previousElementSibling;
    }
  }
}

// ==========================
// exports
// ==========================

module.exports = class {
  constructor (rootEL) {
    this._disabled = false;
    this._rootEL = rootEL;
    this._focusedElement = null;
    this._lastFocusedElement = null;

    this._initEvents();
  }

  set disabled (val) {
    this._disabled = val;
  }
  get disabled () {
    return this._disabled;
  }

  _initEvents() {
    let rootEL = this._rootEL;

    rootEL.addEventListener('mousedown', event => {
      if (this._disabled) {
        return;
      }

      if (event.which === 1) {
        this._setFocusElement(null);
      }
    });

    rootEL.addEventListener('focus', () => {
      if (this._disabled) {
        return;
      }

      this._setFocusElement(this._lastFocusedElement);
    });

    rootEL.addEventListener('blur', () => {
      if (this._disabled) {
        return;
      }

      // NOTE: _focusedXXX can already be null, if we don't manually assign _lastFocusedXXX
      // it will not be setup in focusMgr._setFocusXXX() functions
      this._lastFocusedElement = this._focusedElement;

      if (!this._rootEL) {
        this._setFocusElement(null);
      }
    });

    // keydown Tab in capture phase
    rootEL.addEventListener('keydown', event => {
      if (this._disabled) {
        return;
      }

      // tab
      if (event.keyCode === 9) {
        if (event.ctrlKey || event.metaKey) {
          return;
        }

        utils.acceptEvent(event);
        let r;

        if (event.shiftKey) {
          r = this._focusPrev();
        } else {
          r = this._focusNext();
        }

        if (this._focusedElement) {
          this._focusedElement._navELs[0].focus();
        }

        if (!r) {
          shell.beep();
        }
      }
    }, true);

    // keydown up/down arrow in bubble phase
    rootEL.addEventListener('keydown', event => {
      if (this._disabled) {
        return;
      }

      // up-arrow
      if (event.keyCode === 38) {
        utils.acceptEvent(event);
        let r = this._focusPrev();
        if (!r) {
          shell.beep();
        }
      }
      // down-arrow
      else if (event.keyCode === 40) {
        utils.acceptEvent(event);
        let r = this._focusNext();
        if (!r) {
          shell.beep();
        }
      }
    });
  }

  _focusPrev() {
    let root = this._rootEL;
    let el = this._focusedElement;
    let lastEL = this._lastFocusedElement;

    //
    if (!el) {
      if (lastEL) {
        this._setFocusElement(lastEL);
        return true;
      }

      if (root) {
        el = _getFirstFocusableFrom(root, true);
        this._setFocusElement(el);
      }

      return;
    }

    //
    let prev, cur = el;

    // if the first-focusable-element of prev-focusable-element is current element, skip it.
    while (1) {
      prev = _getPrevFocusable(cur);

      if (!prev) {
        break;
      }

      if (prev._getFirstFocusableElement() !== cur) {
        break;
      }

      cur = prev;
    }

    if (!prev) {
      return false;
    }

    this._setFocusElement(prev);
    return true;
  }

  _focusNext() {
    let root = this._rootEL;
    let el = this._focusedElement;
    let lastEL = this._lastFocusedElement;

    //
    if (!el) {
      if (lastEL) {
        this._setFocusElement(lastEL);
        return true;
      }

      if (root) {
        el = _getFirstFocusableFrom(root, true);
        this._setFocusElement(el);
      }

      return;
    }

    let next = _getNextFocusable(el);
    if (!next) {
      return false;
    }

    this._setFocusElement(next);
    return true;
  }

  _focusParent(el) {
    let parent = _getFocusableParent(el);
    if (parent) {
      this._setFocusElement(parent);
    }
  }

  _setFocusElement (el) {
    // NOTE: disabled object can be focused, it just cannot be navigate.
    //       (for example, disabled prop can be fold/foldup by left/right key)
    // if ( el && el.disabled ) {
    //   el = null;
    // }

    // check if this is null element and we don't have focused root
    if (!el) {
      if (this._focusedElement) {
        this._lastFocusedElement = this._focusedElement;
        this._focusedElement._setFocused(false);
        this._focusedElement = null;
      }
    }

    //
    let focusedElement = this._focusedElement;
    if (focusedElement !== el) {
      if (focusedElement) {
        focusedElement._setFocused(false);
      }

      this._lastFocusedElement = focusedElement;
      this._focusedElement = el;

      if (el) {
        el._setFocused(true);
      }
    }
  }

};