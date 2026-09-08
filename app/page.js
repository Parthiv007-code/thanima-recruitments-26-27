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
import ThemeToggle from "./ThemeToggle";

const SITE_PASSWORD = "thanimaontop";
const AUTH_KEY = "roc_site_authed";

const EMPTY_FORM = {
  name: "",
  regNumber: "",
  vitMail: "",
  phone: "",
  year: "",
  slot: "",
  hostelType: "",
  dept1: "",
  dept2: "",
  dept3: "",
  literaryInterest: "",
  reason: "",
  experience: "",
  designPortfolio: "",
  mediaPortfolio: "",
  github: "",
};

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
      <div className="gate-theme-toggle">
        <ThemeToggle />
      </div>
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

function AddApplicantForm({ onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.regNumber.trim()) return;

    setSaving(true);
    setError("");

    try {
      await addDoc(collection(db, "applicants"), {
        name: form.name.trim(),
        regNumber: form.regNumber.trim(),
        vitMail: form.vitMail.trim(),
        phone: form.phone.trim(),
        year: form.year.trim(),
        slot: form.slot.trim(),
        hostelType: form.hostelType.trim(),
        dept1: form.dept1.trim(),
        dept2: form.dept2.trim(),
        dept3: form.dept3.trim(),
        // kept for backward compatibility with search / older records
        dept: form.dept1.trim(),
        literaryInterest: form.literaryInterest.trim(),
        reason: form.reason.trim(),
        experience: form.experience.trim(),
        designPortfolio: form.designPortfolio.trim(),
        mediaPortfolio: form.mediaPortfolio.trim(),
        github: form.github.trim(),
        arrived: false,
        interviewed: false,
        arrivedAt: null,
        createdAt: serverTimestamp(),
      });

      setForm(EMPTY_FORM);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to add applicant. Check Firestore permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="add-form" onSubmit={handleAdd}>
      {error && <div className="error-banner">{error}</div>}

      <div className="add-form-grid">
        <div className="add-form-field">
          <label>Full name *</label>
          <input value={form.name} onChange={setField("name")} required />
        </div>

        <div className="add-form-field">
          <label>Registration number *</label>
          <input value={form.regNumber} onChange={setField("regNumber")} required />
        </div>

        <div className="add-form-field">
          <label>VIT mail ID</label>
          <input value={form.vitMail} onChange={setField("vitMail")} />
        </div>

        <div className="add-form-field">
          <label>Phone number</label>
          <input value={form.phone} onChange={setField("phone")} />
        </div>

        <div className="add-form-field">
          <label>Year of study</label>
          <input
            value={form.year}
            onChange={setField("year")}
            placeholder="e.g. 1st year"
          />
        </div>

        <div className="add-form-field">
          <label>Slot</label>
          <input
            value={form.slot}
            onChange={setField("slot")}
            placeholder="e.g. Morning theory"
          />
        </div>

        <div className="add-form-field">
          <label>Hosteller / Day scholar</label>
          <select value={form.hostelType} onChange={setField("hostelType")}>
            <option value="">Select</option>
            <option value="Hosteller">Hosteller</option>
            <option value="Day Scholar">Day Scholar</option>
          </select>
        </div>

        <div className="add-form-field">
          <label>Interested in literary events?</label>
          <select value={form.literaryInterest} onChange={setField("literaryInterest")}>
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>

        <div className="add-form-field">
          <label>Dept - 1st preference</label>
          <input value={form.dept1} onChange={setField("dept1")} />
        </div>

        <div className="add-form-field">
          <label>Dept - 2nd preference</label>
          <input value={form.dept2} onChange={setField("dept2")} />
        </div>

        <div className="add-form-field">
          <label>Dept - 3rd preference</label>
          <input value={form.dept3} onChange={setField("dept3")} />
        </div>

        <div className="add-form-field">
          <label>GitHub link</label>
          <input value={form.github} onChange={setField("github")} />
        </div>

        <div className="add-form-field full-width">
          <label>Reason for choosing the above departments</label>
          <textarea value={form.reason} onChange={setField("reason")} />
        </div>

        <div className="add-form-field full-width">
          <label>Previous experience / relevant skills</label>
          <textarea value={form.experience} onChange={setField("experience")} />
        </div>

        <div className="add-form-field full-width">
          <label>Design / decor portfolio link</label>
          <input value={form.designPortfolio} onChange={setField("designPortfolio")} />
        </div>

        <div className="add-form-field full-width">
          <label>Media portfolio link</label>
          <input value={form.mediaPortfolio} onChange={setField("mediaPortfolio")} />
        </div>
      </div>

      <div className="add-form-actions">
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save applicant"}
        </button>
      </div>
    </form>
  );
}

