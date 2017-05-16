'use strict';

// requires
const _ = require('lodash');
const chroma = require('chroma-js');
const protocols = require('electron-protocols');
const fs = require('fs');

// ==========================
// internals
// ==========================

let _type2proto = {};

let _cancelDrag = null;
let _dragGhost = null;

let _hitGhost = null;
let _hitGhostMousedownHandle = null;

let _loadingMask = null;
let _loadingMaskMousedownHandle = null;

let _mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click'];
// an array of bitmask values for mapping MouseEvent.which to MouseEvent.buttons
let _which2buttons = [0, 1, 4, 2];
let _mouseHasButtons = (function() {
  try {
    return new MouseEvent('test', {buttons: 1}).buttons === 1;
  } catch (e) {
    return false;
  }
})();

function _hasLeftMouseButton(e) {
  var type = e.type;
  // exit early if the event is not a mouse event
  if (_mouseEvents.indexOf(type) === -1) {
    return false;
  }
  // e.button is not reliable for mousemove (0 is overloaded as both left button and no buttons)
  // instead we use e.buttons (bitmask of buttons) or fall back to e.which (deprecated, 0 for no buttons, 1 for left button)
  if (type === 'mousemove') {
    // allow undefined for testing events
    var buttons = e.buttons === undefined ? 1 : e.buttons;
    if ((e instanceof window.MouseEvent) && !_mouseHasButtons) {
      buttons = _which2buttons[e.which] || 0;
    }
    // buttons is a bitmask, check that the left button bit is set (1)
    return Boolean(buttons & 1);
  } else {
    // allow undefined for testing events
    var button = e.button === undefined ? 0 : e.button;
    // e.button is 0 in mousedown/mouseup/click for left button activation
    return button === 0;
  }
}

function _getPropertyDescriptor(obj, name) {
  if (!obj) {
    return null;
  }

  let pd = Object.getOwnPropertyDescriptor(obj, name);
  return pd || _getPropertyDescriptor(Object.getPrototypeOf(obj), name);
}

function _copyprop(name, source, target) {
  let pd = _getPropertyDescriptor(source, name);
  Object.defineProperty(target, name, pd);
}

// ==========================
// exports
// ==========================

let utils = {};
module.exports = utils;

// ==========================
// exports (DOM)
// ==========================

/**
 * @method clear
 * @param {HTMLElement} element
 *
 * Remove all child element.
 */
utils.clear = function (element) {
  while ( element.firstChild ) {
    element.removeChild(element.firstChild);
  }
};

/**
 * @method indexOf
 * @param {HTMLElement} element
 *
 * Get the index of the `element`
 */
utils.indexOf = function ( element ) {
  let parentEL = element.parentNode;

  for ( let i = 0, len = parentEL.children.length; i < len; ++i ) {
    if ( parentEL.children[i] === element ) {
      return i;
    }
  }

  return -1;
};

/**
 * @method parentElement
 * @param {HTMLElement} element
 *
 * Get the parent element, it will go through the host if it is a shadow element
 */
utils.parentElement = function ( element ) {
  let parent = element.parentElement;
  if ( !parent ) {
    parent = element.parentNode;
    if ( parent && parent.host ) {
      return parent.host;
    }
  }
};

/**
 * @method offsetTo
 * @param {HTMLElement} el
 * @param {HTMLElement} parentEL
 *
 * Returns the offset `{x, y}` from `el` to `parentEL`
 */
utils.offsetTo = function ( el, parentEL ) {
  let xPosition = 0;
  let yPosition = 0;

  while ( el && el !== parentEL ) {
    xPosition += (el.offsetLeft - el.scrollLeft);
    yPosition += (el.offsetTop - el.scrollTop);
    el = el.offsetParent;
  }

  if ( parentEL && el !== parentEL ) {
    console.warn('The parentEL is not the element\'s offsetParent');
    return { x: 0, y: 0 };
  }

  return { x: xPosition, y: yPosition };
};

/**
 * @method walk
 * @param {HTMLElement} el
 * @param {object} opts
 * @param {boolean} opts.diveToShadow
 * @param {boolean} opts.excludeSelf
 * @param {function} cb
 *
 * Recursively search children use depth first algorithm.
 */
