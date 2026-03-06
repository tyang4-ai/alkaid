/**
 * Alkaid AI War Room — Training Dashboard
 * Visualizes RL training metrics, model comparison, and agent chat.
 */

import { DashboardApp } from './DashboardApp';

const root = document.getElementById('dashboard-root');
if (!root) throw new Error('Missing #dashboard-root');

const app = new DashboardApp(root);
app.init();
