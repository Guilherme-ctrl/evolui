import { Link, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <div style={{ padding: '1.5rem' }}>
      <header style={{ marginBottom: '1rem' }}>
        <Link to="/">Início</Link>
      </header>
      <Routes>
        <Route
          path="/"
          element={
            <main>
              <h1>Frontend</h1>
              <p>Vite, React 19 e React Router — template vazio.</p>
            </main>
          }
        />
      </Routes>
    </div>
  );
}
