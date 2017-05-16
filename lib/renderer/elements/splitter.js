'use strict';

const CleanCSS = require('clean-css');
const utils = require('../utils');
const resizable = require('../behaviors/resizable');

// ==========================
// internals
// ==========================

let _css = `
  :host {
    display: block;
    position: relative;
    box-sizing: border-box;
    contain: content;

    overflow: hidden;
  }

  .content {
    /* layout-vertical */
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;

    /* DISABLE: fit (take into account with margin & padding) */
    /* position: relative; */
    /* height: 100%; */
    position: absolute;
    top: 0; bottom: 0; left: 0; right: 0;
  }

  .content:focus {
    outline: none;
  }

  :host([row]) > .content {
    flex-direction: row;
  }
`;

let _cleanCSS = new CleanCSS();
let _minified = _cleanCSS.minify(_css).styles;

// ==========================
// exports
// ==========================

class Splitter extends window.HTMLElement {
  constructor () {
    super();

    this.attachShadow({
      mode: 'open'
    });
    this.shadowRoot.innerHTML = `
      <div class="content">
        <slot></slot>
      </div>
    `;

    // init style
    let styleElement = document.createElement('style');
    styleElement.type = 'text/css';
    styleElement.textContent = _minified;
    this.shadowRoot.insertBefore( styleElement, this.shadowRoot.firstChild );

    // init behaviors
    this._initResizable();

    //
    this._needEvaluateSize = this.children.length === 0 ? false : true;

    for ( let i = 0; i < this.children.length; ++i ) {
      let el = this.children[i];
      if ( el.tagName !== 'UI-SPLITTER' ) {
        this._needEvaluateSize = false;
        break;
      }
    }

    // init resizer
    this._initResizers();

    // finalize if we are root splitter
    window.requestAnimationFrame(() => {
      if ( this.parentElement.tagName !== 'UI-SPLITTER' ) {
        this._finalizeMinMaxRecursively();
        this._finalizePreferredSizeRecursively();
        this._finalizeStyleRecursively();
        this._reflowRecursively();
      }
    });
  }

  /**
   * @property row
   * If true, layout panels horizontally
   */
  get row () {
    return this.hasAttribute('row');
  }
  set row (val) {
    if (val) {
      this.setAttribute('row', '');
    } else {
      this.removeAttribute('row');
    }
  }

  _initResizers () {
    // NOTE: if _needEvaluateSize is false,
    // it means the this splitter doesn't contain resizable children so we don't need resizer
    if ( !this._needEvaluateSize ) {
      return;
    }

    if ( this.children.length > 1 ) {
      for ( let i = 0; i < this.children.length; ++i ) {
        if ( i !== this.children.length-1 ) {
          let nextEL = this.children[i+1];

          let resizer = document.createElement('ui-dock-resizer');
          resizer.vertical = this.row;

          this.insertBefore( resizer, nextEL );
          i += 1;
        }
      }
    }
  }
}

// addon behaviors
utils.addon(Splitter.prototype, resizable);

module.exports = Splitter;
