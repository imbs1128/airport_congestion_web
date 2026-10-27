import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

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
        <div className="chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={open} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                tick={{ fill: 'var(--text)', fontSize: 14 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--text)', fontSize: 12 }}
                tickFormatter={fmt}
                width={56}
              />
              <Tooltip
                cursor={{ fill: 'var(--accent-bg)' }}
                formatter={(v) => [`${fmt(Number(v))}명`, '예상 인원']}
                labelFormatter={(l) => `${terminal} ${l} 출국장`}
                contentStyle={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-h)',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {open.map((g) => (
                  <Cell
                    key={g.name}
                    fill={g === best ? 'var(--accent)' : 'var(--bar-muted)'}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  formatter={(v) => fmt(Number(v))}
                  style={{ fill: 'var(--text-h)', fontSize: 13 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
