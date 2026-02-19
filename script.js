/* script.js */
(() => {
  "use strict";

  // ✅ Change this to your actual JSON filename/path
  const DATA_URL = "ramadan_1447_2026_sahri_iftar_by_division_district.json";

  // Optional PDF download link (set to "" to disable button)
  const PDF_URL = ""; // e.g. "ramadan_calendar_2026.pdf"

  // ✅ localStorage keys (remember selection)
  const LS_DIV = "ramadan_selected_division";
  const LS_DIST_MAP = "ramadan_selected_district_map";

  const $ = (id) => document.getElementById(id);

  const els = {
    division: $("division"),
    district: $("district"),

    todayDate: $("todayDate"),
    ramadanDay: $("ramadanDay"),
    sehriTime: $("sehriTime"),
    iftarTime: $("iftarTime"),

    sehriCountdown: $("sehriCountdown"),
    iftarCountdown: $("iftarCountdown"),

    selectedYear: $("selectedYear"),
    selectedDivision: $("selectedDivision"),
    selectedDistrict: $("selectedDistrict"),

    rahmahBody: $("rahmahBody"),
    maghfirahBody: $("maghfirahBody"),
    najahBody: $("najahBody"),

    footerYear: $("footerYear"),
    downloadPDF: $("downloadPDF"),
  };

  const BD_TZ_OFFSET = "+06:00"; // Bangladesh time offset
  const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
  const DATE_FMT_BD = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Dhaka",
  });

  let db = null;
  let countdownTimer = null;

  // -------------------------
  // Helpers
  // -------------------------
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function getBDNow() {
    // reliable current time in Asia/Dhaka
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  }

  function getTodayISO_BD() {
    const bdNow = getBDNow();
    const y = bdNow.getFullYear();
    const m = pad2(bdNow.getMonth() + 1);
    const d = pad2(bdNow.getDate());
    return `${y}-${m}-${d}`;
  }

  function parseBDDateTime(isoDateYYYYMMDD, hhmm) {
    // Example: "2026-02-19T05:09:00+06:00"
    return new Date(`${isoDateYYYYMMDD}T${hhmm}:00${BD_TZ_OFFSET}`);
  }

  function parseBDDateOnly(isoDateYYYYMMDD) {
    return new Date(`${isoDateYYYYMMDD}T00:00:00${BD_TZ_OFFSET}`);
  }

  function formatCountdown(ms) {
    if (ms <= 0) return "00:00:00";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }

  // ✅ 12-hour format display
  function to12Hour(time24) {
    // accepts "HH:MM" (e.g. "05:09", "18:12")
    if (!time24 || typeof time24 !== "string") return "--:--";
    const [hhStr, mmStr] = time24.split(":");
    const hh = parseInt(hhStr, 10);
    const mm = parseInt(mmStr, 10);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return time24;

    const ampm = hh >= 12 ? "PM" : "AM";
    const hour12 = (hh % 12) === 0 ? 12 : (hh % 12);
    return `${hour12}:${String(mm).padStart(2, "0")} ${ampm}`;
  }

  // localStorage helpers
  function loadDistrictMap() {
    try {
      return JSON.parse(localStorage.getItem(LS_DIST_MAP) || "{}");
    } catch {
      return {};
    }
  }
  function saveDistrictMap(map) {
    localStorage.setItem(LS_DIST_MAP, JSON.stringify(map));
  }

  // -------------------------
  // Dropdown helpers
  // -------------------------
  function setOptions(selectEl, items, placeholder) {
    selectEl.innerHTML = "";

    if (placeholder) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = placeholder;
      opt.disabled = true;
      opt.selected = true;
      selectEl.appendChild(opt);
    }

    for (const name of items) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      selectEl.appendChild(opt);
    }
  }

  function getDivisions() {
    return Object.keys(db.data || {}).sort((a, b) => a.localeCompare(b));
  }

  function getDistricts(divisionName) {
    const div = (db.data && db.data[divisionName]) || {};
    return Object.keys(div).sort((a, b) => a.localeCompare(b));
  }

  function getSchedule(divisionName, districtName) {
    const arr = db.data?.[divisionName]?.[districtName];
    return Array.isArray(arr) ? arr : [];
  }

  // -------------------------
  // UI rendering
  // -------------------------
  function updateSummary(divisionName, districtName) {
    els.selectedYear.textContent = "2026";
    els.selectedDivision.textContent = divisionName || "--";
    els.selectedDistrict.textContent = districtName || "--";
  }

  function fillTableBody(tbody, rows) {
    tbody.innerHTML = "";
    const frag = document.createDocumentFragment();

    for (const r of rows) {
      const dateObj = parseBDDateOnly(r.date);
      const weekday = WEEKDAY_FMT.format(dateObj);
      const dateLabel = dateObj.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.ramadan_day}</td>
        <td>${dateLabel}</td>
        <td>${weekday}</td>
        <td>${to12Hour(r.sahri_end)}</td>
        <td>${to12Hour(r.iftar)}</td>
      `;
      frag.appendChild(tr);
    }

    tbody.appendChild(frag);
  }

  function renderTables(schedule) {
    const rahmah = schedule.filter((d) => d.ramadan_day >= 1 && d.ramadan_day <= 10);
    const maghfirah = schedule.filter((d) => d.ramadan_day >= 11 && d.ramadan_day <= 20);
    const najah = schedule.filter((d) => d.ramadan_day >= 21 && d.ramadan_day <= 30);

    fillTableBody(els.rahmahBody, rahmah);
    fillTableBody(els.maghfirahBody, maghfirah);
    fillTableBody(els.najahBody, najah);
  }

  function updateTodayOverview(schedule) {
    const bdNow = getBDNow();
    els.todayDate.textContent = `📅 Today: ${DATE_FMT_BD.format(bdNow)}`;

    const todayISO = getTodayISO_BD();
    const todayRow = schedule.find((x) => x.date === todayISO);

    if (!todayRow) {
      els.ramadanDay.textContent = `🕌 Ramadan Day: --`;
      els.sehriTime.textContent = `🌙 Sehri: --:--`;
      els.iftarTime.textContent = `🌅 Iftar: --:--`;
      els.sehriCountdown.textContent = `🌙 Sehri Countdown: Ramadan Not Active`;
      els.iftarCountdown.textContent = `🌅 Iftar Countdown: Ramadan Not Active`;
      return;
    }

    els.ramadanDay.textContent = `🕌 Ramadan Day: ${todayRow.ramadan_day}`;
    els.sehriTime.textContent = `🌙 Sehri: ${to12Hour(todayRow.sahri_end)}`;
    els.iftarTime.textContent = `🌅 Iftar: ${to12Hour(todayRow.iftar)}`;
  }

  function startCountdown(schedule) {
    if (countdownTimer) clearInterval(countdownTimer);

    countdownTimer = setInterval(() => {
      const bdNow = getBDNow();
      const todayISO = getTodayISO_BD();

      const idx = schedule.findIndex((x) => x.date === todayISO);
      if (idx === -1) {
        els.sehriCountdown.textContent = `🌙 Sehri Countdown: Ramadan Not Active`;
        els.iftarCountdown.textContent = `🌅 Iftar Countdown: Ramadan Not Active`;
        return;
      }

      const today = schedule[idx];
      const sehriDT = parseBDDateTime(today.date, today.sahri_end);
      const iftarDT = parseBDDateTime(today.date, today.iftar);

      if (bdNow < sehriDT) {
        els.sehriCountdown.textContent = `🌙 Sehri Countdown: ${formatCountdown(sehriDT - bdNow)}`;
        els.iftarCountdown.textContent = `🌅 Iftar Countdown: ${formatCountdown(iftarDT - bdNow)}`;
        return;
      }

      if (bdNow >= sehriDT && bdNow < iftarDT) {
        els.sehriCountdown.textContent = `🌙 Sehri Countdown: Passed`;
        els.iftarCountdown.textContent = `🌅 Iftar Countdown: ${formatCountdown(iftarDT - bdNow)}`;
        return;
      }

      const next = schedule[idx + 1];
      if (!next) {
        els.sehriCountdown.textContent = `🌙 Sehri Countdown: Ramadan ended`;
        els.iftarCountdown.textContent = `🌅 Iftar Countdown: Ramadan ended`;
        return;
      }

      const nextSehriDT = parseBDDateTime(next.date, next.sahri_end);
      const nextIftarDT = parseBDDateTime(next.date, next.iftar);

      els.sehriCountdown.textContent = `🌙 Sehri Countdown (Tomorrow): ${formatCountdown(nextSehriDT - bdNow)}`;
      els.iftarCountdown.textContent = `🌅 Iftar Countdown (Tomorrow): ${formatCountdown(nextIftarDT - bdNow)}`;
    }, 1000);
  }

  // -------------------------
  // Selection logic (FIXED)
  // -------------------------
  function onSelectionChange() {
    const divisionName = els.division.value;
    const districtName = els.district.value;

    updateSummary(divisionName, districtName);

    if (!divisionName || !districtName) {
      renderTables([]);
      els.ramadanDay.textContent = `🕌 Ramadan Day: --`;
      els.sehriTime.textContent = `🌙 Sehri: --:--`;
      els.iftarTime.textContent = `🌅 Iftar: --:--`;
      els.sehriCountdown.textContent = `🌙 Sehri Countdown: Select district`;
      els.iftarCountdown.textContent = `🌅 Iftar Countdown: Select district`;
      return;
    }

    const schedule = getSchedule(divisionName, districtName);
    renderTables(schedule);
    updateTodayOverview(schedule);
    startCountdown(schedule);
  }

  function populateDistricts(divisionName) {
    const districts = getDistricts(divisionName);
    setOptions(els.district, districts, "Select a District");

    // ✅ Restore last chosen district for this division
    const map = loadDistrictMap();
    const savedDistrict = map[divisionName];

    if (savedDistrict && districts.includes(savedDistrict)) {
      els.district.value = savedDistrict;
    } else if (districts.length) {
      // ✅ For new divisions (no saved yet), pick first district (you can change this behavior)
      els.district.value = districts[0];
    }

    onSelectionChange();
  }

  // -------------------------
  // Init
  // -------------------------
  async function init() {
    els.footerYear.textContent = String(new Date().getFullYear());

    if (PDF_URL) {
      els.downloadPDF.addEventListener("click", () =>
        window.open(PDF_URL, "_blank", "noopener,noreferrer")
      );
    } else {
      els.downloadPDF.style.display = "none";
    }

    // Load JSON
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load JSON: ${res.status} ${res.statusText}`);
    db = await res.json();

    // Fill divisions
    const divisions = getDivisions();
    setOptions(els.division, divisions, "Select a Division");

    // ✅ Restore saved division if available
    const savedDiv = localStorage.getItem(LS_DIV);
    if (savedDiv && divisions.includes(savedDiv)) {
      els.division.value = savedDiv;
      populateDistricts(savedDiv);
    } else if (divisions.length) {
      // default first time only
      els.division.value = divisions[0];
      populateDistricts(divisions[0]);
    }

    // When division changes
    els.division.addEventListener("change", () => {
      const divisionName = els.division.value;
      localStorage.setItem(LS_DIV, divisionName);
      populateDistricts(divisionName);
    });

    // When district changes (save per division)
    els.district.addEventListener("change", () => {
      const divisionName = els.division.value;
      const districtName = els.district.value;

      if (divisionName && districtName) {
        const map = loadDistrictMap();
        map[divisionName] = districtName;
        saveDistrictMap(map);
      }

      onSelectionChange();
    });
  }

  init().catch((err) => {
    console.error(err);
    if (els.sehriCountdown) els.sehriCountdown.textContent = "🌙 Sehri Countdown: Error loading data";
    if (els.iftarCountdown) els.iftarCountdown.textContent = "🌅 Iftar Countdown: Error loading data";
  });
})();
