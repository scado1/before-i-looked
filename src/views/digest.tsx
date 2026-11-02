import type { Night } from '../digest/types.js';

const RETRY_FLAG_AT = 3;

export function DigestPage({ night, data }: { night: string; data: Night }) {
  const { rows, badLines } = data;
  return (
    <>
      <h1>digest · {night}</h1>
      {badLines > 0 && <p class="warn">{badLines} unreadable line(s)</p>}
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>{r.job}</td>
                <td>{r.owner ?? '—'}</td>
                <td>{r.runs}</td>
                <td>
                  {r.retries}
                  {r.retries >= RETRY_FLAG_AT && <span class="warn"> ⚠ retries</span>}
                </td>
                <td>
                  {r.lastStatus}
                  {r.lastStatus === 'fail' && <span class="warn"> ✗ fail</span>}
                </td>
                <td>{r.lastError ?? '—'}</td>
                <td>{r.first}</td>
                <td>{r.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
