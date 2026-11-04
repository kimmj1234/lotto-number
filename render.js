// Turns report.json into HTML. Pure functions only, so tests can run them without a browser.
import { FORMULAS as F } from "./formulas.js";

const ODDS = "1/8,145,060";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = (x, digits = 0) => Number(x).toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pv = (p) => (p < 0.001 ? "0.001 미만" : num(p, 3));
const won = (x) => (x >= 1e8 ? `약 ${num(x / 1e8, 1)}억 원` : `${num(x)}원`);

const STRATEGY_NAMES = {
  hot_all: "전체 기간 많이 나온 번호", cold_all: "전체 기간 적게 나온 번호",
  hot_10: "최근 10회 많이 나온 번호", cold_10: "최근 10회 적게 나온 번호",
  hot_25: "최근 25회 많이 나온 번호", cold_25: "최근 25회 적게 나온 번호",
  hot_50: "최근 50회 많이 나온 번호", cold_50: "최근 50회 적게 나온 번호",
  hot_100: "최근 100회 많이 나온 번호", cold_100: "최근 100회 적게 나온 번호",
  hot_200: "최근 200회 많이 나온 번호", cold_200: "최근 200회 적게 나온 번호",
  overdue: "오래 안 나온 번호", recent_repeat: "직전 회차 번호 재사용", pair_greedy: "함께 자주 나온 번호",
  avoid_last: "직전 회차 번호 피하기", repeat_last: "직전 회차 번호와 겹치기", pairs: "함께 자주 나온 번호", pattern: "합계·홀짝 패턴",
};
const MODEL_NAMES = {
  logistic: "로지스틱 회귀", forest: "랜덤 포레스트", boosting: "그래디언트 부스팅", ensemble: "앙상블",
  bayes_100: "베이즈 추정 (약한 보정)", bayes_1000: "베이즈 추정 (중간 보정)", bayes_10000: "베이즈 추정 (강한 보정)",
  ema25_shrink0_1: "시간 가중 25회 (강한 보정)", ema25_shrink0_5: "시간 가중 25회 (약한 보정)",
  ema100_shrink0_1: "시간 가중 100회 (강한 보정)", ema100_shrink0_5: "시간 가중 100회 (약한 보정)",
};
const modelName = (key) => MODEL_NAMES[key.replace(".", "_")] ?? key;
const FEATURE_NAMES = {
  bday: "1~31 번호 개수", low12: "12 이하 번호 개수", sum: "번호 합계", consecutive: "연속 번호 쌍",
  same_digit: "같은 끝자리 최대 개수", mult7: "7의 배수 개수",
};

export function ballClass(n) {
  return `b${Math.min(5, Math.floor((n - 1) / 10) + 1)}`;
}

const balls = (numbers, label) => `<ul class="balls" aria-label="${esc(label)}">${numbers.map((n) => `<li class="ball ${ballClass(n)}">${n}</li>`).join("")}</ul>`;

function table(caption, headers, rows) {
  const id = `t-${caption.replace(/[^가-힣a-zA-Z0-9]/g, "").slice(0, 24)}`;
  return `<div class="table-wrap" tabindex="0" role="region" aria-labelledby="${id}"><table><caption id="${id}">${esc(caption)}</caption><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, i) => (i === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function study({ title, question, formula, where, values, chart, conclusion, open = false }) {
  return `<details class="study"${open ? " open" : ""}><summary>${esc(title)}</summary><div class="study-body">
    <p class="label">무엇을 확인했나요?</p><p>${question}</p>
    ${formula ? `<p class="label">사용한 공식</p>${formula}${where ? `<p class="where">${where}</p>` : ""}` : ""}
    ${values ? `<p class="label">계산 결과</p>${values}` : ""}
    ${chart ?? ""}
    <p class="label">결론</p><p class="conclusion">${conclusion}</p>
  </div></details>`;
}

function barChart(counts, expected, label) {
  const values = Array.from({ length: 45 }, (_, i) => counts[String(i + 1)]);
  const max = Math.max(...values, expected) * 1.05;
  const height = 140;
  const width = 450;
  const y = (v) => height - (v / max) * height;
  const bars = values.map((v, i) => `<rect class="bar" x="${i * 10 + 1}" y="${y(v).toFixed(1)}" width="8" height="${(height - y(v)).toFixed(1)}"/>`).join("");
  const ticks = [1, 10, 20, 30, 40, 45].map((v) => `<text x="${(v - 1) * 10 + 5}" y="${height + 18}" text-anchor="middle">${v}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height + 22}" role="img" aria-label="${esc(label)}">${bars}<line class="mark" x1="0" x2="${width}" y1="${y(expected).toFixed(1)}" y2="${y(expected).toFixed(1)}"/>${ticks}</svg><p class="where">막대는 번호별 실제 횟수, 가로선은 기대값입니다.</p>`;
}

