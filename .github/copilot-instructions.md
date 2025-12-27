# BoardLab Copilot Instructions

This document provides guidance for AI coding agents to effectively contribute to the BoardLab desktop application.

## Architecture Overview

The application is built with Electron, React, and Vite. It is a desktop tool for electronic diagnosis that communicates with hardware devices over TCP.

-   **Electron Main Process (`main.js`):** This is the entry point of the application. It handles window creation, hardware communication, and other backend tasks.
-   **React Frontend (`boardlab-desktop/`):** This is the user interface of the application. It is a standard Vite project with React.
-   **Hardware Drivers:** The hardware drivers are located in `main.js`. They are responsible for communicating with the hardware devices over TCP.
-   **Communication:** The main process and the renderer process (React frontend) communicate using Electron's `ipcMain` and `ipcRenderer` modules.

## Key Files

-   `main.js`: The Electron main process file.
-   `preload.js`: The script that runs before the web page is loaded in the browser window.
-   `boardlab-desktop/package.json`: The frontend's dependencies and scripts.
-   `boardlab-desktop/src/App.jsx`: The main React component.

## Development Workflow

1.  **Install dependencies:** Run `npm install` in the root folder and in `boardlab-desktop/`.
2.  **Start the application:** Run `npm start` in the root folder.
3.  **Start the frontend:** Run `npm run dev` in `boardlab-desktop/`.

## Important Considerations

-   **Hardware Communication:** The hardware communication is done using the `net` module in Node.js. The drivers are located in `main.js`.
-   **Error Handling:** The hardware drivers should handle errors gracefully and not crash the application.
-   **Asynchronous Operations:** The hardware communication is asynchronous. Use Promises to handle asynchronous operations.
-   **Security:** Be mindful of security when working with Electron. Do not expose Node.js modules to the renderer process.
