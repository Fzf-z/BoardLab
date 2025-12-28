import BoardLab from './BoardLab';
import { NotifierProvider } from './contexts/NotifierContext';

function App() {
  return (
    <NotifierProvider>
      <BoardLab />
    </NotifierProvider>
  );
}

export default App;