const noBias = (p) => (p >= 0.05 ? "치우침을 찾지 못했습니다." : "이번 검정에서 눈에 띄는 차이가 나와 추가 검토가 필요합니다. 검정을 여러 번 하면 우연으로도 이런 결과가 나올 수 있습니다.");

// Times arrive as written in Korea time, so reading the text avoids any device time zone.
function koreanTime(iso) {
  const [hour, minute] = iso.slice(11, 16).split(":").map(Number);
  const period = hour < 12 ? "오전" : "오후";
  return `토요일 ${period} ${hour % 12 || 12}시${minute ? ` ${minute}분` : ""}`;
}

export function roundLabel(report) {
  const [, month, day] = report.schedule.date.split("-").map(Number);
  return `제${report.generated_for_round}회 · ${month}월 ${day}일 토요일 추첨`;
}

export function renderCountdown(state, schedule, format) {
  if (state.phase === "pending") {
    return `<p class="clock-label">추첨 결과 반영 중</p><p>새 결과가 들어오면 다음 회차 번호로 바뀝니다. 아래 번호는 지난 회차용입니다.</p>`;
  }
  const clock = (label, ms) => `<div class="clock"><span class="clock-label">${label}</span><span class="clock-time">${format(ms)}</span></div>`;
  return `${state.phase === "before_deadline" ? clock(`구매 마감까지 (${koreanTime(schedule.deadline_at)})`, state.toDeadline) : `<div class="clock"><span class="clock-label">구매가 마감되었습니다</span></div>`}
    ${clock(`추첨까지 (${koreanTime(schedule.draw_at)})`, state.toDraw)}
    <p class="clock-note">${schedule.overridden ? "이번 회차는 방송 사정으로 시간이 조정되었습니다." : "방송 사정에 따라 추첨 시간이 달라질 수 있습니다."}</p>`;
}

export function renderRecommendation(report) {
  const { selection } = report;
  const fallback = selection.method !== "model";
  const cards = selection.sets.map((set, i) => `<article class="card set${i === 0 ? " main" : ""}">
    <p class="set-title">${i === 0 ? "이번 주 대표 번호" : `추가 번호 ${i}`}</p>
    ${balls(set.numbers, i === 0 ? "대표 번호" : `추가 번호 ${i}`)}
    <ul class="why">${set.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
  </article>`).join("");
  const purpose = fallback
    ? `널리 알려진 규칙에 따라 남들이 덜 고를 듯한 조합을 고른 것이며, 나눠 가질 사람이 실제로 줄어드는지는 확인되지 않았습니다.`
    : `당첨되었을 때 다른 사람과 나눌 가능성을 줄이기 위한 추천입니다.`;
  const f = report.forecast;
  const later = f.track_record.later;
  return `<div class="notice"><b>1등 확률은 어떤 번호든 ${ODDS}로 같습니다.</b> ${purpose} '대표'는 먼저 보여주는 번호라는 뜻일 뿐입니다.</div>
    ${cards}
    <div class="notice">5세트는 골라 보시라고 드리는 것이며, 더 사는 것을 권하지 않습니다. 같은 회차에는 사이트 이용자 모두 같은 번호를 받으므로, 당첨되면 이용자끼리 나눌 수 있습니다.</div>
    <h2>과거 번호로 예상한 번호</h2>
    <article class="card set">
      <p class="set-title">과거 번호의 흐름을 공식으로 옮긴 결과</p>
      ${balls(f.numbers, "과거 번호 기반 예상 번호")}
      <p>직전 회차 번호는 빼고, 최근에 나왔던 번호를 고르는 공식입니다.</p>
      <p><b>${later.mean_hits > 0.8 && later.p < 0.05 ? "효과 여부를 검토 중입니다." : "맞히는 효과는 확인되지 않았습니다."}</b> 공식을 고를 때 쓰지 않은 이후 ${num(later.rounds[1] - later.rounds[0] + 1)}회에서 평균 ${num(later.mean_hits, 2)}개를 맞혔습니다. 무작위 기대값은 0.80개입니다. 1등 확률도 ${ODDS}로 같습니다.</p>
    </article>`;
}

