import { InventoryProvider } from './context/InventoryContext';
import AppContent from './AppContent';

export default function App() {
  return (
    <InventoryProvider>
      <AppContent />
    </InventoryProvider>
  );
}
