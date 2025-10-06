import { useEffect, useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    debugger;
    setCount(count + 1);
  }, []);

  return (
    <div>
      <button onClick={() => setCount((count) => count + 1)}>
        count is {count}
      </button>
    </div>
  );
}
