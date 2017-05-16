'use strict';

// ==========================
// exports
// ==========================

let _resizerSpace = 3; // TODO: HACK

module.exports = {
  _resizable: true,

  /**
   * @property row
   * If true, layout panels horizontally
   */
  get row() {
    return this.getAttribute('row') !== null;
  },
  set row(val) {
    if (val) {
      this.setAttribute('row', '');
    } else {
      this.removeAttribute('row');
    }
  },

  _initResizable() {
    [
      { name: 'width', prop: '_initWidth', defaultValue: 'auto' },
      { name: 'height', prop: '_initHeight', defaultValue: 'auto' },
      { name: 'min-width', prop: '_initMinWidth', defaultValue: 0 },
      { name: 'min-height', prop: '_initMinHeight', defaultValue: 0 },
      { name: 'max-width', prop: '_initMaxWidth', defaultValue: 'auto' },
      { name: 'max-height', prop: '_initMaxHeight', defaultValue: 'auto' },
    ].forEach(info => {
      let attr = this.getAttribute(info.name);

      // NOTE: min-width, min-height can not be auto, so use defaultValue here
      if (attr === 'auto') {
        this[info.prop] = info.defaultValue;
        return;
      }

      attr = parseInt(attr);
      if (isNaN(attr)) {
        this[info.prop] = info.defaultValue;
        return;
      }

      this[info.prop] = attr;
    });

    // check if initMaxWidth >= initMinWidth
    if (
      this._initMaxWidth !== 'auto' &&
      this._initMaxWidth < this._initMinWidth
    ) {
      console.warn(`"max-width" is less than "min-width". "max-width"=${this._initMaxWidth}, "min-width"=${this._initMinWidth}`);
      this._initMaxWidth = this._initMinWidth;
    }

    // check if initMaxHeight >= initMinHeight
    if (
      this._initMaxHeight !== 'auto' &&
      this._initMaxHeight < this._initMinHeight
    ) {
      console.warn(`"max-height" is less than "min-height". "max-height"=${this._initMaxHeight}, "min-height"=${this._initMinHeight}`);
      this._initMaxHeight = this._initMinHeight;
    }

    this._needEvaluateSize = false;

    // init computed properties
    this._preferredWidth = this._initWidth;
    this._preferredHeight = this._initHeight;
    this._computedMinWidth = this._initMinWidth;
    this._computedMaxWidth = this._initMaxWidth;
    this._computedMinHeight = this._initMinHeight;
    this._computedMaxHeight = this._initMaxHeight;

    // init styles
    this.style.minWidth = `${this._initMinWidth}px`;
    this.style.minHeight = `${this._initMinHeight}px`;
    this.style.maxWidth = this._initMaxWidth !== 'auto' ? `${this._initMaxWidth}px` : 'auto';
    this.style.maxHeight = this._initMaxHeight !== 'auto' ? `${this._initMaxHeight}px` : 'auto';
  },

  // dispatch 'resize' event recursively
  _notifyResize() {
    this.dispatchEvent(new window.CustomEvent('resize'));

    for (let i = 0; i < this.children.length; ++i) {
      let childEL = this.children[i];
      if (childEL._resizable) {
        childEL._notifyResize();
      }
    }
  },

  //
  calcWidth(width) {
    if (width < this._computedMinWidth) {
      return this._computedMinWidth;
    }

    if (this._computedMaxWidth !== 'auto' && width > this._computedMaxWidth) {
      return this._computedMaxWidth;
    }

    return width;
  },

  //
  calcHeight(height) {
    if (height < this._computedMinHeight) {
      return this._computedMinHeight;
    }

    if (this._computedMaxHeight !== 'auto' && height > this._computedMaxHeight) {
      return this._computedMaxHeight;
    }

    return height;
  },

  // depth first calculate the width and height
  // finalize size will eventually calculate the size depends on the panel-frame
  _finalizePreferredSizeRecursively() {
    for (let i = 0; i < this.children.length; ++i) {
      let el = this.children[i];

      if (el._resizable) {
        el._finalizePreferredSizeRecursively();
      }
    }

    //
    this._finalizePreferredSize();
  },

  // depth first calculate the min max width and height
  // finalize size will eventually calculate the min-max size depends on the panel-frame
  _finalizeMinMaxRecursively() {
    for (let i = 0; i < this.children.length; ++i) {
      let el = this.children[i];

      if (el._resizable) {
        el._finalizeMinMaxRecursively();
      }
    }

    //
    this._finalizeMinMax();
  },

  // apply `style.flex` based on computedWidth or computedHeight
  _finalizeStyleRecursively() {
    // NOTE: finalizeStyle is breadth first calculation, because we need to make sure
    //       parent style applied so that the children would not calculate wrong.
    this._finalizeStyle();

    //
    for (let i = 0; i < this.children.length; ++i) {
      let el = this.children[i];

      if (el._resizable) {
        el._finalizeStyleRecursively();
      }
    }
  },

  _reflowRecursively() {
    this._reflow();

    for (let i = 0; i < this.children.length; ++i) {
      let el = this.children[i];

      if (el._resizable) {
        el._reflowRecursively();
      }
    }
  },

  // init and finalize min,max depends on children
  _finalizeMinMax() {
    if (!this._needEvaluateSize) {
      return;
    }

    let elements = [];

    // collect resizable elements
    for (let i = 0; i < this.children.length; ++i) {
      let el = this.children[i];

      if (el._resizable) {
        elements.push(el);
      }
    }

    // collect child elements' size

    if (this.row) {
      // preserve resizers' width
      this._computedMinWidth = elements.length > 0 ? _resizerSpace * (elements.length - 1) : 0; // preserve resizers' width
      this._computedMinHeight = 0;

      this._computedMaxWidth = 'auto';
      this._computedMaxHeight = 'auto';

      let autoWidth = false;
      let autoHeight = false;

      for (let i = 0; i < elements.length; ++i) {
        let el = elements[i];

        // min-width
        this._computedMinWidth += el._computedMinWidth;

        // min-height
        if (this._computedMinHeight < el._computedMinHeight) {
          this._computedMinHeight = el._computedMinHeight;
        }

        // max-width
        if (autoWidth || el._computedMaxWidth === 'auto') {
          autoWidth = true;
          this._computedMaxWidth = 'auto';
        } else {
          this._computedMaxWidth += el._computedMaxWidth;
        }

        // max-height
        if (autoHeight || el._computedMaxHeight === 'auto') {
          autoHeight = true;
          this._computedMaxHeight = 'auto';
        } else {
          if (this._computedMaxHeight < el._computedMaxHeight) {
            this._computedMaxHeight = el._computedMaxHeight;
          }
        }
      }
    } else {
      // preserve resizers' height
      this._computedMinWidth = 0;
      this._computedMinHeight = elements.length > 0 ? _resizerSpace * (elements.length - 1) : 0;

      this._computedMaxWidth = 'auto';
      this._computedMaxHeight = 'auto';

      let autoWidth = false;
      let autoHeight = false;

      for (let i = 0; i < elements.length; ++i) {
        let el = elements[i];

        // min-width
        if (this._computedMinWidth < el._computedMinWidth) {
          this._computedMinWidth = el._computedMinWidth;
        }

        // min-height
        this._computedMinHeight += el._computedMinHeight;

        // max-width
        if (autoWidth || el._computedMaxWidth === 'auto') {
          autoWidth = true;
          this._computedMaxWidth = 'auto';
        } else {
          if (this._computedMaxWidth < el._computedMaxWidth) {
            this._computedMaxWidth = el._computedMaxWidth;
          }
        }

        // max-height
        if (autoHeight || el._computedMaxHeight === 'auto') {
          autoHeight = true;
          this._computedMaxHeight = 'auto';
        } else {
          this._computedMaxHeight += el._computedMaxHeight;
        }
      }
    }

    if (this._initMinWidth > this._computedMinWidth) {
      this._computedMinWidth = this._initMinWidth;
    }

    if (this._initMinHeight > this._computedMinHeight) {
      this._computedMinHeight = this._initMinHeight;
    }
  },

  _finalizePreferredSize() {
    if (!this._needEvaluateSize) {
      return;
    }

    let elements = [];

    // collect dockable elements
    for (let i = 0; i < this.children.length; ++i) {
      let el = this.children[i];

      if (el._resizable) {
        elements.push(el);
      }
    }

    // compute width when it is auto
    if (this._preferredWidth === 'auto') {
      let auto = false;

      if (this.row) {
        // preserve resizers' width
        this._preferredWidth = elements.length > 0 ? _resizerSpace * (elements.length - 1) : 0;

        for (let i = 0; i < elements.length; ++i) {
          let el = elements[i];

          if (auto || el._preferredWidth === 'auto') {
            auto = true;
            this._preferredWidth = 'auto';
          } else {
            this._preferredWidth += el._preferredWidth;
          }
        }
      } else {
        this._preferredWidth = 0;

        for (let i = 0; i < elements.length; ++i) {
          let el = elements[i];

          if (auto || el._preferredWidth === 'auto') {
            auto = true;
            this._preferredWidth = 'auto';
          } else {
            if (el._preferredWidth > this._preferredWidth) {
              this._preferredWidth = el._preferredWidth;
            }
          }
        }
      }
    }

    // compute height when it is auto
    if (this._preferredHeight === 'auto') {
      let auto = false;

      if (this.row) {
        this._preferredHeight = 0;

        for (let i = 0; i < elements.length; ++i) {
          let el = elements[i];

          if (auto || el._preferredHeight === 'auto') {
            auto = true;
            this._preferredHeight = 'auto';
          } else {
            if (el._preferredHeight > this._preferredHeight) {
              this._preferredHeight = el._preferredHeight;
            }
          }
        }
      } else {
        // preserve resizers' height
        this._preferredHeight = elements.length > 0 ? _resizerSpace * (elements.length - 1) : 0;

        for (let i = 0; i < elements.length; ++i) {
          let el = elements[i];

          if (auto || el._preferredHeight === 'auto') {
            auto = true;
            this._preferredHeight = 'auto';
          } else {
            this._preferredHeight += el._preferredHeight;
          }
        }
      }
    }
  },

  _finalizeStyle() {
    // min-width
    this.style.minWidth = `${this._computedMinWidth}px`;

    // min-height
    this.style.minHeight = `${this._computedMinHeight}px`;

    // max-width
    if (this._computedMaxWidth !== 'auto') {
      this.style.maxWidth = `${this._computedMaxWidth}px`;
    } else {
      this.style.maxWidth = 'auto';
    }

    // max-height
    if (this._computedMaxHeight !== 'auto') {
      this.style.maxHeight = `${this._computedMaxHeight}px`;
    } else {
      this.style.maxHeight = 'auto';
    }

    if (!this._needEvaluateSize) {
      return;
    }

    // let resizerCnt = (this.children.length - 1)/2;
    // let resizerSize = resizerCnt * resizerSpace;
    // let hasAutoLayout = false;

    if (this.children.length === 1) {
      let el = this.children[0];

      // hasAutoLayout = true;
      el.style.flex = '1 1 auto';
    } else {
      for (let i = 0; i < this.children.length; ++i) {
        let el = this.children[i];

        if (el._resizable) {
          let size = this.row ? el._preferredWidth : el._preferredHeight;

          if (size === 'auto') {
            // hasAutoLayout = true;
            el.style.flex = '1 1 auto';
          } else {
            // // if this is last el and we don't have auto-layout elements, give rest size to last el
            // if ( i === (this.children.length-1) && !hasAutoLayout ) {
            //   el.style.flex = '1 1 auto';
            // }
            // else {
            //   el.style.flex = `0 0 ${size}px`;
            // }
            el.style.flex = `0 0 ${size}px`;
          }
        }
      }
    }
  },

  _reflow() {
    let len = this.children.length;
    let sizeList = new Array(len);
    let totalSize = 0;

    //
    for (let i = 0; i < len; ++i) {
      let el = this.children[i];
      let size = this.row ? el.offsetWidth : el.offsetHeight;

      sizeList[i] = size;

      // NOTE: we only need totalSize for dockable element,
      // this will make sure the ratio will be calculated correctly.
      if (el._resizable) {
        totalSize += size;
      }
    }

    for (let i = 0; i < this.children.length; ++i) {
      let el = this.children[i];
      if (el._resizable) {
        let ratio = sizeList[i] / totalSize;
        el.style.flex = `${ratio} ${ratio} 0px`;

        // DISABLE: we use 0px instead.
        // The `${sizeList[i]}px` will force the dockable element use the given size,
        // when the parent size is less than the preferred size, the panel will exceed.
        // el.style.flex = `${ratio} ${ratio} ${sizeList[i]}px`;
      }
    }
  },
};