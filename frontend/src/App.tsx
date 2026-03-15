import { Routes, Route } from "react-router-dom";
import BacktestPage, { GlobalStyle } from "./pages/BacktestPage";
import ResultsPage from "./pages/ResultsPage";
import Nav from "./components/Nav";

const App = () => (
  <>
    <GlobalStyle />
    <Nav />
    <Routes>
      <Route path="/" element={<BacktestPage />} />
      <Route path="/results" element={<ResultsPage />} />
    </Routes>
  </>
);

export default App;