function selectionStudy(r) {
  const s = r.selection;
  const model = s.method === "model";
  const funnel = `<ul class="funnel">${s.funnel.map((step) => `<li><span>${esc(step.step)}</span><b>${num(step.remaining)}개</b></li>`).join("")}</ul>`;
  const betaRows = Object.entries(s.beta).map(([k, v]) => [FEATURE_NAMES[k], num(v, 3)]);
  const rows = s.sets.map((set, i) => {
    const c = set.expected_cowinners;
    return [`${i === 0 ? "대표" : `추가 ${i}`}: ${set.numbers.join(", ")}`, num(set.score, 3), `${num(set.percentile, 2)}%`,
      c ? `${num(c.estimate, 1)}명 (${num(c.low, 1)}~${num(c.high, 1)})` : "표시 안 함"];
  });
  return study({
    title: "이번 번호가 나온 과정", open: true,
    question: `전체 ${num(s.funnel[0].remaining)}개 조합을 단계별로 줄인 뒤, 마지막 단계에서 회차 번호로 5세트를 고정했습니다.`,
    formula: F.score + F.hash,
    where: `s(c)는 인기 점수로, 낮을수록 사람들이 덜 고를 것으로 추정한 조합입니다. z는 전체 조합 기준으로 표준화한 값입니다. 마지막 단계는 해시 값 순서대로 고르되 겹치는 번호가 2개를 넘으면 건너뜁니다.`,
    values: `${funnel}${table(model ? "데이터로 추정한 가중치" : "대체 방식의 가중치 (가정한 값)", ["항목", "가중치"], betaRows)}${table("추천 5세트의 점수", ["번호", "인기 점수", "하위 위치", "나 외 예상 당첨자"], rows)}`,
    conclusion: `마지막 5세트는 분석이 지목한 번호가 아니라, 낮은 인기 구간 안에서 회차 번호로 정한 고정 규칙의 결과입니다. 1등 확률은 ${ODDS}입니다.`,
  });
}