utils.walk = function ( el, optsOrFn, cb ) {
  let opts = optsOrFn;

  if ( typeof optsOrFn === 'function' ) {
    cb = optsOrFn;
    opts = {};
  }

  // execute self if not exclude
  if ( !opts.excludeSelf ) {
    let skipChildren = cb ( el );
    if ( skipChildren ) {
      return;
    }
  }

  // TODO opts.diveToShadow

  //
  if ( !el.children.length ) {
    return;
  }

  let parentEL = el;
  let curEL = el.children[0];

  while (1) {
    if ( !curEL ) {
      curEL = parentEL;
      if ( curEL === el ) {
        return;
      }

      parentEL = parentEL.parentElement;
      curEL = curEL.nextElementSibling;
    }

    if ( curEL ) {
      let skipChildren = cb ( curEL );
      if ( skipChildren ) {
        curEL = curEL.nextElementSibling;
        continue;
      }

      if ( curEL.children.length ) {
        parentEL = curEL;
        curEL = curEL.children[0];
      } else {
        curEL = curEL.nextElementSibling;
      }
    }
  }
};

/**
 * @method fire
 * @param {HTMLElement} element
 * @param {string} eventName
 * @param {object} opts
 *
 * Fires a CustomEvent to the specific element.
 * NOTE: fire means it can be propagate, emit don't have that meaning
 * NOTE: CustomEvent.bubbles default is false
 *
 * @example
 *
 * ```javascript
 * Editor.fire(el, 'foobar', {
 *   bubbles: false,
 *   detail: {
 *     value: 'Hello World!'
 *   }
 * });
 * ```
 */
utils.fire = function ( element, eventName, opts = {} ) {
  element.dispatchEvent(new window.CustomEvent(eventName,opts));
};

/**
 * @method acceptEvent
 * @param {Event} event
 *
 * Call preventDefault and stopImmediatePropagation for the event
 */
utils.acceptEvent = function (event) {
  event.preventDefault();
  event.stopImmediatePropagation();
};

/**
 * @method installDownUpEvent
 * @param {HTMLElement} element
 *
 * Handle mouse down and up event for button like element
 */
utils.installDownUpEvent = function (element) {
  function _trackDocument(movefn, upfn) {
    document.addEventListener('mousemove', movefn);
    document.addEventListener('mouseup', upfn);
  }

  function _untrackDocument(movefn, upfn) {
    document.removeEventListener('mousemove', movefn);
    document.removeEventListener('mouseup', upfn);
  }

  element.addEventListener('mousedown', function (event) {
    utils.acceptEvent(event);

    if ( !_hasLeftMouseButton(event) ) {
      return;
    }

    let movefn = function movefn(e) {
      if ( _hasLeftMouseButton(e) ) {
        return;
      }

      utils.fire(element, 'up', {
        sourceEvent: e,
        bubbles: true
      });
      _untrackDocument(movefn, upfn);
    };

    let upfn = function upfn(e) {
      if ( !_hasLeftMouseButton(e) ) {
        return;
      }

      utils.fire(element, 'up', {
        sourceEvent: e,
        bubbles: true
      });
      _untrackDocument(movefn, upfn);
    };

    _trackDocument(movefn, upfn);
    utils.fire(element, 'down', {
      sourceEvent: event,
      bubbles: true
    });
  });
};

/**
 * @method inDocument
 * @param {HTMLElement} el
 *
 * Check if the element is in document
 */
utils.inDocument = function ( el ) {
  while (1) {
    if (!el) {
      return false;
    }

    if (el === document) {
      return true;
    }

    // get parent or shadow host
    el = el.parentNode;
    if (el && el.host) {
      el = el.host;
    }
  }
};

/**
 * @method isVisible
 * @param {HTMLElement} el
 *
 * Check if the element is visible by itself
 */
utils.isVisible = function ( el ) {
  let computed = window.getComputedStyle(el);
  if (
    computed.display === 'none' ||
    computed.visibility === 'hidden' ||
    computed.opacity === 0
  ) {
    return false;
  }

  return true;
};

