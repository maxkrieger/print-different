const path = require("path");
const fs = require("fs/promises");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const isDev = require("electron-is-dev");
const url = require("url");

ipcMain.handle("pick-file", async (event, arg) => {
  const fileResponse = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "PDFs", extensions: ["pdf"] }],
  });
  if (fileResponse.canceled || fileResponse.filePaths.length === 0) {
    return;
  }
  const fileBytes = await fs.readFile(fileResponse.filePaths[0]);
  return fileBytes;
});

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  // and load the index.html of the app.
  win.loadURL(
    isDev
      ? "http://localhost:3000"
      : url.format({
          protocol: "file:",
          slashes: true,
          pathname: path.join(__dirname, "index.html"),
        })
  );
  // Open the DevTools.
  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

// TODO: not working
app.on("open-file", async (e, path) => {
  e.preventDefault();
  const fileBytes = await fs.readFile(path);
  ipcMain.emit("file-opened", fileBytes);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
