
import Header       from './Header';
import Sidebar      from './Sidebar';
import MainWorkspace from './MainWorkspace';
import PlaybackBar  from './PlaybackBar';
import ToastContainer from '../common/ToastContainer';
import InferencePanel from '../../features/inference/InferencePanel';
import NodeInspector  from '../../features/inspector/NodeInspector';
import { useUIStore } from '../../store/uiStore';

export default function Layout() {
  const { leftPanelOpen, rightPanelOpen } = useUIStore();

  return (
    <div className="app-root">
      <Header />
      <div className="main-content">
        <Sidebar title="EXPLORER" side="left" isOpen={leftPanelOpen}>
          <InferencePanel />
        </Sidebar>

        <MainWorkspace />

        <Sidebar title="INSPECTOR" side="right" isOpen={rightPanelOpen}>
          <NodeInspector />
        </Sidebar>
      </div>
      <PlaybackBar />
      <ToastContainer />
    </div>
  );
}