function randomnessStudies(r) {
  const x = r.randomness;
  const pn = x.per_number;
  return [
    study({
      title: "번호가 고르게 나왔나요?",
      question: `1회부터 ${num(x.rounds)}회까지 1번~45번이 얼마나 고르게 나왔는지 확인했습니다.`,
      formula: F.chi2,
      where: `O는 실제 횟수, E는 기대 횟수(${num(x.uniformity.expected_count, 1)}회)입니다. 한 회차 안의 번호는 서로 독립이 아니므로 p값은 공정한 추첨을 ${num(x.uniformity.sims)}번 모의해서 구했습니다.`,
      values: `<p>카이제곱 ${num(x.uniformity.chi2, 2)}, 공정한 추첨의 평균 ${num(x.uniformity.null_mean, 2)}, p값 ${pv(x.uniformity.p)}</p>`,
      chart: barChart(pn.counts, pn.expected, `번호별 출현 횟수. 가장 많은 번호 ${pn.most}번, 가장 적은 번호 ${pn.least}번`),
      conclusion: noBias(x.uniformity.p),
    }),
    study({
      title: "2등의 보너스 번호도 고르게 나왔나요?",
      question: "2등 당첨을 가르는 보너스 번호에 치우침이 있는지 같은 방법으로 확인했습니다.",
      formula: F.chi2,
      values: `<p>카이제곱 ${num(x.bonus.chi2, 2)}, 기대 횟수 ${num(x.bonus.expected_count, 1)}회, p값 ${pv(x.bonus.p)}</p>`,
      chart: barChart(x.bonus.counts, x.bonus.expected_count, "보너스 번호별 출현 횟수"),
      conclusion: noBias(x.bonus.p),
    }),
    study({
      title: "특정 번호만 많거나 적게 나왔나요?",
      question: "45개 번호를 하나씩 검정했습니다. 여러 번 검정하면 우연히 튀는 결과가 생기므로 Benjamini-Hochberg 방법으로 보정했습니다.",
      formula: F.z,
      values: `<p>가장 치우친 번호 ${pn.min_p_number}번: 보정 전 p값 ${pv(pn.min_p)}, 보정 후 ${pv(pn.min_q)}</p><p>보정 후 유의한 번호: ${pn.significant.length ? pn.significant.join(", ") : "없음"}</p><p>가장 많이 나온 6개는 ${x.hot_six.numbers.join(", ")}입니다. 그대로 믿으면 ${num(x.hot_six.face_value_multiplier, 2)}배 유리해 보이지만, 공정한 가상 추첨에서도 평균 ${num(x.hot_six.chance_mean_multiplier, 2)}배로 보입니다.</p>`,
      conclusion: pn.significant.length ? "일부 번호에 차이가 있어 추가 검토가 필요합니다." : "많이 나온 번호와 적게 나온 번호의 차이는 우연으로 설명됩니다.",
    }),
    study({
      title: "숨어 있는 치우침은 얼마나 될까요?",
      question: "관측된 차이 중 우연을 빼고 남는 부분을 계산했습니다.",
      formula: F.shrink,
      where: "k가 0이면 번호 간 차이가 우연보다 크지 않다는 뜻입니다.",
      values: `<p>관측 ${num(x.shrinkage.ss_observed, 1)}, 우연 기대값 ${num(x.shrinkage.ss_chance, 1)}, k = ${num(x.shrinkage.k, 3)}</p><p>반영 기준: ${r.bias_rule.passed ? "통과" : "미통과"} (전체 검정, 개별 검정, 과거 회차 시험, k 모두 통과해야 합니다.)</p>`,
      conclusion: r.bias_rule.passed ? "기준을 통과해 검토가 필요합니다. 점수에는 사람이 검토한 뒤에만 반영합니다." : "치우침을 찾지 못해 번호 선택으로 1등 확률을 높이지 못했습니다.",
    }),
    study({
      title: "시기별로 치우침이 있었나요?",
      question: "전체 회차를 4구간으로 나누어 특정 시기에만 치우침이 있었는지 확인했습니다.",
      formula: F.chi2,
      values: table("구간별 검정", ["구간", "카이제곱", "p값"], x.eras.eras.map((e) => [`${e.rounds[0]}~${e.rounds[1]}회`, num(e.chi2, 2), pv(e.p)])),
      conclusion: x.eras.min_p_bonferroni >= 0.05 ? "어느 구간에서도 뚜렷한 치우침을 찾지 못했습니다." : "일부 구간에 차이가 있어 추가 검토가 필요합니다.",
    }),
    study({
      title: "지난 회차가 다음 회차에 영향을 주나요?",
      question: "연속한 회차 사이에 겹치는 번호 수가 이론값과 같은지, 나온 순서에 규칙이 있는지 확인했습니다.",
      formula: F.overlap,
      values: table("직전 회차와 겹친 번호 수", ["겹친 개수", "실제", "기대값"], x.serial.last_draw_table.map((row) => [`${row.overlap}개`, num(row.observed), num(row.expected, 1)])) +
        table("몇 회 전까지 비교", ["비교 간격", "평균 겹침", "p값"], x.serial.lags.map((row) => [`${row.lag}회 전`, num(row.mean, 3), pv(row.p)])) +
        `<p>순서 검정(Wald-Wolfowitz): 보정 후 최소 값 ${pv(x.runs.min_q)}, 유의한 번호 ${x.runs.significant.length}개</p>`,
      conclusion: x.serial.min_p_bonferroni >= 0.05 && !x.runs.significant.length ? "지난 회차와 다음 회차 사이의 관련성을 찾지 못했습니다." : "일부 결과에 차이가 있어 추가 검토가 필요합니다.",
    }),
    study({
      title: "오래 안 나온 번호가 곧 나오나요?",
      question: "한 번호가 다시 나오기까지 걸린 간격을 이론 분포와 비교했습니다.",
      formula: F.gap,
      values: `<p>평균 간격 ${num(x.gaps.observed_mean, 2)}회, 이론값 ${num(x.gaps.theory_mean, 2)}회, p값 ${pv(x.gaps.p)}</p>`,
      conclusion: x.gaps.p >= 0.05 ? "오래 안 나왔다고 더 잘 나온다는 근거를 찾지 못했습니다." : "간격 분포에 차이가 있어 추가 검토가 필요합니다.",
    }),
    study({
      title: "함께 자주 나오는 번호가 있나요?",
      question: "가능한 번호 쌍 990개 중 가장 많이 함께 나온 쌍이 우연의 범위인지 확인했습니다.",
      formula: F.pairs,
      values: `<p>최다 ${x.pairs.pair.join("번과 ")}번: ${x.pairs.count}회, 쌍별 기대값 ${num(x.pairs.expected, 1)}회, p값 ${pv(x.pairs.p)}</p>`,
      conclusion: x.pairs.p >= 0.05 ? "함께 많이 나온 쌍은 우연으로 설명됩니다." : "우연으로 보기 어려운 쌍이 있어 추가 검토가 필요합니다.",
    }),
    study({
      title: "합계, 홀짝, 연속 번호에 규칙이 있나요?",
      question: `전체 조합을 모두 세어 얻은 정확한 이론 분포와 실제 당첨 조합을 비교했습니다.`,
      formula: F.chi2,
      values: table("조합 형태 검정", ["항목", "카이제곱", "자유도", "p값"], [["홀수 개수", "odd"], ["22 이하 번호 개수", "low"], ["연속 번호 쌍", "consecutive"], ["합계 구간", "sum_band"]].map(([label, key]) => [label, num(x.shape.tests[key].chi2, 2), x.shape.tests[key].df, pv(x.shape.tests[key].p)])),
      conclusion: x.shape.min_p_bonferroni >= 0.05 ? "조합의 형태도 이론 분포와 차이가 없습니다." : "일부 형태에 차이가 있어 추가 검토가 필요합니다.",
    }),
  ].join("");
}

