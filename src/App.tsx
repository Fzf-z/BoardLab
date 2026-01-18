import React from 'react';
import BoardLab from './BoardLab';
import ErrorBoundary from './components/ErrorBoundary';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BoardLab />
    </ErrorBoundary>
  );
}

export default App;
