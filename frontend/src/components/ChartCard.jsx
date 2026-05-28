import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

export default function ChartCard({ title, type, data, options, height = 260 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) {
      return undefined;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, {
      type,
      data,
      options,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, options, type]);

  return (
    <section className="panel chart-panel">
      <div className="chart-panel-head">
        <div>
          <p className="hero-kicker">Аналітика</p>
          <h3 className="panel-title">{title}</h3>
        </div>
      </div>
      <div className="chart-stage" style={{ height: `${height}px` }}>
        <canvas ref={canvasRef} />
      </div>
    </section>
  );
}
