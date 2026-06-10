import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import * as Tooltip from '@radix-ui/react-tooltip';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Tooltip.Provider>
        <App />
      </Tooltip.Provider>
    </ErrorBoundary>
  </StrictMode>,
);