function strategyStudy(r) {
  const s = r.strategies;
  const rows = Object.entries(s.strategies).map(([k, v]) => [STRATEGY_NAMES[k] ?? k, num(v.mean_hits, 3), num(v.ge3), pv(v.p_bonferroni), num(v.jackpots)]);
  const best = Object.entries(s.multipliers).map(([k, v]) => [`반영 강도 ${k}`, num(v.multiplier, 4), `${num(v.ci95[0], 4)}~${num(v.ci95[1], 4)}`]);
  const none = Object.values(s.strategies).every((v) => v.p_bonferroni >= 0.05);
  return study({
    title: "사람들이 쓰는 전략이 통할까요?",
    question: `${s.first_round}회부터 각 회차를 그 이전 데이터만으로 예상해 보았습니다. 미래 데이터는 쓰지 않았습니다.`,
    formula: F.meanHits + F.multiplier,
    where: `배율은 모델이 실제 당첨 조합에 매긴 확률이 무작위의 몇 배인지를 뜻합니다. 3개 이상 맞힌 횟수의 기대값은 ${num(s.ge3_expected, 1)}회입니다.`,
    values: table("전략별 성적", ["전략", "평균 맞힌 개수", "3개 이상", "보정 p값", "1등"], rows) + table("과거 빈도를 반영했을 때의 배율", ["강도", "배율", "95% 구간"], best),
    conclusion: none ? "어떤 전략도 무작위보다 낫다고 할 수 없었습니다." : "일부 전략에 차이가 있어 추가 검토가 필요합니다.",
  });
}

