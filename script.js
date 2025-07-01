// === Firebase Setup ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyApjRURrtUnFHilXvutv5gNI5PXhYKsC7E",
  authDomain: "auth-8c049.firebaseapp.com",
  projectId: "auth-8c049",
  storageBucket: "auth-8c049.appspot.com",
  messagingSenderId: "251151001451",
  appId: "1:251151001451:web:11a27f6679b70f24fe4e2e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// === Global Sync Helpers ===
async function saveUserData(uid) {
  await setDoc(doc(db, "users", uid), {
    activities: JSON.parse(localStorage.getItem("activities") || "[]"),
    tasks: JSON.parse(localStorage.getItem("tasks") || "{}")
  }, { merge: true });
}

async function loadUserData(uid) {
  const userDocRef = doc(db, "users", uid);
  const snap = await getDoc(userDocRef);
  const remoteData = snap.exists() ? snap.data() : { activities: [], tasks: {} };

  const localActivities = JSON.parse(localStorage.getItem("activities") || "[]");
  const localTasks = JSON.parse(localStorage.getItem("tasks") || "{}");

  const mergedActivities = [...remoteData.activities, ...localActivities];
  const mergedTasks = { ...remoteData.tasks, ...localTasks };

  localStorage.setItem("activities", JSON.stringify(mergedActivities));
  localStorage.setItem("tasks", JSON.stringify(mergedTasks));

  updateCharts();
  renderTasks();
}

let unsubscribeListener = null;
function listenToUserData(uid) {
  if (unsubscribeListener) unsubscribeListener();
  const userRef = doc(db, "users", uid);
  unsubscribeListener = onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      localStorage.setItem("activities", JSON.stringify(data.activities || []));
      localStorage.setItem("tasks", JSON.stringify(data.tasks || {}));
      updateCharts();
      renderTasks();
    }
  });
}

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    document.getElementById("auth-buttons").style.display = "none";
    document.getElementById("profile-section").style.display = "flex";
    document.getElementById("profile-initial").textContent = (user.displayName || user.email).charAt(0).toUpperCase();

    await loadUserData(user.uid);
    listenToUserData(user.uid);
  } else {
    currentUser = null;
    document.getElementById("auth-buttons").style.display = "flex";
    document.getElementById("profile-section").style.display = "none";
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  if (currentUser) {
    await saveUserData(currentUser.uid);
    await signOut(auth);
    localStorage.clear();
    window.location.href = "authhSignIn.html";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const themeToggleButton = document.getElementById("theme-toggle");
  const body = document.body;
  const savedTheme = localStorage.getItem("theme") || "light";
  body.setAttribute("data-theme", savedTheme);
  themeToggleButton.textContent = savedTheme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode";

  themeToggleButton.addEventListener("click", () => {
    const newTheme = body.getAttribute("data-theme") === "light" ? "dark" : "light";
    body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    themeToggleButton.textContent = newTheme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode";
  });

  updateTimeDisplay();
  renderTasks();
  updateCharts();
});

const dateInput = document.getElementById("date");
const today = new Date();
today.setMinutes(today.getMinutes() + 330);
const formattedToday = today.toISOString().split("T")[0];
if (dateInput) dateInput.value = formattedToday;

document.getElementById("activity-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const { activity, duration, date } = e.target;
  const activities = JSON.parse(localStorage.getItem("activities") || "[]");
  activities.push({ activity: activity.value, duration: +duration.value, date: date.value });
  localStorage.setItem("activities", JSON.stringify(activities));
  updateCharts();
  e.target.reset();
  if (dateInput) dateInput.value = formattedToday;
  if (currentUser) await saveUserData(currentUser.uid);
});

function getCurrentDateString() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" });
}

