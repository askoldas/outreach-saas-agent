import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Opptium", template: "%s | Opptium" },
  description: "AI-assisted B2B prospecting and outbound preparation.",
};

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