function jackpotStudy(r) {
  const j = r.studies.until_jackpot;
  if (!j) return "";
  const rows = Object.entries(j.methods).map(([k, v]) => [STRATEGY_NAMES[k] ?? k, num(v.dev.mean), num(v.holdout.mean)]);
  const chosen = j.selected_on_dev;
  return study({
    title: "1등이 나올 때까지 사면 몇 번 걸릴까요?",
    question: `1회부터 ${num(j.draws)}회까지 회차마다 1등이 나올 때까지 시험했습니다. 전략은 앞쪽 절반으로 고르고 뒤쪽 절반으로 평가했습니다. (${num(j.draws)}회 기준 시험)`,
    formula: F.attempts,
    values: table("구매 방식별 평균", ["방식", "평균 횟수", "최대 횟수"], [
      ["무작위, 중복 허용", num(j.with_replacement.mean), num(j.with_replacement.worst)],
      ["무작위, 중복 없음", num(j.no_repeats.all.mean), num(j.no_repeats.all.worst)],
    ]) + table("전략별 평균 횟수", ["전략", "앞쪽 절반", "뒤쪽 절반"], rows) +
      `<p>정답 회차까지 일부러 학습시킨 대조 시험은 평균 약 ${num(j.controls.LEAK_hot_all.all.mean)}회로 줄었습니다. 즉 시험은 신호가 있으면 잡아내며, 정답을 미리 보면 숫자는 얼마든지 줄어듭니다.</p>`,
    conclusion: `중복을 없애면 평균 횟수가 절반으로 줄지만, 번호 전략으로는 더 줄이지 못했습니다. 앞쪽에서 고른 전략은 뒤쪽 절반에서 평균 ${num(chosen.holdout_mean)}회로, 이론값 ${num(j.theory_no_repeat_mean)}회보다 나아지지 않았습니다.`,
  });
}

function forecastStudy(r) {
  const f = r.forecast;
  const check = r.studies.check_1248;
  const context = r.studies.check_1248_context;
  const best = check ? Object.values(check.methods).reduce((a, b) => (a.hits.length >= b.hits.length ? a : b)) : null;
  return study({
    title: "과거 번호로 다음 번호를 예상할 수 있을까요?",
    question: "자주 나온 번호, 최근 흐름, 오래 안 나온 번호, 직전 회차, 함께 나온 번호를 점수로 합치는 공식을 시험했습니다. 가중치는 242가지 중 101~624회에서 가장 잘 맞은 것으로 고정했습니다.",
    formula: F.forecast,
    where: "z는 45개 번호 안에서 표준화한 값입니다. 다섯 항목 중 두 항목만 선택되었습니다.",
    values: table("공식의 성적", ["구간", "평균 맞힌 개수", "1등"], [
      [`${f.track_record.tuned.rounds[0]}~${f.track_record.tuned.rounds[1]}회 (공식을 고른 구간)`, num(f.track_record.tuned.mean_hits, 3), f.track_record.tuned.jackpots],
      [`${f.track_record.later.rounds[0]}~${f.track_record.later.rounds[1]}회 (이후 구간)`, num(f.track_record.later.mean_hits, 3), f.track_record.later.jackpots],
    ]) + (check ? `<p><b>${check.target.join(", ")} (제1248회) 재현 시험:</b> 그 전 회차까지의 데이터로 ${check.summary.tried}가지 방식을 돌려 보니 6개를 모두 맞힌 방식은 없었고, 최고는 ${check.summary.max_hits}개(${best.hits.join(", ")})였습니다.</p>` : "") +
      (context ? `<p>같은 방식들을 ${num(context.rounds_checked)}회에 적용하면 어느 한 방식이라도 4개 이상 맞힌 회차가 ${context.rounds_any_method_ge4}번 있습니다. 해당 방식은 전체에서 4개 이상을 ${context.hot_50.ge4}회 맞혀, 우연일 때의 기대값 ${num(context.hot_50.expected_ge4, 1)}회보다 많지 않았습니다.</p>` : ""),
    conclusion: f.track_record.later.mean_hits > 0.8 && f.track_record.later.p < 0.05
      ? "이후 구간에서 기대값과 차이가 나와 추가 검토가 필요합니다."
      : "공식을 고른 구간에서는 좋아 보여도 이후 구간에서는 이어지지 않았습니다. 데이터에 끼워 맞춘 결과로 보입니다.",
  });
}

