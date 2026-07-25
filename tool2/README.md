# 🎨 Design Studio: Fabric & Motif Repeater Tool (Tool 2)

Welcome to the **Fabric & Motif Repeater** tool built for the Design Studio workspace. This high-fidelity, interactive tool allows designers to upload any single motif or fabric sample, configure precise scaling, rotation, spacing offsets, and tiling layouts, and replicate it seamlessly onto a digital canvas for textile pattern visualization.

---

## ✨ Features

1. **Interactive Real-Time Preview**:
   - High-performance HTML5 Canvas rendering engine.
   - Updates instantly (60fps) as you adjust scale, rotation, spacing, or background color.

2. **Professional Repeat Layouts (Themed Matrix)**:
   - **Grid Repeat**: Standard rows and columns block-grid layout.
   - **Half-Drop Repeat**: Vertical columns offset by 50% for standard fluid fabric flows.
   - **Half-Brick Repeat**: Horizontal rows offset by 50% for standard masonry flows.
   - **Mirrored Repeat**: Dynamic four-way alternating flipping, allowing *any* motif with hard edges to tile seamlessly without borders.

3. **Advanced Motif Background Removal (Chroma Keying)**:
   - Isolate design motifs from solid backdrops (e.g. key out white or black backgrounds).
   - Adjustable threshold/tolerance.
   - **Dynamic Color Sampler**: Click anywhere directly on the input image to automatically sample and key out that background color!

4. **Premium Design Presets**:
   - Out-of-the-box support for three high-fidelity vector presets (Orange Hibiscus Blossom, Tropical Monstera Leaf, Golden Deco Diamond) to try features instantly.

5. **Advanced Controls & High-Res Export**:
   - Adjust individual motif rotation (0–360°).
   - Add custom horizontal/vertical spacing gaps (0–100px) between repeat units.
   - Select custom hex background fill tones or transparent backdrops.
   - Generate and download pixel-perfect high-resolution output layouts (1K / 2K resolutions) utilizing Python's Pillow backend.

---

## 🛠️ Project Architecture

```
tool2/
├── README.md                # Tool Documentation
├── run-app.sh               # Single command launch script
├── backend/
│   ├── main.py              # FastAPI Web Server & Pillow image replication engine
│   ├── requirements.txt     # Python Dependencies
│   └── .env                 # Environment config
└── frontend/
    ├── src/
    │   ├── App.tsx          # React Canvas Pattern Workspace
    │   ├── App.css          # App stylesheet overrides
    │   ├── index.css        # Custom Tailwind animations & chessboard backdrops
    │   └── main.tsx
    ├── package.json
    ├── index.html
    └── vite.config.ts
```

---

## 🚀 How to Run the App

We have provided a unified startup script that sets up Python virtual environments, installs requirements for both frontend and backend, and runs them concurrently.

### 1. Launch with the Startup Script
In your terminal, navigate to the project directory and run:
```bash
cd tool2
./run-app.sh
```

This single command will:
* Set up a Python virtual environment and install backend requirements (`FastAPI`, `uvicorn`, `Pillow`, etc.).
* Launch the backend on `http://localhost:8001`.
* Install node modules and spin up the frontend Vite development server.
* Open your browser to the local application page on `http://localhost:5174` (configured to run on port 5174 so it does not conflict with Tool 1!).

---

## 🏗️ Technical Details

* **Realtime Frontend Tiler**: The application uses an offscreen HTML5 canvas buffer to perform pixel-level chroma keying and rotation operations, which are then pattern-tiled on the main canvas with 60 FPS performance.
* **Pillow Tiling Engine**: When generating high-res prints, the backend processes raw image binaries, applies sub-pixel lanczos sampling, handles edge bleeding for offset patterns, and exports high-fidelity uncompressed PNG textures.