function addTask() {
  const input = document.getElementById("taskInput");
  const taskText = input.value.trim();
  if (!taskText) return alert("Please enter a task.");
  const dateStr = getCurrentDateString();
  const tasks = JSON.parse(localStorage.getItem("tasks") || "{}");
  if (!tasks[dateStr]) tasks[dateStr] = [];
  tasks[dateStr].push({ text: taskText, date: dateStr, completed: false });
  localStorage.setItem("tasks", JSON.stringify(tasks));
  renderTasks();
  input.value = "";
  if (currentUser) saveUserData(currentUser.uid);
}

function toggleTask(date, index) {
  const tasks = JSON.parse(localStorage.getItem("tasks") || "{}");
  if (tasks[date]) {
    tasks[date][index].completed = !tasks[date][index].completed;
    localStorage.setItem("tasks", JSON.stringify(tasks));
    renderTasks();
    if (currentUser) saveUserData(currentUser.uid);
  }
}

function deleteTask(date, index) {
  const tasks = JSON.parse(localStorage.getItem("tasks") || "{}");
  if (tasks[date]) {
    tasks[date].splice(index, 1);
    localStorage.setItem("tasks", JSON.stringify(tasks));
    renderTasks();
    if (currentUser) saveUserData(currentUser.uid);
  }
}

