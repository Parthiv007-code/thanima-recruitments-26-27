import "./globals.css";

export const metadata = {
  title: "Recruitment OC Queue",
  description: "Applicant check-in and interview queuing system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
