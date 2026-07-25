import { BrowserRouter, Route, Routes } from "react-router-dom";
import { StudioProvider } from "./state/StudioContext";
import { LandingPage } from "./pages/LandingPage";
import { SeasonsListPage } from "./pages/SeasonsListPage";
import { SeasonDetailPage } from "./pages/SeasonDetailPage";
import { GarmentDetailPage } from "./pages/GarmentDetailPage";

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
        </Routes>
      </BrowserRouter>
    </StudioProvider>
  );
}

export default App;
