import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type Plugin,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

// Chart.js는 쓸 부품만 골라서 등록해야 함 (번들 크기를 줄이기 위한 설계)
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

// Chart.js는 <canvas>에 그려서 CSS 변수를 직접 못 씀 → 실제 색 값을 읽어 옴
const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

type Row = Record<string, string | number>
type Terminal = 'T1' | 'T2'
type View = { date: string; hour: number } // date: "20261029", hour: 0~23

// 터미널별 출국장 열 이름 (dg = 출국장)
const GATES: Record<Terminal, { key: string; label: string }[]> = {
  T1: [1, 2, 3, 4, 5, 6].map((n) => ({ key: `t1dg${n}`, label: `${n}번` })),
  T2: [1, 2].map((n) => ({ key: `t2dg${n}`, label: `${n}번` })),
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (n: number) => n.toLocaleString('ko-KR')

// ----- 날짜/시간 변환 도우미 -----
// Date → "20261029" (API의 adate 형식)
const toYmd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
// "20261029" → "2026-10-29" (입력창 형식)
const ymdToDash = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
// View → "2026-10-29T08:00" (datetime-local 입력창 값)
const toInputValue = (v: View) => `${ymdToDash(v.date)}T${pad(v.hour)}:00`
// 시간 → API의 atime 형식 ("08_09")
const toSlot = (hour: number) => `${pad(hour)}_${pad(hour + 1)}`

// 화면 폭이 640px 이하인지 실시간으로 알려 주는 훅 (창 크기를 바꾸면 자동으로 다시 그림)
const MOBILE_QUERY = '(max-width: 640px)'
function useIsMobile() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(MOBILE_QUERY)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
  )
}

const nowView = (): View => {
  const d = new Date()
  return { date: toYmd(d), hour: d.getHours() }
}

