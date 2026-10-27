import { useEffect, useState } from 'react'
import './App.css'
import FastestGate from './components/FastestGate'

const API_KEY = import.meta.env.VITE_API_KEY
// 개발: Vite 프록시 / 배포: Netlify 프록시(netlify.toml)가 /api를 공공데이터 서버로 전달
const BASE_URL = '/api'
const OPERATION = 'getPassgrAnncmt'

type Row = Record<string, string | number>

// 응답이 items 배열 또는 items.item(단건이면 객체)으로 올 수 있어 둘 다 처리
function extractItems(json: any): Row[] {
  const items = json?.response?.body?.items
  if (Array.isArray(items)) return items
  const item = items?.item
  if (Array.isArray(item)) return item
  if (item) return [item]
  return []
}

function App() {
  const [rows, setRows] = useState<Row[]>([])
  const [raw, setRaw] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({
      serviceKey: API_KEY,
      type: 'json',
      numOfRows: '100', // 기본값 10건 → 하루치 전체를 받도록 늘림
      pageNo: '1',
    })

    fetch(`${BASE_URL}/${OPERATION}?${params}`)
      .then(async (res) => {
        const text = await res.text()
        setRaw(text)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        let json: any
        try {
          json = JSON.parse(text)
        } catch {
          // 인증 오류 등은 type=json이어도 XML로 오는 경우가 있음
          throw new Error('JSON이 아닌 응답입니다. 아래 원문을 확인하세요.')
        }

        const header = json?.response?.header
        if (header && header.resultCode !== '00') {
          throw new Error(`${header.resultCode} ${header.resultMsg}`)
        }
        setRows(extractItems(json))
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <main className="page">
      <h1>인천공항 승객 예고</h1>
      <p className="sub">시간대별로 가장 한산한 출국장을 찾아 드립니다</p>

      {loading && <p>불러오는 중...</p>}

      {error && (
        <div className="error">
          <strong>오류:</strong> {error}
          {raw && <pre>{raw.slice(0, 2000)}</pre>}
        </div>
      )}

      {!loading && !error && rows.length === 0 && <p>데이터가 없습니다.</p>}

      {rows.length > 0 && <FastestGate rows={rows} />}

      {rows.length > 0 && (
        <details className="raw-table">
          <summary>전체 데이터 표 보기</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c}>{row[c]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </details>
      )}
    </main>
  )
}

export default App
