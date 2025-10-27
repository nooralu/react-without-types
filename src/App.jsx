import { useState } from 'react';

function Link() {
  return <a href="https://jser.dev">jser.dev</a>;
}

function Component() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() =>
        setCount((count) => count + 1)
      }>
        click me - {count}
      </button> ({count % 2 === 0 ? <span>even</span> : <b>odd</b>})
    </div>
  );
}

export default function App() {
  return (
    <div>
      <Link />
      <br />
      <Component />
    </div>
  );
}
