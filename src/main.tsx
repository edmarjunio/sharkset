import { registerStaticWorker } from './services/serviceWorker';
import { startPerformanceMetrics } from './services/performanceMetrics';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './services/i18n.ts';

createRoot(document.getElementById('root')!).render(<App />);

startPerformanceMetrics();
registerStaticWorker();
