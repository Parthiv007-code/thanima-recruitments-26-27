import "./globals.css";

export const metadata = {
  title: "Recruitment OC Queue",
  description: "Applicant check-in and interview queuing system",
};

// Runs before React hydrates so the page never flashes the wrong theme.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("roc_theme");
    var theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
