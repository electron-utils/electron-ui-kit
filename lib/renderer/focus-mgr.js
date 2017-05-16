'use strict';

let focusMgr = {};
module.exports = focusMgr;

// requires
const electron = require('electron');
const utils = require('./dom-utils');

// const dockUtils = require('./dock-utils');

// panel focus
let _focusedRootEL = null;
let _lastFocusedRootEL = null;

// global focus
let _focusedElement = null;
let _lastFocusedElement = null;

let _disabled = false;

// ==========================
// exports
// ==========================

focusMgr._isNavigable = function (el) {
  return el.focusable && !el.disabled && !el.unnavigable;
};

focusMgr._focusPrev = function () {
  let root, el, lastEL;
  if (_focusedRootEL) {
    root = _focusedRootEL;
  } else {
    root = document.body;
  }
  el = _focusedElement;
  lastEL = _lastFocusedElement;

  //
  if (!el) {
    if (lastEL) {
      focusMgr._setFocusElement(lastEL);
      return true;
    }

    if (root) {
      el = focusMgr._getFirstFocusableFrom(root, true);
      focusMgr._setFocusElement(el);
    }

    return;
  }

  //
  let prev, cur = el;

  // if the first-focusable-element of prev-focusable-element is current element, skip it.
  while (1) {
    prev = focusMgr._getPrevFocusable(cur);

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

  focusMgr._setFocusElement(prev);
  return true;
};

focusMgr._focusNext = function () {
  let root, el, lastEL;
  if (_focusedRootEL) {
    root = _focusedRootEL.root;
    el = _focusedRootEL._focusedElement;
    lastEL = _focusedRootEL._lastFocusedElement;
  } else {
    root = document.body;
    el = _focusedElement;
    lastEL = _lastFocusedElement;
  }

  //
  if (!el) {
    if (lastEL) {
      focusMgr._setFocusElement(lastEL);
      return true;
    }

    if (root) {
      el = focusMgr._getFirstFocusableFrom(root, true);
      focusMgr._setFocusElement(el);
    }

    return;
  }

  let next = focusMgr._getNextFocusable(el);
  if (!next) {
    return false;
  }

  focusMgr._setFocusElement(next);
  return true;
};

focusMgr._focusParent = function (el) {
  let parent = focusMgr._getFocusableParent(el);
  if (parent) {
    // DISABLE:
    // if (dockUtils.isPanel(parent)) {
    //   focusMgr._setFocusElement(null);
    //   parent.activeTab.frameEL.focus();
    // } else {
    //   focusMgr._setFocusElement(parent);
    // }

    focusMgr._setFocusElement(parent);
  }
};

focusMgr._setFocusRoot = function (panelFrame) {
  let blurPanel, focusPanel;

  // focus out global element
  if (panelFrame && _focusedElement) {
    _lastFocusedElement = _focusedElement;
    _focusedElement._setFocused(false);
    _focusedElement = null;
  }

  // process panel
  if (_focusedRootEL) {
    blurPanel = _focusedRootEL.parentElement;
  }

  if (panelFrame) {
    focusPanel = panelFrame.parentElement;
  }

  if (blurPanel !== focusPanel) {
    if (blurPanel) {
      blurPanel._setFocused(false);
    }

    if (focusPanel) {
      focusPanel._setFocused(true);
    }
  }

  // process panel frame
  if (_focusedRootEL !== panelFrame) {
    if (_focusedRootEL) {
      _focusedRootEL.blur();

      // blur element
      if (_focusedRootEL._focusedElement) {
        _focusedRootEL._focusedElement._setFocused(false);
      }
    }

    _lastFocusedRootEL = _focusedRootEL;
    _focusedRootEL = panelFrame;

    if (panelFrame) {
      panelFrame.focus();

      // focus element
      if (panelFrame._focusedElement) {
        panelFrame._focusedElement._setFocused(true);
      }
    }
  }
};

// NOTE: this is because sometimes we mouse-click other place, but we don't want this change the current focused
focusMgr._refocus = function () {
  if (_focusedRootEL) {
    let panel = _focusedRootEL.parentElement;
    if (!panel) {
      focusMgr._setFocusRoot(null);
      return;
    }

    panel._setFocused(true);

    // NOTE: if we have focused element, skip focus panel frame
    if (_focusedRootEL._focusedElement) {
      let el = _focusedRootEL._focusedElement._getFirstFocusableElement();
      el.focus();
      return;
    }

    _focusedRootEL.focus();
  }
};

focusMgr._setFocusElement = function (el) {
  // NOTE: disabled object can be focused, it just cannot be navigate.
  //       (for example, disabled prop can be fold/foldup by left/right key)
  // if ( el && el.disabled ) {
  //   el = null;
  // }

  // DISABLE: HACK
  // if (el && dockUtils.isPanel(el)) {
  //   el.focus();
  //   return;
  // }

  // let panelEL = DockUtils.inPanel(el);

  // check if this is a global element
  // NOTE: it can not detect null element
  if (el && !_focusedRootEL) {
    // process global element
    if (_focusedElement !== el) {
      if (_focusedElement) {
        _focusedElement._setFocused(false);
      }

      _lastFocusedElement = _focusedElement;
      _focusedElement = el;

      if (el) {
        el._setFocused(true);
      }
    }
  }

  // check if this is null element and we don't have focused root
  if (!el && !_focusedRootEL) {
    // focus out global element
    if (_focusedElement) {
      _lastFocusedElement = _focusedElement;
      _focusedElement._setFocused(false);
      _focusedElement = null;
    }
  }

  // check if we have focused panel
  if (_focusedRootEL) {
    // focus out global element
    if (_focusedElement) {
      _lastFocusedElement = _focusedElement;
      _focusedElement._setFocused(false);
      _focusedElement = null;
    }

    // process panel element
    let focusedElement = _focusedRootEL._focusedElement;
    if (focusedElement !== el) {
      if (focusedElement) {
        focusedElement._setFocused(false);
      }

      _focusedRootEL._lastFocusedElement = focusedElement;
      _focusedRootEL._focusedElement = el;

      if (el) {
        el._setFocused(true);
      } else {
        _focusedRootEL.focus();
      }
    }
  }
};

// NOTE: it does not consider shadowRoot and host
//       it does not consider visibility in hierarchy
focusMgr._getFirstFocusableFrom = function (el, excludeSelf) {
  if (!excludeSelf) {
    if (!utils.isVisible(el)) {
      return null;
    }

    if (focusMgr._isNavigable(el)) {
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
        if (focusMgr._isNavigable(curEL)) {
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
};

// NOTE: it does not consider shadowRoot and host
//       it does not consider visibility in hierarchy
focusMgr._getLastFocusableFrom = function (el, excludeSelf) {
  let lastFocusable = null;

  if (!excludeSelf) {
    if (!utils.isVisible(el)) {
      return null;
    }

    if (focusMgr._isNavigable(el)) {
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
        if (focusMgr._isNavigable(curEL)) {
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
};

focusMgr._getFocusableParent = function (el) {
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
};

focusMgr._getNextFocusable = function (el) {
  let nextEL = focusMgr._getFirstFocusableFrom(el, true);
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
      nextEL = focusMgr._getFirstFocusableFrom(curEL);
      if (nextEL) {
        return nextEL;
      }

      curEL = curEL.nextElementSibling;
    }
  }
};

focusMgr._getPrevFocusable = function (el) {
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
      prevEL = focusMgr._getLastFocusableFrom(curEL);
      if (prevEL) {
        return prevEL;
      }

      curEL = curEL.previousElementSibling;
    }
  }
};

Object.defineProperty(focusMgr, 'lastFocusedPanelFrame', {
  enumerable: true,
  get() {
    return _lastFocusedRootEL;
  },
});

Object.defineProperty(focusMgr, 'focusedPanelFrame', {
  enumerable: true,
  get() {
    return _focusedRootEL;
  },
});

Object.defineProperty(focusMgr, 'lastFocusedElement', {
  enumerable: true,
  get() {
    if (_focusedRootEL) {
      return _focusedRootEL._lastFocusedElement;
    } else {
      return _lastFocusedElement;
    }
  },
});

Object.defineProperty(focusMgr, 'focusedElement', {
  enumerable: true,
  get() {
    if (_focusedRootEL) {
      return _focusedRootEL._focusedElement;
    } else {
      return _focusedElement;
    }
  },
});

Object.defineProperty(focusMgr, 'disabled', {
  enumerable: true,
  get() {
    return _disabled;
  },
  set(val) {
    _disabled = val;
  }
});

// ==========================
// Dom
// ==========================

window.addEventListener('mousedown', event => {
  if (_disabled) {
    return;
  }

  if (event.which === 1) {
    focusMgr._setFocusElement(null);
    focusMgr._setFocusRoot(null);
  }
});

window.addEventListener('focus', () => {
  if (_disabled) {
    return;
  }

  focusMgr._setFocusElement(_lastFocusedElement);
  focusMgr._setFocusRoot(_lastFocusedRootEL);
});

window.addEventListener('blur', () => {
  if (_disabled) {
    return;
  }

  // NOTE: _focusedXXX can already be null, if we don't manually assign _lastFocusedXXX
  // it will not be setup in focusMgr._setFocusXXX() functions
  _lastFocusedElement = _focusedElement;
  _lastFocusedRootEL = _focusedRootEL;

  if (!_focusedRootEL) {
    focusMgr._setFocusElement(null);
  }
  focusMgr._setFocusRoot(null);
});

// keydown Tab in capture phase
window.addEventListener('keydown', event => {
  if (_disabled) {
    return;
  }

  // tab
  if (event.keyCode === 9) {
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    // if the focused panel frame is not a <ui-panel-frame>, skip it
    if (_focusedRootEL && !DockUtils.isPanelFrame(_focusedRootEL)) {
      return;
    }

    utils.acceptEvent(event);
    let r;

    if (event.shiftKey) {
      r = focusMgr._focusPrev();
    } else {
      r = focusMgr._focusNext();
    }

    if (focusMgr.focusedElement) {
      focusMgr.focusedElement._navELs[0].focus();
    }

    if (!r) {
      electron.shell.beep();
    }
  }
}, true);

// keydown up/down arrow in bubble phase
window.addEventListener('keydown', event => {
  if (_disabled) {
    return;
  }

  // up-arrow
  if (event.keyCode === 38) {
    utils.acceptEvent(event);
    let r = focusMgr._focusPrev();
    if (!r) {
      electron.shell.beep();
    }
  }
  // down-arrow
  else if (event.keyCode === 40) {
    utils.acceptEvent(event);
    let r = focusMgr._focusNext();
    if (!r) {
      electron.shell.beep();
    }
  }
});