function FastestGate({ rows }: { rows: Row[] }) {
  // API가 준 날짜 목록 (오늘, 내일) — "합계" 행은 제외
  const dates = useMemo(
    () => [...new Set(rows.map((r) => String(r.adate)))].filter((d) => d !== '합계').sort(),
    [rows],
  )

  const isMobile = useIsMobile()
  const [terminal, setTerminal] = useState<Terminal>('T1')
  const [view, setView] = useState<View>(nowView) // 지금 보여주는 시간대
  const [input, setInput] = useState(() => toInputValue(nowView())) // 입력창 값
  const [message, setMessage] = useState<string | null>(null)

  const now = nowView()
  const isNow = view.date === now.date && view.hour === now.hour

  // "이 시간대 혼잡도 보기" 버튼
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault() // 폼 제출 시 페이지가 새로고침되는 기본 동작을 막음
    if (!input) return setMessage('날짜와 시간을 입력해 주세요.')

    const [datePart, timePart] = input.split('T') // "2026-10-30", "08:30"
    const date = datePart.replaceAll('-', '')
    const hour = Number(timePart.slice(0, 2))

    if (!dates.includes(date)) {
      return setMessage('오늘과 내일 날짜만 조회할 수 있습니다.')
    }
    setMessage(null)
    setView({ date, hour })
  }

  // "현재 시간으로 돌아가기" 버튼
  const handleReset = () => {
    const n = nowView()
    setView(n)
    setInput(toInputValue(n))
    setMessage(null)
  }

  // 선택한 날짜 + 시간대의 데이터 한 줄
  const row = rows.find((r) => String(r.adate) === view.date && r.atime === toSlot(view.hour))
  const gates = GATES[terminal].map((g) => ({
    name: g.label,
    count: Number(row?.[g.key] ?? 0),
  }))

  // 0명 = 해당 시간에 운영하지 않는 출국장으로 보고 제외
  const open = gates.filter((g) => g.count > 0)
  const closed = gates.filter((g) => g.count === 0)
  const best = open.length
    ? open.reduce((min, g) => (g.count < min.count ? g : min))
    : null

  // 화면 표시용: "10월 30일(내일) 08시~09시"
  const dayName = view.date === dates[0] ? '오늘' : '내일'
  const viewLabel = `${Number(view.date.slice(4, 6))}월 ${Number(view.date.slice(6, 8))}일(${dayName}) ${pad(view.hour)}시~${pad(view.hour + 1)}시`

  // ----- Chart.js 설정 -----
  const color = {
    accent: cssVar('--accent'),
    muted: cssVar('--bar-muted'),
    text: cssVar('--text'),
    textH: cssVar('--text-h'),
    border: cssVar('--border'),
  }

  const data: ChartData<'bar'> = {
    labels: open.map((g) => g.name),
    datasets: [
      {
        label: '예상 인원',
        data: open.map((g) => g.count),
        // 가장 한산한 출국장만 강조색, 나머지는 회색
        backgroundColor: open.map((g) => (g === best ? color.accent : color.muted)),
        borderRadius: 4,
        maxBarThickness: isMobile ? 36 : 56,
      },
    ],
  }

  // 모바일: 막대를 가로로 눕혀 위→아래로 나열 (indexAxis: 'y') / 데스크톱: 세로 막대
  const horizontal = isMobile
  const categoryAxis = {
    grid: { display: false },
    border: { color: color.border },
    ticks: { color: color.text, font: { size: isMobile ? 13 : 14 } },
  }
  const valueAxis = {
    beginAtZero: true,
    grid: { color: color.border },
    border: { display: false },
    ticks: {
      color: color.text,
      font: { size: isMobile ? 11 : 12 },
      callback: (v: string | number) => fmt(Number(v)),
    },
  }

  const options: ChartOptions<'bar'> = {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    // 막대 끝에 숫자가 들어갈 여백 (가로 막대면 오른쪽, 세로 막대면 위쪽)
    layout: { padding: horizontal ? { right: 48 } : { top: 24 } },
    plugins: {
      legend: { display: false }, // 막대 1종류라 범례 불필요
      tooltip: {
        callbacks: {
          title: (items) => `${terminal} ${items[0].label} 출국장`,
          label: (item) =>
            `예상 인원: ${fmt(Number((horizontal ? item.parsed.x : item.parsed.y) ?? 0))}명`,
        },
      },
    },
    scales: horizontal
      ? { y: categoryAxis, x: valueAxis }
      : { x: categoryAxis, y: valueAxis },
  }

  // 차트 높이: 모바일은 막대 개수에 맞춰 늘어남
  const chartHeight = horizontal ? open.length * 52 + 40 : 280

  // 막대 위에 숫자를 써 주는 작은 플러그인 (Chart.js 기본 기능에는 없음)
  const valueLabels: Plugin<'bar'> = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart
      ctx.save()
      ctx.fillStyle = color.textH
      ctx.font = '13px system-ui, sans-serif'
      chart.getDatasetMeta(0).data.forEach((bar, i) => {
        const v = fmt(Number(chart.data.datasets[0].data[i]))
        if (horizontal) {
          // 가로 막대: 막대 오른쪽 끝 옆에
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(v, bar.x + 6, bar.y)
        } else {
          // 세로 막대: 막대 위에
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillText(v, bar.x, bar.y - 4)
        }
      })
      ctx.restore()
    },
  }

  return (
    <section className="fastest">
      {/* 출발 시간 입력 */}
      <form className="departure" onSubmit={handleSubmit}>
        <label htmlFor="departure-time">출발 날짜와 시간</label>
        <div className="departure-row">
          <input
            id="departure-time"
            type="datetime-local"
            value={input}
            min={dates[0] ? `${ymdToDash(dates[0])}T00:00` : undefined}
            max={dates.at(-1) ? `${ymdToDash(dates.at(-1)!)}T23:59` : undefined}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="primary">
            이 시간대 혼잡도 보기
          </button>
          <button type="button" onClick={handleReset} disabled={isNow}>
            현재 시간으로 돌아가기
          </button>
        </div>
        {message && <p className="form-message">{message}</p>}
      </form>

      <div className="controls">
        <div className="segmented" role="group" aria-label="터미널 선택">
          {(['T1', 'T2'] as Terminal[]).map((t) => (
            <button
              key={t}
              type="button"
              className={t === terminal ? 'active' : ''}
              onClick={() => setTerminal(t)}
            >
              {t === 'T1' ? '제1터미널' : '제2터미널'}
            </button>
          ))}
        </div>
      </div>

      <div className="hero">
        <span className="hero-label">
          가장 한산한 출국장 · <span className="badge">{isNow ? '지금' : '선택한 시간'}</span>
        </span>
        {best ? (
          <>
            <strong className="hero-value">
              {terminal} {best.name} 출국장
            </strong>
            <span className="hero-sub">
              {viewLabel} 예상 {fmt(best.count)}명
            </span>
          </>
        ) : (
          <>
            <strong className="hero-value">운영 중인 출국장 없음</strong>
            <span className="hero-sub">{viewLabel}</span>
          </>
        )}
      </div>

      {open.length > 0 && (
        <div className="chart" style={{ position: 'relative', height: chartHeight }}>
          {/* key가 바뀌면 차트를 새로 만듦 → 가로/세로 전환이 깔끔하게 적용됨 */}
          <Bar
            key={horizontal ? 'h' : 'v'}
            data={data}
            options={options}
            plugins={[valueLabels]}
          />
        </div>
      )}

      <p className="note">
        막대가 낮을수록 사람이 적어 빨리 통과할 가능성이 높습니다.
        {closed.length > 0 &&
          ` 미운영(0명): ${closed.map((g) => g.name).join(', ')} 출국장`}
      </p>
    </section>
  )
}

export default FastestGate
