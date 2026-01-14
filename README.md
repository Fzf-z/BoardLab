# BoardLab - Intelligent Electronics Diagnosis Platform

BoardLab is a desktop application designed for electronics repair technicians and engineers. It streamlines the process of reverse engineering and diagnosing circuit boards (PCBs) by combining high-resolution image mapping with real-time hardware measurements and AI assistance.

![BoardLab Screenshot](https://via.placeholder.com/800x450?text=BoardLab+Screenshot+Placeholder)

## 🚀 Key Features

### 🛠️ Interactive Board View
- **Dual-Side Support**: Upload and view both Side A and Side B of a PCB simultaneously side-by-side.
- **Smart Mapping**: Click anywhere on the board image to create measurement points.
- **Minimap & Zoom**: High-performance pan and zoom capabilities for high-resolution inspection.

### 🔌 Hardware Integration
- **Owon XDM Series Multimeters**: Read Voltage, Resistance, and Diode drop values directly into the software via TCP/IP.
- **Rigol DHO Series Oscilloscopes**: Capture live waveforms, Vpp, and Frequency directly attached to a specific test point.
- **Real-time Monitoring**: "Monitor Mode" continuously watches measurement values for hands-free triggering.

### 🧠 AI Assistant (Gemini)
- **Context-Aware Diagnosis**: Ask questions about specific components or measurements.
- **Board Analysis**: The AI analyzes your measurements against expected values to suggest potential faults.
- **Chat Interface**: Integrated chat panel to brainstorm repair strategies.

### 📊 Project & Data Management
- **Database Backend**: All projects, points, and measurement history are stored locally in a SQLite database.
- **Sequencer Mode**: Define a sequence of test points and rapidly measure them one by one.
- **Golden Board Comparison**: Compare measurements from a faulty board against a known-good "Golden Board" project.
- **Reports**: Generate detailed PDF reports with waveforms and measurement logs.

## 🛠️ Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) (Desktop Runtime)
- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (Running in a separate Worker thread for performance)
- **Hardware Comms**: Node.js `net` module (Raw TCP Sockets for SCPI commands)

## 📦 Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/boardlab.git
   cd boardlab
   ```

2. **Install dependencies**
   ```bash
   npm install
   # This will also compile native modules (better-sqlite3) automatically
   ```

3. **Run in Development Mode**
   ```bash
   npm start
   ```
   This launches the Vite dev server and the Electron app window.

### Build for Production

To create a distributable executable (exe/dmg/appImage):

```bash
npm run build
```
The output will be in the `dist` folder.

## 📖 Usage Guide

1.  **Create a Project**:
    *   Click "Open/Create Project" -> "New Project".
    *   Enter Board Model (e.g., "MacBook 820-00165").
    *   Upload images for **Side A** and optionally **Side B**.
    *   Click "Create".

2.  **Add Test Points**:
    *   **Click** anywhere on the board image to place a point.
    *   If you uploaded two sides, points clicked on the right image are automatically assigned to **Side B**.
    *   **Right-click + Drag** to pan around. **Scroll** to zoom.

3.  **Measure**:
    *   Select a point.
    *   Choose the measurement type (Voltage, Resistance, Diode, Oscilloscope) in the right panel.
    *   Ensure your instrument is connected (Settings -> Configure IP).
    *   Click **"CAPTURAR"** (Capture) or press **Enter**.

4.  **Compare**:
    *   Go to "Comparar con Golden Board".
    *   Select a reference project to overlay expected values or find matching points.

## ⚙️ Hardware Configuration

Go to **Settings** (Gear Icon) to configure your instruments:

*   **Multimeter (Owon)**: Set the IP address and Port (default 9876 via ESP32 Bridge).
*   **Oscilloscope (Rigol)**: Set the IP address and Port (default 5555).

*Note: The software uses SCPI commands over TCP. It may be compatible with other instruments that support the same command set with minor tweaks to `electron/drivers/`.*

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request for any bugs or feature requests.

## 📄 License

[MIT](LICENSE)
