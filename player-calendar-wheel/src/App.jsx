import PlayerCalendarWheel from "./components/PlayerCalendarWheel";
import "./index.css";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-black text-amber-50">
      <h1 className="text-3xl font-bold mb-8 drop-shadow-lg">
      </h1>

      <PlayerCalendarWheel />

      <p className="mt-8 text-xs opacity-70">
      </p>
    </div>
  );
}