/**
 * @method isVisibleInHierarchy
 * @param {HTMLElement} el
 *
 * Check if the element is visible in hierarchy
 */
utils.isVisibleInHierarchy = function ( el ) {
  if ( utils.inDocument(el) === false ) {
    return false;
  }

  while (1) {
    if (el === document) {
      return true;
    }

    if ( utils.isVisible(el) === false ) {
      return false;
    }

    // get parent or shadow host
    el = el.parentNode;
    if (el && el.host) {
      el = el.host;
    }
  }
};

/**
 * @method startDrag
 * @param {string} cursor - CSS cursor
 * @param {MouseEvent} event
 * @param {function} onMove
 * @param {function} onEnd
 * @param {function} onWheel
 *
 * Start handling element dragging behavior
 */
utils.startDrag = function ( cursor, event, onMove, onEnd, onWheel ) {
  // TEMP DISABLE
  // if ( event instanceof window.MouseEvent ) {
  //   Editor.error('Failed to startDrag: only accept MouseEvent.');
  //   return;
  // }

  utils.addDragGhost(cursor);

  event.stopPropagation();

  let pressButton = event.button;
  let pressx = event.clientX, lastx = event.clientX;
  let pressy = event.clientY, lasty = event.clientY;
  let dx = 0, offsetx = 0;
  let dy = 0, offsety = 0;

  let mousemoveHandle = function (event) {
    event.stopPropagation();

    dx = event.clientX - lastx;
    dy = event.clientY - lasty;
    offsetx = event.clientX - pressx;
    offsety = event.clientY - pressy;

    lastx = event.clientX;
    lasty = event.clientY;

    if ( onMove ) {
      onMove( event, dx, dy, offsetx, offsety );
    }
  };

  let mouseupHandle = function (event) {
    event.stopPropagation();

    if ( event.button !== pressButton ) {
      return;
    }

    document.removeEventListener('mousemove', mousemoveHandle);
    document.removeEventListener('mouseup', mouseupHandle);
    document.removeEventListener('mousewheel', mousewheelHandle);

    utils.removeDragGhost();

    dx = event.clientX - lastx;
    dy = event.clientY - lasty;
    offsetx = event.clientX - pressx;
    offsety = event.clientY - pressy;

    _cancelDrag = null;
    if ( onEnd ) {
      onEnd( event, dx, dy, offsetx, offsety);
    }
  };

  let mousewheelHandle = function (event) {
    if ( onWheel ) {
      onWheel( event);
    }
  };

  _cancelDrag = function () {
    document.removeEventListener('mousemove', mousemoveHandle);
    document.removeEventListener('mouseup', mouseupHandle);
    document.removeEventListener('mousewheel', mousewheelHandle);

    utils.removeDragGhost();
  };

  document.addEventListener('mousemove', mousemoveHandle);
  document.addEventListener('mouseup', mouseupHandle);
  document.addEventListener('mousewheel', mousewheelHandle);
};

/**
 * @method cancelDrag
 *
 * Cancel dragging element
 */
utils.cancelDrag = function () {
  if ( _cancelDrag ) {
    _cancelDrag();
  }
};

/**
 * @method addDragGhost
 * @param {string} cursor - CSS cursor
 *
 * Add a dragging mask to keep the cursor not changed while dragging
 */
utils.addDragGhost = function ( cursor ) {
  // add drag-ghost
  if ( _dragGhost === null ) {
    _dragGhost = document.createElement('div');
    _dragGhost.classList.add('drag-ghost');
    _dragGhost.style.position = 'absolute';
    _dragGhost.style.zIndex = '999';
    _dragGhost.style.top = '0';
    _dragGhost.style.right = '0';
    _dragGhost.style.bottom = '0';
    _dragGhost.style.left = '0';
    _dragGhost.oncontextmenu = function () { return false; };
  }
  _dragGhost.style.cursor = cursor;
  document.body.appendChild(_dragGhost);

  return _dragGhost;
};

/**
 * @method removeDragGhost
 *
 * Remove the dragging mask
 */
utils.removeDragGhost = function () {
  if ( _dragGhost !== null ) {
    _dragGhost.style.cursor = 'auto';

    if ( _dragGhost.parentElement !== null ) {
      _dragGhost.parentElement.removeChild(_dragGhost);
    }
  }
};

