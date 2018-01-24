'use strict';

// requires
const utils = require('../utils');
const themeMgr = require('../theme-mgr');

class NumInput extends window.HTMLElement {
    static get css () { return 'theme://num-input.css'; }
    static get html () { return 'theme://num-input.html'; }

    constructor (text) {
        super();
        this._inited = false;

        if (text) {
            this.value = text;
        }

        this.attachShadow({
            mode: 'open',
            // delegatesFocus: true
        });
        this.shadowRoot.innerHTML = themeMgr.load(NumInput.html);

        // init style
        let styleElement = document.createElement('style');
        styleElement.type = 'text/css';
        styleElement.textContent = themeMgr.load(NumInput.css);

        this.shadowRoot.insertBefore(styleElement, this.shadowRoot.firstChild);

        // query selector
        this.$input = this.shadowRoot.querySelector('input');
        if (!this.$input) {
            console.error('You must have <input> in your template');
            return;
        }

        // init $input
        let _value = parseFloat(this.getAttribute('value'));
        this.$input.value = isNaN(_value) ? 0 : _value;

        // init event
        this.$up = this.shadowRoot.querySelector('.up');
        this.$up.addEventListener('click', () => {
            if (this.readonly) return;
            this.value += this.step;
            utils.fire(this, 'change', {
                bubbles: false,
                detail: {
                    value: this.value,
                },
            });
        });
        this.$down = this.shadowRoot.querySelector('.down');
        this.$down.addEventListener('click', () => {
            if (this.readonly) return;
            this.value -= this.step;
            utils.fire(this, 'change', {
                bubbles: false,
                detail: {
                    value: this.value,
                },
            });
        });
        this.$input.addEventListener('mousewheel', (event) => {
            event.preventDefault();
            if (!this.focused) return;
            if (!this._wheelLocked) {
                this.focus();
                this._wheelDeltaY = 0;
                this._wheelLocked = true;
                requestAnimationFrame(() => {
                    let step = this.$input.step || 1;
                    this.$input.value = parseFloat(this.$input.value) + this._wheelDeltaY * step;
                    utils.fire(this, 'change', {
                        bubbles: false,
                        detail: {
                            value: this.value,
                        },
                    });
                    this._wheelDeltaY = 0;
                    this._wheelLocked = false;
                });
            }
            if (event.deltaY > 0) {
                this._wheelDeltaY += 1;
            } else if (event.deltaY < 0) {
                this._wheelDeltaY -= 1;
            }
        });
    }

    get step () {
        return this.$input.step || 1;
    }
    set step (val) {
        this.$input.step = val;
    }

    get value () {
        return parseFloat(this.$input.value);
    }
    set value (val) {
        this.$input.value = val;
    }

    connectedCallback () {
        if (this._inited) {
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
    }

    // NOTE: override Readonly behavior
    _setIsReadonlyAttribute (readonly) {
        if (readonly) {
            this.setAttribute('is-readonly', '');
        } else {
            this.removeAttribute('is-readonly');
        }
        this.$input.readOnly = readonly;
    }

    _onInputConfirm (inputEL, pressEnter) {
        if (!this.readonly) {
            if (this._changed) {
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

        if (pressEnter) {
            // blur inputEL, focus to :host
            this.focus();
        }
    }

    _onInputCancel (inputEL, pressEsc) {
        if (!this.readonly) {
            if (this._changed) {
                this._changed = false;

                // reset to init value and emit change event
                if (inputEL._initValue !== inputEL.value) {
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

        if (pressEsc) {
            // blur inputEL, focus to :host
            this.focus();
        }
    }

    _onInputChange (inputEL) {
        this._changed = true;

        utils.fire(this, 'change', {
            bubbles: false,
            detail: {
                value: inputEL.value,
            },
        });
    }

}

utils.addon(NumInput.prototype, require('../behaviors/focusable'));
utils.addon(NumInput.prototype, require('../behaviors/disable'));
utils.addon(NumInput.prototype, require('../behaviors/readonly'));
utils.addon(NumInput.prototype, require('../behaviors/input-state'));

module.exports = NumInput;