'use strict';

const {app, BrowserWindow, Menu, MenuItem} = require('electron');
const windowPlus = require('electron-window-plus');
const profile = require('electron-profile');
const quickInspect = require('electron-quick-inspect');
const uikit = require('../index');

app.on('ready', function () {
  uikit.setTheme(`${__dirname}/../bin/themes/default`);
  profile.load('profile://local/settings.json');

  if (!windowPlus.restore()) {
    let win = new BrowserWindow({
      center: true,
      width: 400,
      height: 600,
    });

    windowPlus.manage(win);
    windowPlus.loadURL(win, `file://${__dirname}/index.html`);
  }

  let appMenu = Menu.getApplicationMenu();
  appMenu.append(new MenuItem({
    label: 'Develop',
    submenu: Menu.buildFromTemplate([
      {
        label: 'Inspect Element',
        accelerator: 'CmdOrCtrl+Shift+C',
        click() {
          let focusedWin = BrowserWindow.getFocusedWindow();
          quickInspect.inspect(focusedWin);
        }
      }
    ])
  }));
  Menu.setApplicationMenu(appMenu);
});