/**
 * @method addHitGhost
 * @param {string} cursor - CSS cursor
 * @param {number} zindex
 * @param {function} onhit
 *
 * Add hit mask
 */
utils.addHitGhost = function ( cursor, zindex, onhit ) {
  // add drag-ghost
  if ( _hitGhost === null ) {
    _hitGhost = document.createElement('div');
    _hitGhost.classList.add('hit-ghost');
    _hitGhost.style.position = 'absolute';
    _hitGhost.style.zIndex = zindex;
    _hitGhost.style.top = '0';
    _hitGhost.style.right = '0';
    _hitGhost.style.bottom = '0';
    _hitGhost.style.left = '0';
    // _hitGhost.style.background = 'rgba(0,0,0,0.2)';
    _hitGhost.oncontextmenu = function () { return false; };
  }

  _hitGhost.style.cursor = cursor;
  _hitGhostMousedownHandle = function (event) {
    event.preventDefault();
    event.stopPropagation();

    if ( onhit ) {
      onhit();
    }
  };
  _hitGhost.addEventListener('mousedown', _hitGhostMousedownHandle);
  document.body.appendChild(_hitGhost);

  return _hitGhost;
};

/**
 * @method removeHitGhost
 *
 * Remove hit mask
 */
utils.removeHitGhost = function () {
  if ( _hitGhost !== null ) {
    _hitGhost.style.cursor = 'auto';

    if ( _hitGhost.parentElement !== null ) {
      _hitGhost.parentElement.removeChild(_hitGhost);
      _hitGhost.removeEventListener('mousedown', _hitGhostMousedownHandle);
      _hitGhostMousedownHandle = null;
    }
  }
};

/**
 * @method addLoadingMask
 * @param {object} options
 * @param {function} onclick
 *
 * Add loading mask
 */
utils.addLoadingMask = function ( options, onclick ) {
  // add drag-ghost
  if ( _loadingMask === null ) {
    _loadingMask = document.createElement('div');
    _loadingMask.classList.add('loading-mask');
    _loadingMask.style.position = 'absolute';
    _loadingMask.style.top = '0';
    _loadingMask.style.right = '0';
    _loadingMask.style.bottom = '0';
    _loadingMask.style.left = '0';
    _loadingMask.oncontextmenu = function () { return false; };
  }

  if ( options && typeof options.zindex === 'string' ) {
    _loadingMask.style.zIndex = options.zindex;
  } else {
    _loadingMask.style.zIndex = '1999';
  }

  if ( options && typeof options.background === 'string' ) {
    _loadingMask.style.backgroundColor = options.background;
  } else {
    _loadingMask.style.backgroundColor = 'rgba(0,0,0,0.2)';
  }

  if ( options && typeof options.cursor === 'string' ) {
    _loadingMask.style.cursor = options.cursor;
  } else {
    _loadingMask.style.cursor = 'default';
  }

  let _loadingMaskMousedownHandle = function (event) {
    event.preventDefault();
    event.stopPropagation();

    if ( onclick ) {
      onclick();
    }
  };
  _loadingMask.addEventListener('mousedown', _loadingMaskMousedownHandle);

  document.body.appendChild(_loadingMask);

  return _loadingMask;
};

/**
 * @method removeLoadingMask
 *
 * Remove loading mask
 */
utils.removeLoadingMask = function () {
  if ( _loadingMask !== null ) {
    _loadingMask.style.cursor = 'auto';

    if ( _loadingMask.parentElement !== null ) {
      _loadingMask.parentElement.removeChild(_loadingMask);
      _loadingMask.removeEventListener('mousedown', _loadingMaskMousedownHandle);
      _loadingMaskMousedownHandle = null;
    }
  }
};

/**
 * @method toHumanText
 * @param {string} text
 *
 * Convert a string to human friendly text. For example, `fooBar` will be `Foo bar`
 */
utils.toHumanText = function ( text ) {
  let result = text.replace(/[-_]([a-z])/g, function(m) {
    return m[1].toUpperCase();
  });

  result = result.replace(/([a-z][A-Z])/g, function (g) {
    return g[0] + ' ' + g[1];
  });

  // remove first white-space
  if ( result.charAt(0) === ' ' ) {
    result.slice(1);
  }

  // capitalize the first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
};