function advancedStudy(r) {
  const a = r.studies.advanced;
  if (!a) return "";
  const rows = Object.entries(a.models).map(([k, v]) => [modelName(k), num(v.dev_multiplier, 4), num(v.test_multiplier, 4), `${num(v.test_ci95[0], 4)}~${num(v.test_ci95[1], 4)}`]);
  return study({
    title: "머신러닝을 쓰면 달라질까요?",
    question: `시간 가중 빈도, 베이즈 추정, 로지스틱 회귀, 랜덤 포레스트, 그래디언트 부스팅, 앙상블을 경쟁시켰습니다. 모델은 ${a.rounds_dev[0]}~${a.rounds_dev[1]}회로 고르고 ${a.rounds_test[0]}~${a.rounds_test[1]}회로 평가했습니다. (제${a.rounds_test[1]}회 기준 시험)`,
    formula: F.multiplier,
    where: "기준은 평가 구간의 95% 구간 전체가 1을 넘는 것입니다. 시험을 돌리기 전에 정했습니다.",
    values: table("모델별 배율", ["모델", "선정 구간", "평가 구간", "95% 구간"], rows) +
      `<p>대조 시험: 치우침을 심은 가상 데이터 ${num(a.control_planted_bias.test_multiplier, 4)}배(구간 ${num(a.control_planted_bias.test_ci95[0], 4)}~${num(a.control_planted_bias.test_ci95[1], 4)}), 공정한 가상 데이터 ${num(a.control_fair.test_multiplier, 4)}배.</p>`,
    conclusion: a.improved ? "기준을 통과한 모델이 있어 추가 검토가 필요합니다." : "기준을 통과한 모델이 없습니다. 복잡한 모델도 무작위보다 낫지 않았습니다.",
  });
}

function popularityStudy(r) {
  const p = r.popularity;
  const m = r.method;
  const ev = m.evidence;
  return study({
    title: "사람들이 몰리는 번호가 있나요?",
    question: `${p.first_round}회부터 판매량 대비 실제 1등 당첨자 수를 비교해, 어떤 조합에 사람이 몰리는지 추정했습니다. 1등 확률이 아니라 당첨금을 나눌 사람 수에 관한 분석입니다.`,
    formula: F.ratio + F.popularity,
    where: `W는 1등 수, G는 판매 게임 수, a는 어떤 조합이든 고르게 나오는 자동 구매 비율, q는 직접 고르는 사람들의 선호입니다.${p.auto_reported_share.share == null ? "" : ` 최근 1등 당첨자 중 자동 비율은 ${num(p.auto_reported_share.share * 100, 1)}%입니다.`}`,
    values: table("1~31 번호 개수별 당첨자 수", ["1~31 번호 개수", "회차", "실제 1등", "기대값", "비율"], p.birthday_table.map((row) => [row.band, num(row.rounds), num(row.winners), num(row.expected, 1), `${num(row.ratio, 2)}배`])) +
      (ev ? `<p>과거 데이터로 학습해 이후 회차를 평가했습니다(제${m.decided_through_round}회 기준). 판매량만 쓴 모델과 비교한 개선폭(이탈도)은 ${num(ev.gain_total, 1)}이고, 95% 구간은 ${num(ev.gain_ci95[0], 1)}~${num(ev.gain_ci95[1], 1)}입니다. 구간 전체가 0보다 커야 통과입니다.</p>` : ""),
    conclusion: m.method === "model"
      ? "검증을 통과해 추천 점수에 사용합니다. 다만 효과는 작고 추정 오차가 있습니다."
      : "이 데이터로는 인기 패턴을 충분히 확인하지 못해, 널리 알려진 규칙을 대체 방식으로 사용합니다. 예상 당첨자 수는 표시하지 않습니다.",
  });
}

