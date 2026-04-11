import { Routes, Route } from "react-router-dom";
import BacktestPage, { GlobalStyle } from "./pages/BacktestPage";
import ResultsPage from "./pages/ResultsPage";
import Nav from "./components/Nav";
import FibonacciPage from "./pages/FibonacciPage";
import ChartPage from "./pages/ChartPage";

const App = () => (
  <>
    <GlobalStyle />
    <Nav />
    <Routes>
      <Route path="/" element={<BacktestPage />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/fib" element={<FibonacciPage />} />
      <Route path="/chart" element={<ChartPage />} />
    </Routes>
  </>
);

export default App;
