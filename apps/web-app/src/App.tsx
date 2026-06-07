import { WorkerProvider } from './contexts/WorkerContext';
import Layout from './components/layout/Layout';
import './App.css';

export default function App() {
  return (
    <WorkerProvider>
      <Layout />
    </WorkerProvider>
  );
}
