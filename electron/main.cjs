const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Imprimir Partitura',
          accelerator: 'CmdOrCtrl+P',
          click: (menuItem, browserWindow) => {
            if (browserWindow) browserWindow.webContents.print();
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar lienzo' },
        { role: 'forceReload', label: 'Forzar recarga' },
        { role: 'toggleDevTools', label: 'Herramientas de Desarrollador' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño original' },
        { role: 'zoomIn', label: 'Aumentar zoom' },
        { role: 'zoomOut', label: 'Reducir zoom' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Repositorio en GitHub',
          click: () => {
            shell.openExternal('https://github.com/JasonS-V/Pautello');
          },
        },
        { type: 'separator' },
        {
          label: 'Acerca de Pautello',
          click: (menuItem, browserWindow) => {
            dialog.showMessageBox(browserWindow, {
              type: 'info',
              title: 'Pautello Music Editor',
              message: 'Pautello - Editor Profesional de Partituras',
              detail:
                'Versión 1.0.0\nGrabado musical profesional, audio multitrack y composición universal.\n\nCódigo y soporte: https://github.com/JasonS-V/Pautello',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setupIpcHandlers() {
  const handleSaveFile = async (event, { defaultFileName, data }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const ext = path.extname(defaultFileName).replace('.', '') || 'bin';

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Guardar Archivo - Pautello',
      defaultPath: defaultFileName,
      filters: [
        { name: `${ext.toUpperCase()} File`, extensions: [ext] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) {
      return { ok: false, cancelled: true };
    }

    try {
      const buffer = Buffer.from(data);
      await fs.promises.writeFile(filePath, buffer);
      return { ok: true, path: filePath };
    } catch (error) {
      console.error('Error al guardar archivo en disco:', error);
      return { ok: false, error: String(error) };
    }
  };

  const handlePrintToPdf = async (event, { defaultFileName }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Exportar Partitura a PDF - Pautello',
      defaultPath: defaultFileName || 'partitura.pdf',
      filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { ok: false, cancelled: true };
    }

    try {
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      await fs.promises.writeFile(filePath, pdfBuffer);
      return { ok: true, path: filePath };
    } catch (error) {
      console.error('Error al generar PDF en Electron:', error);
      return { ok: false, error: String(error) };
    }
  };

  ipcMain.handle('pautello:save-file', handleSaveFile);
  ipcMain.handle('stavio:save-file', handleSaveFile);
  ipcMain.handle('sonata:save-file', handleSaveFile);
  ipcMain.handle('pautello:print-to-pdf', handlePrintToPdf);
  ipcMain.handle('stavio:print-to-pdf', handlePrintToPdf);
  ipcMain.handle('sonata:print-to-pdf', handlePrintToPdf);
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1660,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Pautello - Editor Profesional de Partituras',
    icon: path.join(__dirname, app.isPackaged ? '../dist/icon.svg' : '../public/icon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: false,
    backgroundColor: '#0f1117',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
