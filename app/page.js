```jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const SITE_PASSWORD = "thanimaontop";
const AUTH_KEY = "roc_site_authed";

function LoginScreen({ onSuccess }) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();

    if (input === SITE_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      setErr("");
      onSuccess();
    } else {
      setErr("Incorrect password.");
    }
  };

  return (
    <div className="gate-shell">
      <form className="gate-card" onSubmit={submit}>
        <h2>Recruitment OC Queue</h2>
        <p>Enter password to continue</p>

        <input
          type="password"
          placeholder="Password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />

        {err && <div className="gate-error">{err}</div>}

        <button type="submit">Enter</button>
      </form>
    </div>
  );
}

function MainApp({ onSignOut }) {
  const [applicants, setApplicants] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newReg, setNewReg] = useState("");
  const [newDept, setNewDept] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("queue");

  useEffect(() => {
    const q = query(
      collection(db, "applicants"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setApplicants(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );
        setError("");
      },
      (err) => {
        console.error(err);
        setError(
          "Could not connect to Firestore. Check your Firebase config and security rules."
        );
      }
    );

    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    let completed = 0;
    let waiting = 0;
    let notArrived = 0;

    for (const a of applicants) {
      if (a.interviewed) {
        completed++;
      } else if (a.arrived) {
        waiting++;
      } else {
        notArrived++;
      }
    }

    return {
      completed,
      waiting,
      notArrived,
      total: applicants.length,
    };
  }, [applicants]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return applicants;

    return applicants.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(term) ||
        (a.regNumber || "").toLowerCase().includes(term) ||
        (a.dept || "").toLowerCase().includes(term)
    );
  }, [applicants, search]);

  const queue = useMemo(() => {
    return filtered
      .filter((a) => a.arrived && !a.interviewed)
      .sort((a, b) => {
        const ta = a.arrivedAt?.toMillis
          ? a.arrivedAt.toMillis()
          : 0;

        const tb = b.arrivedAt?.toMillis
          ? b.arrivedAt.toMillis()
          : 0;

        return ta - tb;
      });
  }, [filtered]);

  const notArrivedList = useMemo(
    () => filtered.filter((a) => !a.arrived && !a.interviewed),
    [filtered]
  );

  const completedList = useMemo(
    () => filtered.filter((a) => a.interviewed),
    [filtered]
  );

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!newName.trim() || !newReg.trim()) return;

    try {
      await addDoc(collection(db, "applicants"), {
        name: newName.trim(),
        regNumber: newReg.trim(),
        dept: newDept.trim(),
        arrived: false,
        interviewed: false,
        arrivedAt: null,
        createdAt: serverTimestamp(),
      });

      setNewName("");
      setNewReg("");
      setNewDept("");
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to add applicant. Check Firestore permissions."
      );
    }
  };

  const toggleArrived = async (a) => {
    try {
      const goingArrived = !a.arrived;

      await updateDoc(doc(db, "applicants", a.id), {
        arrived: goingArrived,
        arrivedAt: goingArrived ? serverTimestamp() : null,
        interviewed: goingArrived ? a.interviewed : false,
      });
    } catch (err) {
      console.error(err);
      setError(
        "Failed to update. Check Firestore permissions."
      );
    }
  };

  const toggleInterviewed = async (a) => {
    try {
      await updateDoc(doc(db, "applicants", a.id), {
        interviewed: !a.interviewed,
      });
    } catch (err) {
      console.error(err);
      setError(
        "Failed to update. Check Firestore permissions."
      );
    }
  };

  const ApplicantRow = ({ a, queuePosition }) => (
    <div className="applicant-card">
      <div className="applicant-info">
        <div className="applicant-name">
          {queuePosition && (
            <span className="queue-number">
              #{queuePosition}
            </span>
          )}
          {a.name}
        </div>

        <div className="applicant-reg">
          Reg #{a.regNumber}
          {a.dept ? ` · ${a.dept}` : ""}
        </div>
      </div>

      <div className="actions">
        <button
          className={`btn ${a.arrived ? "on" : ""}`}
          onClick={() => toggleArrived(a)}
        >
          {a.arrived ? "Arrived ✓" : "Check In"}
        </button>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={!!a.interviewed}
            onChange={() => toggleInterviewed(a)}
          />
          Interviewed
        </label>
      </div>
    </div>
  );

  const tabs = [
    {
      key: "queue",
      label: "Interview Queue",
      count: queue.length,
      data: queue,
      withPosition: true,
    },
    {
      key: "notarrived",
      label: "Not Arrived",
      count: notArrivedList.length,
      data: notArrivedList,
      withPosition: false,
    },
    {
      key: "completed",
      label: "Completed",
      count: completedList.length,
      data: completedList,
      withPosition: false,
    },
  ];

  const activeTabData = tabs.find(
    (t) => t.key === activeTab
  );

  return (
    <div className="app-shell">
      <div className="header-fixed">
        <div className="header-row">
          <h1>Recruitment OC Queue</h1>

          <div className="header-actions">
            <Link
              href="/admin"
              className="admin-link"
            >
              Admin
            </Link>

            <button
              onClick={onSignOut}
              className="signout-btn"
            >
              Sign Out
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        <div className="stats">
          <div className="stat-card completed">
            <div className="stat-value">
              {counts.completed}
            </div>
            <div className="stat-label">
              Interviewed
            </div>
          </div>

          <div className="stat-card waiting">
            <div className="stat-value">
              {counts.waiting}
            </div>
            <div className="stat-label">
              Waiting
            </div>
          </div>

          <div className="stat-card notarrived">
            <div className="stat-value">
              {counts.notArrived}
            </div>
            <div className="stat-label">
              Not Arrived
            </div>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name, reg. number, or dept..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            className="add-toggle"
            onClick={() =>
              setShowAddForm((s) => !s)
            }
          >
            {showAddForm ? "Close" : "+ Add"}
          </button>
        </div>

        {showAddForm && (
          <form
            className="add-form"
            onSubmit={handleAdd}
          >
            <input
              placeholder="Full name"
              value={newName}
              onChange={(e) =>
                setNewName(e.target.value)
              }
              required
            />

            <input
              placeholder="Registration number"
              value={newReg}
              onChange={(e) =>
                setNewReg(e.target.value)
              }
              required
            />

            <input
              placeholder="Department (optional)"
              value={newDept}
              onChange={(e) =>
                setNewDept(e.target.value)
              }
            />

            <button type="submit">
              Save
            </button>
          </form>
        )}

        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab-btn ${
                activeTab === t.key
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveTab(t.key)
              }
            >
              {t.label}{" "}
              <span className="tab-count">
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="tab-content">
        {activeTabData.data.length === 0 ? (
          <div className="empty">
            {search.trim()
              ? "No applicants match your search."
              : "Nothing here."}
          </div>
        ) : (
          <div className="list">
            {activeTabData.data.map((a, idx) => (
              <ApplicantRow
                a={a}
                key={a.id}
                queuePosition={
                  activeTabData.withPosition
                    ? idx + 1
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_KEY) === "1") {
      setAuthed(true);
    }

    setChecked(true);
  }, []);

  const signOut = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  };

  if (!checked) return null;

  if (!authed) {
    return (
      <LoginScreen
        onSuccess={() => setAuthed(true)}
      />
    );
  }

  return <MainApp onSignOut={signOut} />;
}
```
