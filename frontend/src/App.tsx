import { BrowserRouter, Route, Routes } from "react-router-dom";
import { StudioProvider } from "./state/StudioContext";
import { LandingPage } from "./pages/LandingPage";
import { SeasonsListPage } from "./pages/SeasonsListPage";
import { SeasonDetailPage } from "./pages/SeasonDetailPage";
import { GarmentDetailPage } from "./pages/GarmentDetailPage";
import { StageWorkspacePage } from "./pages/StageWorkspacePage";

function App() {
  return (
    <StudioProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/seasons" element={<SeasonsListPage />} />
          <Route path="/seasons/:seasonId" element={<SeasonDetailPage />} />
          <Route
            path="/seasons/:seasonId/garments/:garmentId"
            element={<GarmentDetailPage />}
          />
          <Route
            path="/seasons/:seasonId/garments/:garmentId/stage/:nodeKey"
            element={<StageWorkspacePage />}
          />
        </Routes>
      </BrowserRouter>
    </StudioProvider>
  );
}

export default App;
