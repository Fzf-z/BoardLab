import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { NotifierProvider } from './contexts/NotifierContext';
import { ProjectProvider } from './contexts/ProjectContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NotifierProvider>
      <ProjectProvider>
        <App />
      </ProjectProvider>
    </NotifierProvider>
  </React.StrictMode>,
)