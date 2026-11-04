// Formulas as MathML, which browsers draw natively with no extra script.
const m = (body) => `<div class="formula"><math display="block">${body}</math></div>`;
const i = (x) => `<mi>${x}</mi>`;
const n = (x) => `<mn>${x}</mn>`;
const o = (x) => `<mo>${x}</mo>`;
const frac = (a, b) => `<mfrac><mrow>${a}</mrow><mrow>${b}</mrow></mfrac>`;
const choose = (a, b) => `<mrow>${o("(")}<mfrac linethickness="0">${a}${b}</mfrac>${o(")")}</mrow>`;
const sub = (a, b) => `<msub>${a}${b}</msub>`;

export const FORMULAS = {
  combos: m(`${i("N")}${o("=")}${choose(n(45), n(6))}${o("=")}${frac(`${n(45)}${o("!")}`, `${n(6)}${o("!")}${n(39)}${o("!")}`)}${o("=")}${n("8,145,060")}`),
  chi2: m(`<msup>${i("χ")}${n(2)}</msup>${o("=")}<munderover>${o("∑")}<mrow>${i("i")}${o("=")}${n(1)}</mrow>${n(45)}</munderover>${frac(`<msup><mrow>${o("(")}${sub(i("O"), i("i"))}${o("−")}${i("E")}${o(")")}</mrow>${n(2)}</msup>`, i("E"))}`),
  z: m(`${i("z")}${o("=")}${frac(`${i("O")}${o("−")}${i("n")}${i("p")}`, `<msqrt>${i("n")}${i("p")}${o("(")}${n(1)}${o("−")}${i("p")}${o(")")}</msqrt>`)}${o(",")}<mspace width="0.5em"/>${i("p")}${o("=")}${frac(n(6), n(45))}`),
  overlap: m(`${i("P")}${o("(")}${i("k")}${o(")")}${o("=")}${frac(`${choose(n(6), i("k"))}${choose(n(39), `<mrow>${n(6)}${o("−")}${i("k")}</mrow>`)}`, choose(n(45), n(6)))}`),
  gap: m(`${i("P")}${o("(")}${i("g")}${o(")")}${o("=")}${i("p")}<msup><mrow>${o("(")}${n(1)}${o("−")}${i("p")}${o(")")}</mrow><mrow>${i("g")}${o("−")}${n(1)}</mrow></msup>`),
  pairs: m(`${i("E")}${o("=")}${i("n")}${frac(`${n(6)}${o("·")}${n(5)}`, `${n(45)}${o("·")}${n(44)}`)}`),
  meanHits: m(`${i("E")}${o("[")}${i("맞힌 개수")}${o("]")}${o("=")}${n(6)}${o("·")}${frac(n(6), n(45))}${o("=")}${n("0.8")}`),
  multiplier: m(`${i("배율")}${o("=")}<mi>exp</mi><mrow>${o("(")}${frac(n(1), i("T"))}<munder>${o("∑")}${i("t")}</munder><mi>log</mi>${frac(`${sub(i("P"), i("모델"))}${o("(")}${sub(i("c"), i("t"))}${o(")")}`, `${n(1)}${o("/")}${i("N")}`)}${o(")")}</mrow>`),
  shrink: m(`${i("k")}${o("=")}<mi>max</mi><mrow>${o("(")}${n(0)}${o(",")}${n(1)}${o("−")}${frac(`${n(45)}${i("n")}${i("p")}${o("(")}${n(1)}${o("−")}${i("p")}${o(")")}`, `${o("∑")}<msup><mrow>${o("(")}${sub(i("O"), i("i"))}${o("−")}${i("n")}${i("p")}${o(")")}</mrow>${n(2)}</msup>`)}${o(")")}</mrow>`),
  attempts: m(`${sub(i("E"), i("중복 허용"))}${o("=")}${i("N")}${o(",")}<mspace width="0.5em"/>${sub(i("E"), i("중복 없음"))}${o("=")}${frac(`${i("N")}${o("+")}${n(1)}`, n(2))}`),
  tickets: m(`${i("P")}${o("(")}${i("1등")}${o(")")}${o("=")}${frac(i("k"), i("N"))}`),
  forecast: m(`${sub(i("S"), i("i"))}${o("=")}${o("−")}${sub(i("z"), i("미출현 간격"))}${o("−")}${sub(i("z"), i("직전 회차"))}`),
  ratio: m(`${i("비율")}${o("=")}${frac(`${o("∑")}${sub(i("W"), i("t"))}`, `${o("∑")}${sub(i("G"), i("t"))}${o("/")}${i("N")}`)}`),
  popularity: m(`${sub(i("λ"), i("t"))}${o("=")}${sub(i("G"), i("t"))}<mrow>${o("[")}${frac(i("a"), i("N"))}${o("+")}${o("(")}${n(1)}${o("−")}${i("a")}${o(")")}${i("q")}${o("(")}${sub(i("c"), i("t"))}${o(")")}${o("]")}</mrow>`) +
    m(`${i("q")}${o("(")}${i("c")}${o(")")}${o("=")}${frac(`<mi>exp</mi>${o("(")}${i("β")}${o("·")}${i("f")}${o("(")}${i("c")}${o(")")}${o(")")}`, `<munder>${o("∑")}${i("d")}</munder><mi>exp</mi>${o("(")}${i("β")}${o("·")}${i("f")}${o("(")}${i("d")}${o(")")}${o(")")}`)}`),
  score: m(`${i("s")}${o("(")}${i("c")}${o(")")}${o("=")}<munder>${o("∑")}${i("j")}</munder>${sub(i("β"), i("j"))}${sub(i("z"), i("j"))}${o("(")}${i("c")}${o(")")}`),
  hash: m(`${i("순서")}${o("=")}<mi>SHA-256</mi>${o("(")}${i("회차")}${o("|")}${i("조합")}${o(")")}`),
  returned: m(`${i("평균 수령액")}${o("=")}${frac(`<munderover>${o("∑")}${n("r=1")}${n(5)}</munderover>${sub(i("W"), i("r"))}${sub(i("A"), i("r"))}`, `${i("판매액")}${o("/")}${n("1,000")}`)}`),
};