function renderTasks() {
  const incomplete = document.getElementById("incompleteTasks");
  const complete = document.getElementById("completedTasks");
  const today = getCurrentDateString();
  const tasks = JSON.parse(localStorage.getItem("tasks") || "{}");
  incomplete.innerHTML = "";
  complete.innerHTML = "";
  (tasks[today] || []).forEach((task, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <input type="checkbox" ${task.completed ? "checked" : ""} onchange="toggleTask('${today}', ${i})">
      <span>${task.text}</span>
      <span class="task-date">${task.date}</span>
      <button onclick="deleteTask('${today}', ${i})">🗑</button>
    `;
    (task.completed ? complete : incomplete).appendChild(li);
  });
}


// stopWatch
let stopwatchInterval = null;
let elapsedSeconds = 0;

function formatTime(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function updateTimeDisplay() {
  const display = document.getElementById("timeDisplay");
  if (display) display.textContent = formatTime(elapsedSeconds);
}

function startTimer() {
  if (!stopwatchInterval) {
    stopwatchInterval = setInterval(() => {
      elapsedSeconds++;
      updateTimeDisplay();
    }, 1000);
  }
}

function pauseTimer() {
  clearInterval(stopwatchInterval);
  stopwatchInterval = null;
}

function resetTimer() {
  pauseTimer();
  elapsedSeconds = 0;
  updateTimeDisplay();
}



// chart show
document.getElementById("print-weekly")?.addEventListener("click", () => {
  const pie = document.getElementById("weeklyPieChart").toDataURL("image/png");
  const bar = document.getElementById("weeklyBarChart").toDataURL("image/png");
  const win = window.open("", "_blank");
  win.document.write(`
    <html><head><title>Weekly Report</title></head><body>
    <h1>Weekly Report</h1>
    <img src="${pie}" style="width: 100%; max-width: 600px;" />
    <img src="${bar}" style="width: 100%; max-width: 600px;" />
    </body></html>
  `);
  win.document.close(); win.focus(); win.print();
});

window.addTask = addTask;
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;

// === Charts ===
let chartInstances = {};
function renderChart(id, dataObj, type) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (chartInstances[id]) chartInstances[id].destroy();
  const labels = Object.keys(dataObj);
  const data = Object.values(dataObj);
  chartInstances[id] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        label: "Duration (minutes)",
        data,
        backgroundColor: [
          "#4caf50", "#f44336", "#2196f3", "#ff9800", "#9c27b0",
          "#00bcd4", "#ffc107", "#8bc34a", "#e91e63", "#607d8b"
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        datalabels: { display: true, color: "#fff" },
        legend: { display: type === "pie" }
      },
      scales: type === "bar" ? {
        y: { beginAtZero: true, ticks: { precision: 0 } }
      } : {}
    },
    plugins: [ChartDataLabels]
  });
}

function updateCharts() {
  const activities = JSON.parse(localStorage.getItem("activities") || "[]");
  function aggregateByActivity(list) {
    return list.reduce((acc, a) => {
      acc[a.activity] = (acc[a.activity] || 0) + a.duration;
      return acc;
    }, {});
  }
const now = new Date();
const todayStr = now.toLocaleDateString('en-CA'); // Gives 'YYYY-MM-DD' in local time

  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);

  const isInRange = (dStr, f, t) => {
    const d = new Date(dStr);
    return d >= f && d <= t;
  };

  const daily = activities.filter(a => a.date === todayStr);
  const weekly = activities.filter(a => isInRange(a.date, weekStart, weekEnd));
  const monthly = activities.filter(a => isInRange(a.date, monthStart, monthEnd));
  const yearly = activities.filter(a => isInRange(a.date, yearStart, yearEnd));

  renderChart("dailyPieChart", aggregateByActivity(daily), "pie");
  renderChart("dailyBarChart", aggregateByActivity(daily), "bar");
  renderChart("weeklyPieChart", aggregateByActivity(weekly), "pie");
  renderChart("weeklyBarChart", aggregateByActivity(weekly), "bar");
  renderChart("monthlyPieChart", aggregateByActivity(monthly), "pie");
  renderChart("monthlyBarChart", aggregateByActivity(monthly), "bar");
  renderChart("yearlyPieChart", aggregateByActivity(yearly), "pie");
  renderChart("yearlyBarChart", aggregateByActivity(yearly), "bar");

  document.getElementById("daily-date").textContent = todayStr;
  document.getElementById("week-start").textContent = weekStart.toISOString().split("T")[0];
  document.getElementById("week-end").textContent = weekEnd.toISOString().split("T")[0];
  document.getElementById("month-start").textContent = monthStart.toISOString().split("T")[0];
  document.getElementById("month-end").textContent = monthEnd.toISOString().split("T")[0];
}



// streak Counter
document.addEventListener("DOMContentLoaded", () => {
  const calendar = document.getElementById("calendar");
  const monthYear = document.getElementById("monthYear");
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const todayStr = formatDate(today); // "YYYY-MM-DD"

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  monthYear.textContent = `${monthNames[month]} ${year}`;

  const storageKey = "streakDates";
  let streakData = JSON.parse(localStorage.getItem(storageKey)) || {};

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(d => {
    const header = document.createElement("div");
    header.textContent = d;
    header.style.fontWeight = "bold";
    calendar.appendChild(header);
  });

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement("div");
    blank.className = "day inactive";
    calendar.appendChild(blank);
  }

  for (let date = 1; date <= totalDays; date++) {
    const fullDate = new Date(year, month, date);
    const dateStr = formatDate(fullDate);

    const cell = document.createElement("div");
    cell.className = "day";
    cell.textContent = date;

    if (dateStr === todayStr) {
      cell.classList.add("today"); // Highlight today
    }

    const isFuture = fullDate > today;
    if (isFuture) {
      cell.classList.add("inactive");
    }

    if (streakData[dateStr]) {
      cell.classList.add("completed");
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.textContent = "✅";
      cell.appendChild(tick);
    }

    if (!isFuture) {
      cell.addEventListener("click", () => {
        if (streakData[dateStr]) {
          delete streakData[dateStr];
        } else {
          streakData[dateStr] = true;
        }
        localStorage.setItem(storageKey, JSON.stringify(streakData));
        location.reload();
      });
    }

    calendar.appendChild(cell);
  }

  function formatDate(date) {
    return date.toISOString().split("T")[0]; // "YYYY-MM-DD"
  }

  // === Auto-refresh at midnight ===
  const now = new Date();
  const millisTillMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1) - now;

  setTimeout(() => {
    location.reload(); // Refresh when new day starts
  }, millisTillMidnight);
});


window.startTimer = startTimer;
window.pauseTimer = pauseTimer;
window.resetTimer = resetTimer;