function prizeStudy(r) {
  const p = r.prizes;
  return study({
    title: "등수별 확률과 돌려받는 금액",
    question: `정확한 확률을 계산하고, ${p.rounds[0]}회부터 실제 지급된 당첨금으로 1,000원당 평균 수령액을 구했습니다.`,
    formula: F.combos + F.tickets + F.returned,
    where: "k는 서로 다른 조합 수, W는 등수별 당첨자 수, A는 등수별 당첨금입니다. 세금 전 금액이며, 1등이 없어 이월된 경우는 반영하지 않았습니다.",
    values: table("등수별 확률", ["등수", "조건", "확률"], p.odds.map((o) => [`${o.rank}등`, o.condition, `1/${num(o.one_in)}`])) +
      table("구매 수별 1등 확률", ["구매 수", "비용", "1등 확률"], p.tickets.map((t) => [`${num(t.count)}세트`, won(t.cost), t.one_in <= 1 ? "확정" : `1/${num(t.one_in)}`])) +
      `<p>1,000원당 평균 수령액: 전체 ${num(p.mean_return_per_ticket)}원, 최근 52회 ${num(p.recent_52_return_per_ticket)}원. 최근 52회 1등 1인당 당첨금 중앙값: ${won(p.recent_52_median_first_prize)}.</p>`,
    conclusion: "1등 확률을 확실히 올리는 방법은 서로 다른 조합을 더 사는 것뿐이지만, 평균적으로 산 금액보다 적게 돌려받습니다. 더 사는 것을 권하지 않습니다.",
  });
}

export function renderAnalysis(r) {
  return `<h2>결론부터</h2>
    <p>전 회차를 시험한 결과, 번호를 고르는 방법으로 1등 확률을 높이지는 못했습니다. 어떤 조합이든 ${ODDS}입니다. 다만 아주 작은 치우침까지 없다고 증명한 것은 아닙니다.</p>
    <h2>번호 고르기</h2>${selectionStudy(r)}${popularityStudy(r)}
    <h2>추첨은 무작위인가요?</h2>${randomnessStudies(r)}
    <h2>전략과 예상 공식 시험</h2>${strategyStudy(r)}${forecastStudy(r)}${jackpotStudy(r)}${advancedStudy(r)}
    <h2>확률과 금액</h2>${prizeStudy(r)}`;
}

export function dataNote(r) {
  const source = r.data_source === "mirror" ? "공식 주소에 접속하지 못해 비공식 공개 자료 기준" : "동행복권 공개 자료 기준";
  const updated = r.generated_at ? ` 갱신: ${r.generated_at.slice(0, 10)}.` : "";
  return `데이터: 제${r.data_through_round}회(${r.data_through_date})까지, ${source}.${updated}`;
}

export function renderError() {
  return `<div class="notice" role="alert"><b>분석 결과를 불러오지 못했습니다.</b> 인터넷 연결을 확인한 뒤 화면을 새로고침해 주세요.</div>`;
}
