document.addEventListener("DOMContentLoaded", () => {
  const checkInEl = document.getElementById("checkIn");
  const checkOutEl = document.getElementById("checkOut");
  const summaryEl = document.getElementById("bookingSummary");

  if (!checkInEl || !checkOutEl || !summaryEl || typeof listing === "undefined") return;

  // Set sensible mins
  const todayIso = new Date().toISOString().slice(0, 10);
  checkInEl.min = todayIso;

  checkInEl.addEventListener("change", () => {
    if (checkInEl.value) {
      const d = new Date(checkInEl.value + "T12:00:00");
      const next = new Date(d.getTime() + 24 * 3600 * 1000);
      checkOutEl.min = next.toISOString().slice(0, 10);
      if (checkOutEl.value && checkOutEl.value < checkOutEl.min) {
        checkOutEl.value = "";
      }
    }
    render();
  });

  checkOutEl.addEventListener("change", render);

  function parseISODate(val) {
    // Use noon local time to avoid DST edge cases
    return val ? new Date(val + "T12:00:00") : null;
  }

  function formatINR(num) {
    return Number(num).toLocaleString("en-IN");
  }

  function nightsBetween(start, end) {
    const ms = end - start;
    return Math.floor(ms / (24 * 3600 * 1000));
  }

  function render() {
    const ci = parseISODate(checkInEl.value);
    const co = parseISODate(checkOutEl.value);

    if (!ci || !co) {
      summaryEl.innerHTML = '<div class="text-muted small">Select check-in and check-out to see the total.</div>';
      return;
    }

    const nights = Math.max(nightsBetween(ci, co), 0);
    if (nights <= 0) {
      summaryEl.innerHTML = '<div class="text-danger small">Check-out must be after check-in.</div>';
      return;
    }

    const perNight = Number(listing.price || 0);
    const total = perNight * nights;

    summaryEl.innerHTML = `
      <div class="d-flex justify-content-between align-items-center p-3 border rounded-3 bg-light">
        <div>
          <div class="fw-semibold">₹ ${formatINR(total)}</div>
          <div class="text-muted small">${nights} night${nights>1?"s":""} × ₹ ${formatINR(perNight)} / night</div>
        </div>
        <div class="h5 mb-0">Total</div>
      </div>
    `;
  }

  render();
});