function MainApp({ onSignOut }) {
  const [applicants, setApplicants] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
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
        (a.dept || a.dept1 || "").toLowerCase().includes(term)
    );
  }, [applicants, search]);

  const queue = useMemo(() => {
    return filtered
      .filter((a) => a.arrived && !a.interviewed)
      .sort((a, b) => {
        const ta = a.arrivedAt?.toMillis ? a.arrivedAt.toMillis() : 0;
        const tb = b.arrivedAt?.toMillis ? b.arrivedAt.toMillis() : 0;
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

  const checkIn = async (a) => {
    try {
      await updateDoc(doc(db, "applicants", a.id), {
        arrived: true,
        arrivedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setError("Failed to check in. Check Firestore permissions.");
    }
  };

  const undoCheckIn = async (a) => {
    try {
      await updateDoc(doc(db, "applicants", a.id), {
        arrived: false,
        arrivedAt: null,
      });
    } catch (err) {
      console.error(err);
      setError("Failed to undo check-in. Check Firestore permissions.");
    }
  };

  const toggleInterviewed = async (a) => {
    try {
      await updateDoc(doc(db, "applicants", a.id), {
        interviewed: !a.interviewed,
      });
    } catch (err) {
      console.error(err);
      setError("Failed to update. Check Firestore permissions.");
    }
  };

  const ApplicantRow = ({ a, queuePosition, tabKey }) => (
    <div className="applicant-card">
      <div className="applicant-info">
        <div className="applicant-name">
          {queuePosition && <span className="queue-number">#{queuePosition}</span>}
          {a.name}
        </div>

        <div className="applicant-reg">
          Reg #{a.regNumber}
          {(a.dept1 || a.dept) ? ` - ${a.dept1 || a.dept}` : ""}
        </div>
      </div>

      <div className="actions">
        {tabKey === "notarrived" && (
          <button className="btn" onClick={() => checkIn(a)}>
            Check In
          </button>
        )}

        {tabKey === "queue" && (
          <>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!!a.interviewed}
                onChange={() => toggleInterviewed(a)}
              />
              Interviewed
            </label>
            <button className="btn text-link" onClick={() => undoCheckIn(a)}>
              Undo check-in
            </button>
          </>
        )}

        {tabKey === "completed" && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={!!a.interviewed}
              onChange={() => toggleInterviewed(a)}
            />
            Interviewed
          </label>
        )}
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

  const activeTabData = tabs.find((t) => t.key === activeTab);

  return (
    <div className="app-shell">
      <div className="header-fixed">
        <div className="header-row">
          <h1>Recruitment OC Queue</h1>

          <div className="header-actions">
            <ThemeToggle />
            <Link href="/admin" className="admin-link">
              Admin
            </Link>
            <button onClick={onSignOut} className="signout-btn">
              Sign Out
            </button>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="stats">
          <div className="stat-card completed">
            <div className="stat-value">{counts.completed}</div>
            <div className="stat-label">Interviewed</div>
          </div>

          <div className="stat-card waiting">
            <div className="stat-value">{counts.waiting}</div>
            <div className="stat-label">Waiting</div>
          </div>

          <div className="stat-card notarrived">
            <div className="stat-value">{counts.notArrived}</div>
            <div className="stat-label">Not Arrived</div>
          </div>
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by name, reg. number, or dept..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button className="add-toggle" onClick={() => setShowAddForm((s) => !s)}>
            {showAddForm ? "Close" : "+ Add"}
          </button>
        </div>

        {showAddForm && <AddApplicantForm onClose={() => setShowAddForm(false)} />}

        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab-btn ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label} <span className="tab-count">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tab-content">
        {activeTabData.data.length === 0 ? (
          <div className="empty">
            {search.trim() ? "No applicants match your search." : "Nothing here."}
          </div>
        ) : (
          <div className="list">
            {activeTabData.data.map((a, idx) => (
              <ApplicantRow
                a={a}
                key={a.id}
                tabKey={activeTabData.key}
                queuePosition={activeTabData.withPosition ? idx + 1 : undefined}
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
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return <MainApp onSignOut={signOut} />;
}
