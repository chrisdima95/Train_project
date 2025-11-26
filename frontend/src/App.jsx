import { useCallback, useEffect, useMemo, useState } from 'react'

const API_URL = 'http://localhost:5000/api/dati'
const CHART_METRICS = [
  { key: 'velocita', label: 'Velocità', unit: 'km/h', color: '#ff7a18' },
  { key: 'potenza_kw', label: 'Potenza', unit: 'kW', color: '#1abc9c' },
  { key: 'energia_kwh', label: 'Energia', unit: 'kWh', color: '#3498db' },
  { key: 'massa', label: 'Massa', unit: 't', color: '#9b59b6' },
]

export default function App() {
  const [train, setTrain] = useState(null)
  const [error, setError] = useState('')
  const [hover, setHover] = useState(null)

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(API_URL)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setTrain(data)
      setError('')
    } catch (err) {
      console.error('Errore nel recupero dati:', err)
      setError('Backend non raggiungibile. Assicurati che sia avviato.')
    }
  }, [])

  useEffect(() => {
    fetchData()
    const intervalId = setInterval(fetchData, 5000)
    return () => clearInterval(intervalId)
  }, [fetchData])

  const timeline = train?.timeline || []
  const route = train?.route || []

  const chartGeometry = useMemo(() => {
    if (!timeline.length) return {}
    const width = 640
    const height = 220
    const padding = { top: 20, right: 20, bottom: 40, left: 50 }
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.top - padding.bottom

    const createChart = (key) => {
      const values = timeline.map((point) => Number(point[key]) || 0)
      const rawMax = Math.max(...values, 1)
      // Arrotonda il massimo verso l'alto per avere un asse Y più leggibile
      const max = Math.ceil((rawMax * 1.1) / 10) * 10
      const min = 0
      const range = Math.max(max - min, 1)
      const points = timeline.map((point, index) => {
        const x =
          padding.left +
          (index / Math.max(timeline.length - 1, 1)) * innerWidth
        const normalized = (values[index] - min) / range
        const y = padding.top + innerHeight - normalized * innerHeight
        return {
          x,
          y,
          timestamp: point.timestamp,
          value: values[index],
        }
      })

      return {
        width,
        height,
        padding,
        points,
        path: points
          .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
          .join(' '),
        max,
        min,
      }
    }

    return CHART_METRICS.reduce((acc, metric) => {
      acc[metric.key] = createChart(metric.key)
      return acc
    }, {})
  }, [timeline])

  if (error && !train) {
    return <div className="loading">{error}</div>
  }

  if (!train) {
    return <div className="loading">Recupero dati del treno...</div>
  }

  const TOOLTIP_WIDTH = 120
  const TOOLTIP_HEIGHT = 34

  const progress = Math.min((train.velocita / 350) * 100, 100)
  const notes = (train.altre_metriche || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, value] = pair.split('=')
      return {
        label: key ? key.replace(/_/g, ' ') : 'Dato',
        value: value ?? '-',
      }
    })

  return (
    <div className="dashboard">
      <header>
        <div>
          <p className="subtitle">Dashboard operativo</p>
          <h1>{train.id}</h1>
        </div>
        <div className="status-pill">{train.tipo_alimentazione}</div>
      </header>

      <section className="grid">
        <article className="card span-2">
          <h3>Velocità attuale</h3>
          <p className="value">
            {train.velocita}
            <span>km/h</span>
          </p>
          <div className="progress">
            <div style={{ width: `${progress}%` }} />
          </div>
        </article>

        <article className="card">
          <h3>Potenza</h3>
          <p className="value">
            {train.potenza_kw}
            <span>kW</span>
          </p>
        </article>

        <article className="card">
          <h3>Energia consumata</h3>
          <p className="value">
            {train.energia_kwh}
            <span>kWh</span>
          </p>
        </article>

        <article className="card">
          <h3>Massa complessiva</h3>
          <p className="value">
            {train.massa}
            <span>t</span>
          </p>
        </article>

        <article className="card span-2">
          <h3>Note tecniche</h3>
          {notes.length ? (
            <ul className="metrics-list">
              {notes.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="metrics">Nessuna nota disponibile</p>
          )}
        </article>

        {CHART_METRICS.map((metric) => {
          const geometry = chartGeometry[metric.key]
          const activeHover =
            hover && hover.metric === metric.key && geometry
              ? (() => {
                  const baseX = hover.point.x
                  const baseY = hover.point.y
                  const minX = geometry.padding.left + TOOLTIP_WIDTH / 2
                  const maxX =
                    geometry.width - geometry.padding.right - TOOLTIP_WIDTH / 2
                  const centerX = Math.min(Math.max(baseX, minX), maxX)
                  const topY = Math.max(
                    baseY - 46,
                    geometry.padding.top + 4,
                  )
                  return { ...hover, centerX, topY }
                })()
              : null
          return (
            <article className="card span-2 chart-card" key={metric.key}>
              <h3>
                Andamento {metric.label.toLowerCase()} ({metric.unit})
              </h3>
              {timeline.length && geometry ? (
                <div className="chart-wrapper">
                  <svg
                    viewBox={`0 0 ${geometry.width} ${geometry.height}`}
                    role="img"
                  >
                    <line
                      x1={geometry.padding.left}
                      y1={geometry.padding.top}
                      x2={geometry.padding.left}
                      y2={geometry.height - geometry.padding.bottom}
                      className="chart-axis"
                    />
                    <line
                      x1={geometry.padding.left}
                      y1={geometry.height - geometry.padding.bottom}
                      x2={geometry.width - geometry.padding.right}
                      y2={geometry.height - geometry.padding.bottom}
                      className="chart-axis"
                    />
                    <text
                      x={geometry.padding.left - 10}
                      y={geometry.padding.top + 4}
                      className="chart-label axis-label"
                    >
                      {geometry.max.toFixed(0)} {metric.unit}
                    </text>
                    <text
                      x={geometry.padding.left - 10}
                      y={geometry.height - geometry.padding.bottom}
                      className="chart-label axis-label"
                    >
                      {geometry.min.toFixed(0)} {metric.unit}
                    </text>
                    <path
                      d={geometry.path}
                      style={{ stroke: metric.color }}
                      className="chart-line"
                    />
                    {geometry.points.map((point) => (
                      <g key={`${metric.key}-${point.timestamp}`}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="4"
                          style={{ fill: metric.color }}
                          onMouseEnter={() =>
                            setHover({ metric: metric.key, point, unit: metric.unit, label: metric.label })
                          }
                          onMouseLeave={() => setHover(null)}
                        />
                        <text
                          x={point.x}
                          y={geometry.height - geometry.padding.bottom + 16}
                          className="chart-label"
                        >
                          {point.timestamp}
                        </text>
                      </g>
                    ))}
                    {hover && hover.metric === metric.key && (
                      <g className="chart-tooltip">
                        <rect
                          x={activeHover.centerX - TOOLTIP_WIDTH / 2}
                          y={activeHover.topY}
                          rx="6"
                          ry="6"
                          width={TOOLTIP_WIDTH}
                          height={TOOLTIP_HEIGHT}
                        />
                        <text
                          x={activeHover.centerX}
                          y={activeHover.topY + 14}
                          className="chart-tooltip-title"
                        >
                          {activeHover.label}{' '}
                          {activeHover.point.value.toFixed(0)}{' '}
                          {activeHover.unit}
                        </text>
                        <text
                          x={activeHover.centerX}
                          y={activeHover.topY + 28}
                          className="chart-tooltip-sub"
                        >
                          {activeHover.point.timestamp}
                        </text>
                      </g>
                    )}
                  </svg>
                </div>
              ) : (
                <p className="metrics">Nessun dato storico disponibile</p>
              )}
            </article>
          )
        })}

        <article className="card span-2 type-card">
          <h3>Tipo alimentazione sulla timeline</h3>
          {timeline.length ? (
            <div className="type-timeline">
              {timeline.map((point) => (
                <div className="type-chip" key={`tipo-${point.timestamp}`}>
                  <span>{point.timestamp}</span>
                  <strong>{point.tipo_alimentazione || train.tipo_alimentazione}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="metrics">Nessun dato disponibile</p>
          )}
        </article>

        <article className="card span-2 route-card">
          <h3>Percorso stilizzato</h3>
          <div className="route-line">
            {route.map((segment, index) => (
              <div className="route-stop" key={segment.citta}>
                <div className="dot" />
                <p>{segment.citta}</p>
                <span>{segment.km} km</span>
                {index < route.length - 1 && <div className="route-connector" />}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

