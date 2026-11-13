import type { ExportSnapshot } from "@/lib/domain/export-snapshot";

function nl(text: string) {
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 ? <br /> : null}
      {line}
    </span>
  ));
}

/** Visual isomorphic sheets aligned to docs/demos/my-career/export-final.html */
export function ExportSheets({
  snapshot,
  doc,
  photoUrl = null,
}: {
  snapshot: ExportSnapshot;
  doc: "rirekisho" | "shokumu";
  /** Session photo URL (`/api/profile/photo`); null → empty 写真 frame. */
  photoUrl?: string | null;
}) {
  if (doc === "rirekisho") {
    return <RirekishoSheet snapshot={snapshot} photoUrl={photoUrl} />;
  }
  return <ShokumuSheet snapshot={snapshot} />;
}

function RirekishoSheet({
  snapshot,
  photoUrl,
}: {
  snapshot: ExportSnapshot;
  photoUrl: string | null;
}) {
  return (
    <article className="mc-a4 mc-rk">
      <div className="mc-rk-head">
        <div>
          <h2 className="mc-rk-title">履　歴　書</h2>
          <p className="mc-rk-date">{snapshot.asOfRirekisho}</p>
          <table>
            <tbody>
              <tr>
                <td className="mc-lab">ふりがな</td>
                <td colSpan={3}>{snapshot.fullNameKana}</td>
              </tr>
              <tr>
                <td className="mc-lab">氏　名</td>
                <td colSpan={3}>{snapshot.fullName}</td>
              </tr>
              <tr>
                <td className="mc-lab">生年月日</td>
                <td>{snapshot.birthLine}</td>
                <td className="mc-lab">性別</td>
                <td>{snapshot.gender}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mc-photo">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated photo API
            <img src={photoUrl} alt="証明写真" />
          ) : (
            "写真"
          )}
        </div>
      </div>

      <table>
        <tbody>
          <tr>
            <td className="mc-lab">ふりがな</td>
            <td colSpan={3} className="mc-small">
              {snapshot.addressKana}
            </td>
          </tr>
          <tr>
            <td className="mc-lab">現住所</td>
            <td colSpan={3}>{nl(snapshot.address)}</td>
          </tr>
          <tr>
            <td className="mc-lab">電話</td>
            <td></td>
            <td className="mc-lab">携帯</td>
            <td>{snapshot.phone}</td>
          </tr>
          <tr>
            <td className="mc-lab">E-mail</td>
            <td colSpan={3}>{snapshot.email}</td>
          </tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr>
            <th className="mc-ym">年</th>
            <th className="mc-mm">月</th>
            <th>学歴・職歴</th>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td className="mc-center">学　歴</td>
          </tr>
          {snapshot.educationLines.map((row, i) => (
            <tr key={`e-${i}`}>
              <td className="mc-ym">{row.year}</td>
              <td className="mc-mm">{row.month}</td>
              <td>{row.text}</td>
            </tr>
          ))}
          <tr>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td className="mc-center">職　歴</td>
          </tr>
          {snapshot.workLines.map((row, i) => (
            <tr key={`w-${i}`}>
              <td className="mc-ym">{row.year}</td>
              <td className="mc-mm">{row.month}</td>
              <td>{row.text}</td>
            </tr>
          ))}
          {snapshot.workLines.length > 0 ? (
            <tr>
              <td></td>
              <td></td>
              <td>現在に至る</td>
            </tr>
          ) : null}
          <tr>
            <td></td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <td></td>
            <td></td>
            <td className="mc-right">以上</td>
          </tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr>
            <th className="mc-ym">年</th>
            <th className="mc-mm">月</th>
            <th>免許・資格</th>
          </tr>
          {snapshot.licenseLines.map((row, i) => (
            <tr key={`l-${i}`}>
              <td className="mc-ym">{row.year}</td>
              <td className="mc-mm">{row.month}</td>
              <td>{row.text}</td>
            </tr>
          ))}
          <tr>
            <td className="mc-lab" colSpan={1}>
              備考
            </td>
            <td colSpan={2}>{nl(snapshot.residenceLines.join("\n"))}</td>
          </tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr>
            <td className="mc-lab" colSpan={2}>
              現在の給与条件
            </td>
          </tr>
          {snapshot.salaryLines.map((line, i) => (
            <tr key={`s-${i}`}>
              <td colSpan={2}>{line}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table>
        <tbody>
          <tr>
            <td className="mc-lab">語学レベル</td>
          </tr>
          <tr>
            <td>
              {snapshot.languages
                .map((l) => `${l.language}（${l.level}）`)
                .join("　／　")}
            </td>
          </tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr>
            <td className="mc-lab mc-small">
              本人希望記入欄（特に給料・職種・勤務時間・勤務地・その他についての希望などがあれば記入）
            </td>
          </tr>
          <tr>
            <td>{snapshot.personalHope}</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function ShokumuSheet({ snapshot }: { snapshot: ExportSnapshot }) {
  return (
    <article className="mc-a4 mc-sk">
      <h2>職　務　経　歴　書</h2>
      <p className="mc-meta">{snapshot.asOfShokumu}</p>
      <p className="mc-meta">氏名　　{snapshot.fullName}</p>

      <h3>■職務経歴</h3>
      <p>{nl(snapshot.jobCareerLine)}</p>

      <h3>■職務要約</h3>
      <p>{nl(snapshot.jobSummary)}</p>

      <h3>■活かせる経験・知識</h3>
      <ul>
        {snapshot.strengths.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <h3>■職務詳細</h3>
      {snapshot.employers.map((e, i) => (
        <div key={i}>
          <p className="mc-company">{e.header}</p>
          {e.meta ? <p>{e.meta}</p> : null}
        </div>
      ))}

      <table>
        <thead>
          <tr>
            <th>期間</th>
            <th>業務内容</th>
            <th>開発環境</th>
            <th>規模/役割</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.projects.map((p, i) => (
            <tr key={i}>
              <td className="mc-c0">{nl(p.period)}</td>
              <td>
                <div className="mc-block-title">
                  {p.titleUrl ? (
                    <a href={p.titleUrl} target="_blank" rel="noopener noreferrer">
                      {p.title}
                    </a>
                  ) : (
                    p.title
                  )}
                </div>
                {p.overview ? (
                  <>
                    <div className="mc-subh">【プロジェクト概要】</div>
                    {nl(p.overview)}
                  </>
                ) : null}
                {p.phases ? (
                  <>
                    <div className="mc-subh">【担当フェーズ】</div>
                    {nl(p.phases)}
                  </>
                ) : null}
                {p.responsibilities ? (
                  <>
                    <div className="mc-subh">【業務内容】</div>
                    {nl(p.responsibilities)}
                  </>
                ) : null}
                {p.results ? (
                  <>
                    <div className="mc-subh">【実績・取り組み等】</div>
                    {nl(p.results)}
                  </>
                ) : null}
              </td>
              <td className="mc-c2">{nl(p.environment)}</td>
              <td className="mc-c3">{nl(p.roleScale)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>■資格</h3>
      <ul>
        {snapshot.licenseLines.map((row, i) => (
          <li key={i}>
            {row.year}年{row.month}月　{row.text}
          </li>
        ))}
      </ul>

      <h3>■言語</h3>
      <ul>
        {snapshot.languages.map((l, i) => (
          <li key={i}>
            {l.language}（{l.level}）
          </li>
        ))}
      </ul>

      <h3>■（テクニカル）スキル</h3>
      <table>
        <thead>
          <tr>
            <th>分類</th>
            <th>技術</th>
            <th>経験</th>
            <th>内容</th>
          </tr>
        </thead>
        <tbody>
          {snapshot.skillRows.map((row, i) => (
            <tr key={i}>
              <td>{row.category}</td>
              <td>{row.name}</td>
              <td>{row.yearsText}</td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>■自己PR</h3>
      <p>{nl(snapshot.selfPr)}</p>

      <h3>■自己研鑽（プロジェクトタイトル／リンクと同源）</h3>
      <ul>
        {snapshot.selfStudyLinks.map((link, i) => (
          <li key={i}>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
