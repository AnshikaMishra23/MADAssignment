
const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "campusmate_data_v1";

function loadData() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

        return {
            tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
            classes: Array.isArray(saved.classes) ? saved.classes : [],
            exams: Array.isArray(saved.exams) ? saved.exams : [],
            notes: Array.isArray(saved.notes) ? saved.notes : [],
            attendance: saved.attendance || null,
            dark: Boolean(saved.dark)
        };
    } catch {
        return {
            tasks: [],
            classes: [],
            exams: [],
            notes: [],
            attendance: null,
            dark: false
        };
    }
}

let data = loadData();

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Could not save CampusMate data:", error);
        alert("Unable to save data. Please check your device storage.");
        return false;
    }
}

function makeId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8);
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
}

function createButton(text, className, label, callback) {
    const button = makeElement("button", className, text);
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.addEventListener("click", callback);
    return button;
}

function formatDate(dateString) {
    if (!dateString) return "No due date";

    const date = new Date(dateString + "T00:00:00");

    if (Number.isNaN(date.getTime())) return "Invalid date";

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function daysUntil(dateString) {
    const target = new Date(dateString + "T00:00:00");
    const today = new Date(localDateString() + "T00:00:00");

    return Math.round((target - today) / 86400000);
}

function setEmptyState(id, isEmpty) {
    $(id).hidden = !isEmpty;
}

function updateDashboard() {
    $("pendingCount").textContent =
        data.tasks.filter(task => !task.done).length;

    $("examCount").textContent =
        data.exams.filter(exam => daysUntil(exam.date) >= 0).length;

    $("noteCount").textContent = data.notes.length;

    $("attendanceSummary").textContent =
        data.attendance === null ? "—" : `${data.attendance}%`;
}

function renderTasks() {
    const list = $("taskList");
    list.replaceChildren();

    const sortedTasks = [...data.tasks].sort((a, b) => {
        if (a.done !== b.done) return Number(a.done) - Number(b.done);
        return (a.due || "9999").localeCompare(b.due || "9999");
    });

    sortedTasks.forEach(task => {
        const item = makeElement(
            "div",
            `list-item${task.done ? " item-item-done" : ""}`
        );

        const main = makeElement("div", "item-main");
        main.append(
            makeElement("div", "item-title", task.title),
            makeElement(
                "div",
                "item-meta",
                task.due ? `Due: ${formatDate(task.due)}` : "No due date"
            )
        );

        const check = createButton(
            task.done ? "✓" : "○",
            "check-btn",
            task.done ? "Mark incomplete" : "Mark complete",
            () => {
                task.done = !task.done;
                saveData();
                renderAll();
            }
        );

        const remove = createButton(
            "×",
            "delete-btn",
            "Delete task",
            () => {
                if (!confirm("Delete this assignment?")) return;

                data.tasks = data.tasks.filter(t => t.id !== task.id);
                saveData();
                renderAll();
            }
        );

        item.append(check, main, remove);
        list.append(item);
    });

    setEmptyState("emptyTasks", data.tasks.length === 0);
}

$("taskForm").addEventListener("submit", event => {
    event.preventDefault();

    const title = $("taskInput").value.trim();
    const due = $("taskDue").value;

    if (!title) return;

    if (due && due < localDateString()) {
        if (!confirm("This due date is in the past. Add the assignment anyway?")) {
            return;
        }
    }

    data.tasks.push({
        id: makeId(),
        title,
        due,
        done: false
    });

    saveData();
    $("taskForm").reset();
    renderAll();
});

function renderClasses() {
    const list = $("classList");
    list.replaceChildren();

    const sortedClasses = [...data.classes].sort((a, b) =>
        a.time.localeCompare(b.time)
    );

    sortedClasses.forEach(itemData => {
        const item = makeElement("div", "list-item");
        const main = makeElement("div", "item-main");

        const time = itemData.time
            ? new Date(`2000-01-01T${itemData.time}`).toLocaleTimeString(
                undefined,
                { hour: "numeric", minute: "2-digit" }
            )
            : "Time not set";

        main.append(
            makeElement("div", "item-title", itemData.name),
            makeElement("div", "item-meta", time)
        );

        const remove = createButton(
            "×",
            "delete-btn",
            "Delete class",
            () => {
                data.classes = data.classes.filter(c => c.id !== itemData.id);
                saveData();
                renderAll();
            }
        );

        item.append(main, remove);
        list.append(item);
    });

    setEmptyState("emptyClasses", data.classes.length === 0);
}

$("classForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("className").value.trim();
    const time = $("classTime").value;

    if (!name || !time) return;

    data.classes.push({
        id: makeId(),
        name,
        time
    });

    saveData();
    $("classForm").reset();
    renderAll();
});

