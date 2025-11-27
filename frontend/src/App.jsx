import { useCallback, useEffect, useMemo, useState } from 'react'

const API_URL = 'http://localhost:5000/api/dati'
const CHART_METRICS = [
  { key: 'velocita', label: 'Velocità', unit: 'km/h', color: '#ff7a18' },
  { key: 'potenza_kw', label: 'Potenza', unit: 'kW', color: '#1abc9c' },
  { key: 'energia_kwh', label: 'Energia', unit: 'kWh', color: '#3498db' },
  { key: 'massa', label: 'Massa', unit: 't', color: '#9b59b6' },
]

const getPowerColor = (tipo) => {
  const value = (tipo || '').toLowerCase()
  if (value.includes('25kv')) return '#3498db' // blu
  if (value.includes('3kv')) return '#ff7a18' // arancione
  if (value.includes('1.5kv') || value.includes('1,5kv')) return '#e74c3c' // rosso
  return '#8fa0c4'
}

export default function App() {
  const [train, setTrain] = useState(null)
  const [error, setError] = useState('')
  const [hover, setHover] = useState(null)
  const [animatedValues, setAnimatedValues] = useState({
    velocita: 0,
    potenza_kw: 0,
    energia_kwh: 0,
  })
  const [hasAnimatedOnce, setHasAnimatedOnce] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState('velocita')

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

  useEffect(() => {
    if (!train) return

    // Se l'animazione iniziale è già avvenuta,
    // aggiorniamo solo i valori senza effetto contatore.
    if (hasAnimatedOnce) {
      setAnimatedValues({
        velocita: train.velocita,
        potenza_kw: train.potenza_kw,
        energia_kwh: train.energia_kwh,
      })
      return
    }

    const duration = 900
    const startTime = performance.now()
    let frameId

    const animate = (now) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)

      setAnimatedValues({
        velocita: Math.round(train.velocita * eased),
        potenza_kw: Math.round(train.potenza_kw * eased),
        energia_kwh: Math.round(train.energia_kwh * eased),
      })

      if (t < 1) {
        frameId = requestAnimationFrame(animate)
      } else {
        setHasAnimatedOnce(true)
      }
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [train, hasAnimatedOnce])

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

  const energyConsumptionChart = useMemo(() => {
    if (!timeline.length) return null

    const width = 280
    const height = 130
    const padding = { top: 12, right: 12, bottom: 20, left: 12 }
    const recentPoints = timeline.slice(-6)
    const values = recentPoints.map((point) => Number(point.energia_kwh) || 0)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = Math.max(max - min, 1)
    const innerWidth = width - padding.left - padding.right
    const innerHeight = height - padding.top - padding.bottom

    const points = recentPoints.map((point, index) => {
      const x =
        padding.left +
        (index / Math.max(values.length - 1, 1)) * innerWidth
      const normalized = (values[index] - min) / range
      const y = padding.top + (1 - normalized) * innerHeight
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
      min,
      max,
      points,
      path: points
        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
        .join(' '),
    }
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
      </header>

      <section className="grid">
        <article className="card">
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

        <article
          className="card span-2x2 train-hero-card"
          aria-label="Immagine del treno ad alta velocità con dati principali"
        >
          <div className="train-hero-content">
            <div className="metric energy-highlight">
              <span className="label">Consumo di energia (ultimi 30 minuti)</span>
              <span className="number energy-number">{train.consumo_30min || 0}</span>
              <span className="unit energy-unit">kWh</span>
            </div>

            {energyConsumptionChart && (
              <div
                className="energy-mini-chart"
                aria-label="Andamento consumo di energia negli ultimi 30 minuti"
              >
                <svg
                  viewBox={`0 0 ${energyConsumptionChart.width} ${energyConsumptionChart.height}`}
                  role="img"
                >
                  <path
                    d={energyConsumptionChart.path}
                    className="energy-line"
                  />
                  {energyConsumptionChart.points.map((point) => (
                    <g key={`energy-${point.timestamp}`}>
                      <circle cx={point.x} cy={point.y} r="3" />
                      <text
                        x={point.x}
                        y={energyConsumptionChart.height - 6}
                        className="energy-label"
                      >
                        {point.timestamp}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}

            <div className="train-hero-metrics">
              <div className="metric">
                <span className="label">Tipo alimentazione</span>
                <span className="number">{train.tipo_alimentazione || '-'}</span>
                <span className="unit"></span>
              </div>
              <div className="metric">
                <span className="label">Tensione motori</span>
                <span className="number">{train.tensione_motori || 0}</span>
                <span className="unit">V</span>
              </div>
              <div className="metric">
                <span className="label">Corrente trazione</span>
                <span className="number">{train.corrente_trazione || 0}</span>
                <span className="unit">A</span>
              </div>
              <div className="metric">
                <span className="label">Pressione</span>
                <span className="number">{train.pressione || 0}</span>
                <span className="unit">bar</span>
              </div>
            </div>
          </div>
        </article>

        <article className="card mass-card">
          <div className="mass-notes-block">
            <h5>Dati treno</h5>
            <ul className="metrics-list mass-notes-list">
              <li>
                <span>Massa complessiva</span>
                <strong className="metric-good">{train.massa} t</strong>
              </li>
              <li>
                <span>Alimentazione</span>
                <strong className="metric-good">{train.tipo_alimentazione}</strong>
              </li>
              <li>
                <span>Stato</span>
                <strong className="metric-good">{train.stato_operativo || '-'}</strong>
              </li>
              </ul>
              <h5>Diagnostica</h5>
              <ul className="metrics-list mass-notes-list">
              <li>
                <span>Freni</span>
                <strong className="metric-good">
                  {train.freni || '-'}
                </strong>
              </li>
              <li>
                <span>Motori</span>
                <strong className="metric-good">
                  {train.motori || '-'}
                </strong>
              </li>
              {notes.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <strong className="metric-good">{item.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className="wide-sections">
        <article className="card chart-card wide-card">
          <div className="chart-tabs">
            {CHART_METRICS.map((metric) => (
              <button
                key={metric.key}
                type="button"
                className={`chart-tab ${
                  selectedMetric === metric.key ? 'chart-tab--active' : ''
                }`}
                onClick={() => {
                  setSelectedMetric(metric.key)
                  setHover(null)
                }}
              >
                {metric.label}
              </button>
            ))}
          </div>

          {(() => {
            const metric = CHART_METRICS.find(
              (m) => m.key === selectedMetric,
            )
            const geometry = metric ? chartGeometry[metric.key] : null
            const activeHover =
              hover && hover.metric === selectedMetric && geometry
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

            if (!metric) {
              return null
            }

            return (
              <>
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
                              setHover({
                                metric: metric.key,
                                point,
                                unit: metric.unit,
                                label: metric.label,
                              })
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
                      {activeHover && (
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
              </>
            )
          })()}
        </article>

        <article className="card type-card wide-card">
          <h3>Tipo alimentazione sulla timeline</h3>
          {timeline.length ? (
            <div className="type-timeline">
              {timeline.map((point) => (
                <div
                  className="type-chip"
                  key={`tipo-${point.timestamp}`}
                  style={{
                    borderBottomColor: getPowerColor(
                      point.tipo_alimentazione || train.tipo_alimentazione,
                    ),
                  }}
                >
                  <span>{point.timestamp}</span>
                  <strong>
                    {point.tipo_alimentazione || train.tipo_alimentazione}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="metrics">Nessun dato disponibile</p>
          )}
        </article>

        <article className="card route-card wide-card">
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

