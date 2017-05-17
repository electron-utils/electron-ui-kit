module.exports = function (viewEL) {
  let eventEL = viewEL.querySelector('#event');

  // g-01
  ['.g-01', '.g-02'].forEach(g => {
    let target = viewEL.querySelector(`${g} ui-button`);

    target.addEventListener('click', () => {
      viewEL.updateEventText(eventEL, 'click');
    });

    target.addEventListener('confirm', () => {
      viewEL.updateEventText(eventEL, 'confirm');
    });

    target.addEventListener('cancel', () => {
      viewEL.updateEventText(eventEL, 'cancel');
    });
  });

  let target = viewEL.querySelector(`.g-02 [disabled]`);
  let btn = viewEL.querySelector(`#focus`);
  btn.addEventListener('click', () => {
    target.focus();
  });
};