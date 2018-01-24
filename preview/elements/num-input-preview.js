'use strict';

module.exports = function (viewEL) {
    let eventEL = viewEL.querySelector('#event');

    // g-01
    ['.g-01', '.g-02'].forEach(g => {
        let target = viewEL.querySelector(`${g} ui-num-input`);

        let text = viewEL.querySelector(`${g} span.text`);
        text.innerHTML = target.value;

        target.addEventListener('change', event => {
            let text = viewEL.querySelector(`${g} span.text`);
            text.innerHTML = event.detail.value;

            viewEL.updateEventText(eventEL, 'change');
        });

        target.addEventListener('confirm', () => {
            viewEL.updateEventText(eventEL, 'confirm');
        });

        target.addEventListener('cancel', () => {
            viewEL.updateEventText(eventEL, 'cancel');
        });
    });

    let target = viewEL.querySelector(`.g-03 [disabled]`);
    let btn = viewEL.querySelector(`#focus`);
    btn.addEventListener('click', () => {
        target.focus();
    });
};