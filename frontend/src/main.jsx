import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootswatch/dist/brite/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
