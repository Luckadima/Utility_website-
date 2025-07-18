// static/js/utilityStatus.js

 async function fetchLoadshedding() {
  const infoEl = document.getElementById('loadshedding-info');
  try {
    const res = await fetch('/api/loadshedding');
    const stageVal = await res.text();
    const stageNum = parseInt(stageVal, 10);

    if (isNaN(stageNum)) throw new Error(`Unexpected response: ${stageVal}`);

    if (stageNum <= 1) {
      infoEl.textContent = '✅ No load‑shedding now';
    } else {
      infoEl.textContent = `⚡ Load‑shedding Stage ${stageNum - 1} ACTIVE now`;
    }
  } catch (err) {
    console.error('Load-shedding fetch error:', err);
    infoEl.textContent = '❗Error retrieving load-shedding data';
  }
}

// async function fetchWaterOutage() {
//   const infoEl = document.getElementById('water-outage-info');
//   try {
//     const res = await fetch('/api/waterstatus');
//     const text = await res.text();
//     infoEl.textContent = text || 'No current outage updates';
//   } catch (e) {
//     console.error('Water outage fetch error:', e);
//     infoEl.textContent = '❗Error retrieving water status';
//   }
// }

window.addEventListener('DOMContentLoaded', () => {
  fetchLoadshedding();
  setInterval(fetchLoadshedding, 5 * 60 * 1000);

  fetchWaterOutage();
  setInterval(fetchWaterOutage, 15 * 60 * 1000);
});