/**
 * @method camelCase
 * @param {string} text
 *
 * Convert a string to camel case text. For example, `foo-bar` will be `fooBar`
 */
utils.camelCase = function (text) {
  return _.camelCase(text);
};

/**
 * @method kebabCase
 * @param {string} text
 *
 * Convert a string to kebab case text. For example, `fooBar` will be `foo-bar`
 */
utils.kebabCase = function (text) {
  return _.kebabCase(text);
};

// TODO: do I need this?
// utils._focusParent = function ( element ) {
//   // NOTE: DO NOT use Polymer.dom(element).parentNode
//   let parent = element.parentElement;
//   while ( parent ) {
//     if (
//       parent.tabIndex !== null &&
//       parent.tabIndex !== undefined &&
//       parent.tabIndex !== -1
//     ) {
//       parent.focus();
//       return;
//     }

//     parent = parent.parentElement;
//   }
// };

// TODO: do I need this?
// utils._getFirstFocusableChild = function ( element ) {
//   if (
//     element.tabIndex !== null &&
//     element.tabIndex !== undefined &&
//     element.tabIndex !== -1
//   ) {
//     return element;
//   }

//   for ( let i = 0; i < element.children.length; ++i ) {
//     let childEL = utils._getFirstFocusableChild(element.children[i]);

//     if ( childEL !== null ) {
//       return childEL;
//     }
//   }

//   return null;
// };

// NOTE
/**
 * Two notes about the custom constructor:
 *   1. The factoryImpl method is only invoked when you create an element using the constructor.
 *      The factoryImpl method is not called if the element is created from markup by the HTML parser,
 *      or if the element is created using document.createElement.
 *
 *   2. The factoryImpl method is called after the element is initialized
 *      (ready function invoked, local DOM created, default values set, and so on).
 */

// ==========================
// exports (JS)
// ==========================

/**
 * @method addon
 */
utils.addon = function (obj, ...args) {
  obj = obj || {};
  for (let i = 0; i < args.length; ++i) {
    let source = args[i];

    for ( let name in source) {
      if ( !(name in obj) ) {
        _copyprop( name, source, obj);
      }
    }
  }
  return obj;
};

// ==========================
// exports (Custom Element)
// ==========================

/**
 * @method registerElement
 * @param {string} name
 * @param {object} def
 *
 * Register a custom element
 */
// DISABLE:
// utils.registerElement = function ( name, def ) {
//   let mode = def.mode; // can be 'light', 'shadow' and 'iframe', default is 'shadow'
//   if ( mode === undefined ) {
//     mode = 'shadow';
//   }

//   let behaviors = def.behaviors;
//   let listeners = def.listeners;
//   let selectors = def.$;
//   let style = def.style;
//   let template = def.template;


//   let module = function () {
//     let el = document.createElement(name);
//     return el;
//   };

//   module.prototype = Object.create(HTMLElement.prototype);

//   // TODO: dependencies

//   // NOTE: do not use delete to change def, we need to reuse def since it was cached
//   _.assignIn(this, _.omit(def, [
//     'mode',
//     '$',
//     'behaviors',
//     'listeners',
//     'style',
//     'template',
//   ]));

//   // addon behaviors
//   if ( behaviors ) {
//     behaviors.forEach(be => {
//       utils.addon(module.prototype, be);
//     });
//   }

//   // constructor
//   module.prototype.constructor = module.constructor;

//   // created callback
//   module.prototype.createdCallback = function () {
//     let root = this;

//     if ( mode === 'shadow' ) {
//       root = this.createShadowRoot();
//     }

//     // instantiate template
//     if ( template ) {
//       root.innerHTML = template;
//     }

//     // insert style
//     if ( style ) {
//       // NOTE: only shadow-dom can wrapping style sheets
//       if ( mode === 'shadow' ) {
//         let styleElement = document.createElement('style');
//         styleElement.type = 'text/css';
//         styleElement.textContent = style;