$("attendanceForm").addEventListener("submit", event => {
    event.preventDefault();

    const attended = Number($("attendedInput").value);
    const total = Number($("totalInput").value);

    if (
        $("attendedInput").value === "" ||
        $("totalInput").value === "" ||
        !Number.isInteger(attended) ||
        !Number.isInteger(total) ||
        total < 1 ||
        attended < 0 ||
        attended > total
    ) {
        alert("Enter valid class counts. Attended classes cannot exceed total classes.");
        return;
    }

    const percentage = Number(((attended / total) * 100).toFixed(2));

    data.attendance = percentage;
    saveData();

    $("attendanceResult").textContent = `${percentage}%`;

    if (percentage >= 75) {
        $("attendanceMessage").textContent =
            "Great! Your attendance meets the 75% target.";
    } else {
        const required = Math.ceil((0.75 * total - attended) / 0.25);

        $("attendanceMessage").textContent =
            `Below 75%. Attend the next ${Math.max(0, required)} consecutive classes to reach 75%.`;
    }

    $("attendanceBar").style.width = `${percentage}%`;

    renderAll();
});

function renderExams() {
    const list = $("examList");
    list.replaceChildren();

    const sortedExams = [...data.exams].sort((a, b) =>
        a.date.localeCompare(b.date)
    );

    sortedExams.forEach(exam => {
        const remaining = daysUntil(exam.date);
        const item = makeElement("div", "list-item");
        const main = makeElement("div", "item-main");

        let countdown;

        if (remaining < 0) {
            countdown = `Passed ${Math.abs(remaining)} day(s) ago`;
        } else if (remaining === 0) {
            countdown = "Exam is today!";
        } else {
            countdown = `${remaining} day(s) remaining`;
        }

        main.append(
            makeElement("div", "item-title", exam.name),
            makeElement(
                "div",
                "item-meta",
                `${formatDate(exam.date)} · ${countdown}`
            )
        );

        const remove = createButton(
            "×",
            "delete-btn",
            "Delete exam",
            () => {
                data.exams = data.exams.filter(e => e.id !== exam.id);
                saveData();
                renderAll();
            }
        );

        item.append(main, remove);
        list.append(item);
    });

    setEmptyState("emptyExams", data.exams.length === 0);
}

$("examForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("examName").value.trim();
    const date = $("examDate").value;

    if (!name || !date) return;

    if (date < localDateString()) {
        alert("Please choose today or a future date for the exam.");
        return;
    }

    data.exams.push({
        id: makeId(),
        name,
        date
    });

    saveData();
    $("examForm").reset();
    renderAll();
});

function renderNotes() {
    const list = $("noteList");
    list.replaceChildren();

    [...data.notes].reverse().forEach(note => {
        const card = makeElement("article", "note-card");

        card.append(
            makeElement("h3", "", note.title),
            makeElement("p", "", note.content),
            makeElement(
                "div",
                "item-meta",
                `Saved ${formatDate(note.date)}`
            )
        );

        const remove = createButton(
            "Delete note",
            "delete-btn",
            "Delete note",
            () => {
                if (!confirm("Delete this note?")) return;

                data.notes = data.notes.filter(n => n.id !== note.id);
                saveData();
                renderAll();
            }
        );

        card.append(remove);
        list.append(card);
    });

    setEmptyState("emptyNotes", data.notes.length === 0);
}

$("noteForm").addEventListener("submit", event => {
    event.preventDefault();

    const title = $("noteTitle").value.trim();
    const content = $("noteContent").value.trim();

    if (!title || !content) return;

    data.notes.push({
        id: makeId(),
        title,
        content,
        date: localDateString()
    });

    saveData();
    $("noteForm").reset();
    renderAll();
});

function applyTheme() {
    document.body.classList.toggle("dark", data.dark);

    $("themeToggle").textContent = data.dark ? "☀" : "☾";

    $("themeToggle").setAttribute(
        "aria-label",
        data.dark ? "Switch to light mode" : "Switch to dark mode"
    );

    $("themeToggle").title =
        data.dark ? "Switch to light mode" : "Switch to dark mode";
}

$("themeToggle").addEventListener("click", () => {
    data.dark = !data.dark;
    saveData();
    applyTheme();
});

function renderAll() {
    renderTasks();
    renderClasses();
    renderExams();
    renderNotes();
    updateDashboard();
}

function initializeApp() {
    $("todayDate").textContent = new Date().toLocaleDateString(
        undefined,
        {
            weekday: "long",
            month: "long",
            day: "numeric"
        }
    ).toUpperCase();

    applyTheme();
    renderAll();

    document.querySelectorAll(".bottom-nav a").forEach(link => {
        link.addEventListener("click", event => {
            const targetId = link.dataset.section;

            if (targetId === "top") {
                event.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });
    });
}

initializeApp();
