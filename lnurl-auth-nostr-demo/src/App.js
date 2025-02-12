import logo from './logo.svg';
// import LNURLAuthLogin from './LNURLAuthLogin';
import { LNURLAuthLogin } from './withAuth';
import { NostrAuthLogin } from './NostrAuthLogin'; //'./withAuth';

import './App.css';

function App() {
  return (
    <div className="App">
      <LNURLAuthLogin />
      <NostrAuthLogin />
    </div>
  );
}

export default App;
