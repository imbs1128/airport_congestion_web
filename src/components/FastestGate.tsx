import { useMemo, useState } from 'react'
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

// 터미널별 출국장 열 이름 (dg = 출국장)
const GATES: Record<Terminal, { key: string; label: string }[]> = {
  T1: [1, 2, 3, 4, 5, 6].map((n) => ({ key: `t1dg${n}`, label: `${n}번` })),
  T2: [1, 2].map((n) => ({ key: `t2dg${n}`, label: `${n}번` })),
}

const pad = (n: number) => String(n).padStart(2, '0')

// 지금 시각이 속한 시간대 (예: 21시 → "21_22")
function currentSlot() {
  const h = new Date().getHours()
  return `${pad(h)}_${pad(h + 1)}`
}

// "08_09" → "08시~09시"
const slotLabel = (slot: string) => slot.replace('_', '시~') + '시'

const fmt = (n: number) => n.toLocaleString('ko-KR')

function FastestGate({ rows }: { rows: Row[] }) {
  // 맨 아래 "합계" 행은 제외
  const hourRows = useMemo(() => rows.filter((r) => r.atime !== '합계'), [rows])
  const slots = hourRows.map((r) => String(r.atime))

  const [terminal, setTerminal] = useState<Terminal>('T1')
  const [slot, setSlot] = useState(() =>
    slots.includes(currentSlot()) ? currentSlot() : slots[0],
  )

  const row = hourRows.find((r) => r.atime === slot)
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

  // ----- Chart.js 설정 -----
  const color = {
    accent: cssVar('--accent'),
    muted: cssVar('--bar-muted'),
    text: cssVar('--text'),
    textH: cssVar('--text-h'),
    border: cssVar('--border'),
  }

  // 데이터: 라벨(가로축)과 값(막대 높이)을 따로 넘김
  const data: ChartData<'bar'> = {
    labels: open.map((g) => g.name),
    datasets: [
      {
        label: '예상 인원',
        data: open.map((g) => g.count),
        // 가장 한산한 출국장만 강조색, 나머지는 회색
        backgroundColor: open.map((g) => (g === best ? color.accent : color.muted)),
        borderRadius: 4,
        maxBarThickness: 56,
      },
    ],
  }

  // 옵션: 축, 격자, 툴팁 모양
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 24 } },
    plugins: {
      legend: { display: false }, // 막대 1종류라 범례 불필요
      tooltip: {
        callbacks: {
          title: (items) => `${terminal} ${items[0].label} 출국장`,
          label: (item) => `예상 인원: ${fmt(Number(item.parsed.y ?? 0))}명`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: color.border },
        ticks: { color: color.text, font: { size: 14 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: color.border },
        border: { display: false },
        ticks: { color: color.text, callback: (v) => fmt(Number(v)) },
      },
    },
  }

  // 막대 위에 숫자를 써 주는 작은 플러그인 (Chart.js 기본 기능에는 없음)
  const valueLabels: Plugin<'bar'> = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart
      ctx.save()
      ctx.fillStyle = color.textH
      ctx.font = '13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      chart.getDatasetMeta(0).data.forEach((bar, i) => {
        const v = Number(chart.data.datasets[0].data[i])
        ctx.fillText(fmt(v), bar.x, bar.y - 4)
      })
      ctx.restore()
    },
  }

  return (
    <section className="fastest">
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

        <select value={slot} onChange={(e) => setSlot(e.target.value)}>
          {slots.map((s) => (
            <option key={s} value={s}>
              {slotLabel(s)}
              {s === currentSlot() ? ' (지금)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="hero">
        <span className="hero-label">가장 한산한 출국장</span>
        {best ? (
          <>
            <strong className="hero-value">
              {terminal} {best.name} 출국장
            </strong>
            <span className="hero-sub">
              {slotLabel(slot)} 예상 {fmt(best.count)}명
            </span>
          </>
        ) : (
          <strong className="hero-value">운영 중인 출국장 없음</strong>
        )}
      </div>

      {open.length > 0 && (
        <div className="chart" style={{ position: 'relative', height: 280 }}>
          <Bar data={data} options={options} plugins={[valueLabels]} />
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
