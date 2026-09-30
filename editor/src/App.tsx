import { Toolbar } from "./panels/Toolbar";
import { FlowCanvas } from "./flow/FlowCanvas";
import { PropertyPanel } from "./panels/PropertyPanel";
import { InspectorPanel } from "./panels/InspectorPanel";

export default function App() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "system-ui, -apple-system, 'PingFang SC', sans-serif",
      }}
    >
      <Toolbar />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <FlowCanvas />
          </div>
          <InspectorPanel />
        </div>
        <PropertyPanel />
      </div>
    </div>
  );
}
