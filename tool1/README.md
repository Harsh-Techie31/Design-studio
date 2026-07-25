"# 🎨 Design Studio: First Render Tool

Welcome to the **First Render** tool built for the Design Studio workspace. This high-fidelity tool integrates multimodal reasoning via Google Gemini and premium image generation using Imagen 3 to dynamically map texture fabrics and design prompt overrides onto garment sketch silhouettes.

---

## ✨ Features

1. **Garment Silhouette Sketch Upload**:
   - Drag and drop or upload base CAD sketches, mockups, or line drawings.
   - Set an additional design prompt override to customize styling details.

2. **Fabric Texture Fusing Section**:
   - Add/remove fabric items dynamically.
   - Upload high-quality swatches/textures for each fabric card.
   - Describe where and how to integrate each texture in real-time (e.g., *"Apply fabric 1 to the pockets and lapels"*).

3. **Advanced Controls**:
   - **Select Model Style (Working Feature)**: Select between styles: `nano banana`, `nana banana bro`, and `nano banana 2` to configure the avatar structure.
   - **Aspect Ratio & Image Quality (Layout Selectors)**: Non-operational styling fields for canvas configuration.

4. **Stitching & Fusing Animation Phase**:
   - Shimmering grids, spinning spools of thread, pulsing magical spark transitions, and a multi-step real-time progress meter tracking active stitching operations.

5. **Result Canvas**:
   - High-fidelity zoomable rendering.
   - Shows the synthesized Gemini prompt formulation detailing how your fabrics and silhouettes were merged.
   - Direct download and canvas clearing options.

---

## 🛠️ Project Architecture

```
Design-studio/
├── run-app.sh               # Single command start script (Recommended)
├── backend/
│   ├── main.py              # FastAPI Web Server & Gemini REST client
│   ├── requirements.txt     # Python Dependencies
│   └── .env                 # API Key environment file
└── frontend/
    ├── src/
    │   ├── App.tsx          # React First Render Workspace Canvas
    │   ├── index.css        # Custom Tailwind animations & theme styles
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 How to Run the App

We have provided a unified starter script that handles virtual environments, dependencies, the FastAPI backend server, and the Vite frontend dev server simultaneously.

### 1. Set Your Gemini API Key
Open `backend/.env` and paste your Google AI Studio / Gemini API Key:
```env
GEMINI_API_KEY=AIzaSyYourKeyHere...
```
*(Alternatively, you can securely paste your Gemini key directly in the web UI header override once the app starts!)*

### 2. Launch with the Startup Script
In your terminal, navigate to the project directory and run:
```bash
./run-app.sh
```

This single command will:
* Set up a Python virtual environment and install backend requirements (`FastAPI`, `uvicorn`, `requests`, etc.).
* Run the backend on `http://localhost:8000`.
* Install node modules and spin up the frontend Vite development server.
* Open your browser to the local application page (usually `http://localhost:5173`).

---

## 🏗️ Technical Details

* **Multimodal Generation**: The application parses base64 data from both the sketch image and fabric swatch attachments. It passes these in parallel with your instructions to `gemini-1.5-flash` to craft a professional photorealistic prompt.
* **Imagen Studio Fusing**: The synthesized prompt is forwarded to Google's state-of-the-art `imagen-3.0-generate-002` model to render the final apparel onto the selected model avatar.
" 