//         root.insertBefore( styleElement, root.firstChild );
//       } else {
//         console.warn('Can not use style in light DOM');
//       }
//     }

//     // update selector
//     if ( selectors ) {
//       for ( let name in selectors ) {
//         if ( this[`$${name}`] ) {
//           console.warn(`Failed to assign selector $${name}, already used`);
//           continue;
//         }

//         this[`$${name}`] = root.querySelector(selectors[name]);
//       }
//     }

//     // add event listeners
//     if ( listeners ) {
//       for ( let name in listeners ) {
//         this.addEventListener(name, listeners[name].bind(this));
//       }
//     }

//     // ready
//     if ( this.ready ) {
//       this.ready();
//     }
//   };

//   Object.defineProperty(module, 'tagName', {
//     get () { return name.toUpperCase(); },
//   });

//   // register element
//   // NOTE: registerElement will return a constructor
//   document.registerElement(name, module);

//   return module;
// };

/**
 * @method registerProperty
 * @param {string} type
 * @param {string|object} protoOrUrl
 *
 * Register a custom property.
 */
utils.registerProperty = function ( type, protoOrUrl ) {
  _type2proto[type] = protoOrUrl;
};

/**
 * @method unregisterProperty
 * @param {string} type
 *
 * Unregister a custom property.
 */
utils.unregisterProperty = function ( type ) {
  delete _type2proto[type];
};

/**
 * @method getProperty
 * @param {string} type
 *
 * Get registered property via `type`
 */
utils.getProperty = function ( type ) {
  return _type2proto[type];
};

/**
 * @method regenProperty
 * @param {HTMLElement} propEL
 * @param {function} cb
 *
 * Regenerate property at `propEL`.
 */
utils.regenProperty = function ( propEL, cb ) {
  let proto = _type2proto[propEL._type];
  if ( !proto ) {
    console.warn(`Failed to regen property ${propEL._type}: type not registered.`);
    return;
  }

  // if it is an url
  if ( typeof proto === 'string' ) {
    let path = protocols.path(proto);
    if ( fs.existsSync(path) ) {
      try {
        let propProto = require(path);
        _doRegen(propEL, propProto, cb);
      } catch (err) {
        // TODO: create error element
        console.error(err.stack);

        if ( cb ) {
          cb (err);
        }
      }
    } else {
      console.warn(`File not found or protocol not support for ${proto}`);
    }

    return;
  }

  // else expand proto
  try {
    _doRegen(propEL, proto, cb);
  } catch (err) {
    // TODO: create error element
    console.error(err.stack);

    if ( cb ) {
      cb (err);
    }
  }
};

// ==========================
// exports (parse)
// ==========================

/**
 * @method parseString
 * @param {string} txt
 *
 * Parse `txt` as a string.
 */
utils.parseString = function (txt) { return txt; };

/**
 * @method parseBoolean
 * @param {string} txt
 *
 * Parse `txt` as a boolean value.
 */
utils.parseBoolean = function (txt) {
  if ( txt === 'false' ) {
    return false;
  }
  return txt !== null;
};

/**
 * @method parseColor
 * @param {string} txt
 *
 * Parse `txt` as a color object.
 */
utils.parseColor = function (txt) {
  return chroma(txt).rgba();
};

/**
 * @method parseArray
 * @param {string} txt
 *
 * Parse `txt` as an array.
 */
utils.parseArray = function (txt) {
  return JSON.parse(txt);
};

/**
 * @method parseObject
 * @param {string} txt
 *
 * Parse `txt` as an object.
 */
utils.parseObject = function (txt) {
  return JSON.parse(txt);
};

// ==========================
// internal
// ==========================

