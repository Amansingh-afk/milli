import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Landing } from './pages/Landing';
import { Create } from './pages/Create';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create" element={<Create />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
