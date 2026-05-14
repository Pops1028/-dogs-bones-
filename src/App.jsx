import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    console.log("Dog Bones App loaded");
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#111",
        color: "white",
        padding: 20,
        fontFamily: "Arial, sans-serif"
      }}
    >
      <h1>Dog Bones 🎸</h1>
      <p>If you can see this, React is working correctly.</p>
    </div>
  );
}