function _doRegen ( propEL, proto, cb ) {
  let content;
  if ( proto.hasUserContent ) {
    let userContent = propEL.querySelector('.user-content');
    userContent = userContent || propEL;

    if ( userContent.children.length ) {
      content = [].slice.call( userContent.children, 0 );
    }
  }

  // clear propEL first
  utils.clear(propEL);
  let customStyle = propEL.shadowRoot.getElementById('custom-style');
  if ( customStyle ) {
    customStyle.remove();
  }

  // assign except
  _.assignIn(propEL, _.omit(proto, [
    'attrs',
    'hasUserContent',
    'style',
    'template',
    'value',
  ]));


  // parse attrs
  if ( propEL._attrs === undefined ) {
    if ( proto.attrs ) {
      let attrs = {};
      for ( let name in proto.attrs ) {
        let attr = propEL.getAttribute(name);
        if ( attr !== null ) {
          let fn = proto.attrs[name];
          attrs[name] = fn(attr);
        }
      }

      propEL._attrs = attrs;
    }
  }

  // parse value
  if ( propEL._value === undefined ) {
    let valueAttr = propEL.getAttribute('value');
    if ( valueAttr !== null ) {
      propEL._value = proto.value(valueAttr);
    }
  }

  // expand template
  if ( proto.template ) {
    let type = typeof proto.template;
    if ( type === 'string' ) {
      propEL.innerHTML = proto.template;
    } else if ( type === 'function' ) {
      propEL.innerHTML = proto.template(propEL._attrs);
    }
  }

  // stash user-content
  if ( proto.hasUserContent && content ) {
    let userEL = document.createElement('div');
    userEL.classList = ['user-content'];

    content.forEach(el => {
      userEL.appendChild(el.cloneNode(true));
    });

    propEL.insertBefore(userEL, propEL.firstChild);
  }

  // expand style
  if ( proto.style ) {
    let styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.textContent = proto.style;
    styleElement.id = 'custom-style';

    propEL.shadowRoot.insertBefore(styleElement, propEL.shadowRoot.firstChild);
  }

  //
  propEL._propgateDisable();
  propEL._propgateReadonly();

  // ready
  if ( propEL.ready ) {
    propEL.ready(content);
  }

  // callback
  if (cb) {
    cb();
  }
}

// DISABLE
// function ui_prop ( name, value, type, attrs, indent ) {
//   let el = document.createElement('ui-prop');
//   el.name = name || '';
//   el.indent = indent || 0;
//   el._value = value;
//   el._attrs = attrs || {};
//   el._type = type || typeof value;

//   el.regen();

//   return el;
// }

// TODO: a default way for dumping value, example:
// [
//   { name: 'rotated', type: 'boolean', },
//   { name: 'offsetX', type: 'number', },
//   { name: 'offsetY', type: 'number', },
//   { name: 'trimType', type: 'enum', options: [
//     { name: 'Auto', value: 0 },
//     { name: 'Custom', value: 1 },
//   ]},
//   { name: 'trimX', type: 'number', },
//   { name: 'trimY', type: 'number', },
//   { displayName: 'Trim Width', name: 'width', type: 'number', },
//   { displayName: 'Trim Height', name: 'height', type: 'number', },
//   { name: 'borderTop', type: 'number', },
//   { name: 'borderBottom', type: 'number', },
//   { name: 'borderLeft', type: 'number', },
//   { name: 'borderRight', type: 'number', },
// ].forEach(info => {
//   let el;
//   let displayName = Editor.UI.toHumanText(info.name);

//   if ( info.type === 'object' ) {
//     el = new Editor.UI.Prop(
//       displayName, null, info.type, info.attrs, indent
//     );

//     if ( path ) {
//       el._path = `${path}.${info.name}`;
//     } else {
//       el._path = info.name;
//     }

//     parent.appendChild(el);
//     this.evaluate( el._childWrapper, indent + 1, info.name, info.value );
//   } else if ( info.type === 'enum' ) {
//     el = new Editor.UI.Prop(
//       displayName, info.value, info.type, info.attrs, indent
//     );

//     if ( path ) {
//       el._path = `${path}.${info.name}`;
//     } else {
//       el._path = info.name;
//     }

//     info.options.forEach(opt => {
//       el.addItem( opt.value, opt.name );
//     });
//     el.$input.value = info.value;

//     parent.appendChild(el);
//   } else {
//     el = new Editor.UI.Prop(
//       displayName, info.value, info.type, info.attrs, indent
//     );

//     if ( path ) {
//       el._path = `${path}.${info.name}`;
//     } else {
//       el._path = info.name;
//     }

//     parent.appendChild(el);
//   }
//   this.appendChild(el);
// });
