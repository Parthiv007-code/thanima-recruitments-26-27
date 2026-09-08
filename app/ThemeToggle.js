"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "roc_theme";

export default function ThemeToggle({ className = "theme-toggle" }) {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    // Reflects whatever the no-flash inline script in layout.js already applied.
    const current = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  };

  if (!theme) {
    // Avoid rendering the wrong icon before we've read the current theme client-side.
    return <button className={className} aria-label="Toggle theme" />;
  }

  return (
    <button
      className={className}
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      type="button"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
