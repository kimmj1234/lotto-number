import { countdown, formatRemaining } from "./countdown.js";
import { dataNote, renderAnalysis, renderCountdown, renderError, renderRecommendation, roundLabel } from "./render.js";

const $ = (id) => document.getElementById(id);

function startClock(schedule) {
  const tick = () => {
    const state = countdown(Date.now(), schedule);
    $("countdown").innerHTML = renderCountdown(state, schedule, formatRemaining);
    return state.phase;
  };
  if (tick() !== "pending") {
    const timer = setInterval(() => {
      if (tick() === "pending") clearInterval(timer);
    }, 1000);
  }
}

async function main() {
  let report;
  try {
    const response = await fetch("data/report.json");
    if (!response.ok) throw new Error(String(response.status));
    report = await response.json();
    $("round-label").textContent = roundLabel(report);
    $("data-note").textContent = dataNote(report);
    startClock(report.schedule);
  } catch {
    $("round-label").textContent = "";
    $("countdown").hidden = true;
    $("result").innerHTML = renderError();
    return;
  }

  const button = $("draw");
  button.disabled = false;
  button.addEventListener("click", () => {
    $("result").innerHTML = renderRecommendation(report);
    $("result").focus();
    button.textContent = "번호 다시 보기";
  });

  // The long analysis is built only when someone opens it.
  $("analysis-box").addEventListener("toggle", (event) => {
    if (event.target.open && !$("analysis").hasChildNodes()) $("analysis").innerHTML = renderAnalysis(report);
  });
}

main();
